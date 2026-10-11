import { createSign } from "node:crypto";
import { Config, Fault } from "./config.js";
export type Fetcher = typeof fetch;
export class GitHub {
  constructor(
    public cfg: Config,
    private request: Fetcher = fetch,
  ) {}
  async api(
    path: string,
    token: string,
    method = "GET",
    body?: unknown,
    raw = false,
  ): Promise<any> {
    let response: Response;
    try {
      response = await this.request("https://api.github.com" + path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: raw
            ? "application/vnd.github.raw+json"
            : "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
        redirect: "error",
      });
    } catch {
      throw new Fault("GITHUB_UNAVAILABLE");
    }
    if (!response.ok)
      throw new Fault(
        response.status === 401
          ? "TOKEN_EXPIRED"
          : response.status === 403 || response.status === 429
            ? "GITHUB_RATE_OR_PERMISSION"
            : response.status === 404
              ? "GITHUB_NOT_FOUND"
              : "GITHUB_READ_FAILED",
        response.status === 401 ? 401 : 503,
      );
    if (raw) {
      const limit = 100_000_000;
      if (Number(response.headers.get("content-length")) > limit)
        throw new Fault("BLOB_TOO_LARGE");
      const reader = response.body!.getReader(),
        chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > limit) {
          await reader.cancel();
          throw new Fault("BLOB_TOO_LARGE");
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks);
    }
    return response.json();
  }
  async identity(token: string) {
    const user = await this.api("/user", token);
    if (!this.cfg.allowedIds.has(user.id))
      throw new Fault("USER_NOT_AUTHORIZED", 403);
    // This endpoint lists repositories accessible to BOTH the App and this user.
    let allowed = false;
    for (let page = 1; page <= 100; page++) {
      let p;
      try {
        p = await this.api(
          `/user/installations/${this.cfg.installationId}/repositories?per_page=100&page=${page}`,
          token,
        );
      } catch (e) {
        if (e instanceof Fault && e.code === "GITHUB_NOT_FOUND")
          throw new Fault("REPOSITORY_NOT_AUTHORIZED", 403);
        throw e;
      }
      if (
        p.repositories?.some(
          (r: any) => r.full_name === this.cfg.repo && r.private === true,
        )
      ) {
        allowed = true;
        break;
      }
      if ((p.repositories?.length ?? 0) < 100) break;
    }
    if (!allowed) throw new Fault("REPOSITORY_NOT_AUTHORIZED", 403);
    return { id: user.id, login: user.login };
  }
  async checkInstallation() {
    const now = Math.floor(Date.now() / 1000),
      header = Buffer.from(
        JSON.stringify({ alg: "RS256", typ: "JWT" }),
      ).toString("base64url"),
      payload = Buffer.from(
        JSON.stringify({ iat: now - 30, exp: now + 540, iss: this.cfg.appId }),
      ).toString("base64url");
    const unsigned = `${header}.${payload}`,
      sign = createSign("RSA-SHA256");
    sign.update(unsigned);
    const jwt = `${unsigned}.${sign.sign(this.cfg.privateKey, "base64url")}`;
    const installation = await this.api(
      `/app/installations/${this.cfg.installationId}`,
      jwt,
    );
    if (
      installation.repository_selection !== "selected" ||
      installation.account?.login !== this.cfg.repo.split("/")[0] ||
      installation.permissions?.contents !== "read" ||
      Object.entries(installation.permissions ?? {}).some(
        ([key, value]) =>
          !["contents", "metadata"].includes(key) || value !== "read",
      )
    )
      throw new Fault("APP_PERMISSIONS_NOT_MINIMAL", 403);
    return jwt;
  }
  async installationToken() {
    const jwt = await this.checkInstallation();
    const r = await this.api(
      `/app/installations/${this.cfg.installationId}/access_tokens`,
      jwt,
      "POST",
      { repositories: ["Research-Archive"], permissions: { contents: "read" } },
    );
    if (!r.token) throw new Fault("INSTALLATION_TOKEN_FAILED");
    return r.token as string;
  }
  async exchange(code: string, verifier: string) {
    let r: Response;
    try {
      r = await this.request("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
          code,
          code_verifier: verifier,
          redirect_uri: this.cfg.origin + "/api/auth/callback",
        }),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Fault("OAUTH_UNAVAILABLE");
    }
    const t = await r.json();
    if (
      !r.ok ||
      !t.access_token ||
      !t.access_token.startsWith("ghu_") ||
      t.scope
    )
      throw new Fault("OAUTH_EXCHANGE_FAILED", 401);
    return {
      token: t.access_token as string,
      expiresIn: Math.min(t.expires_in ?? 28800, 28800),
    };
  }
  async head(token: string) {
    const repo = await this.api(`/repos/${this.cfg.repo}`, token);
    if (!repo.private) throw new Fault("REPOSITORY_NOT_PRIVATE");
    const c = await this.api(
      `/repos/${this.cfg.repo}/commits/${encodeURIComponent(repo.default_branch)}`,
      token,
    );
    return { sha: c.sha as string, date: c.commit.committer.date as string };
  }
  async file(path: string, commit: string, token: string) {
    if (
      !/^[a-f0-9]{40}$/.test(commit) ||
      path.split("/").some((x) => !x || x === ".." || x === ".") ||
      path.includes("\\")
    )
      throw new Fault("INVALID_SOURCE_PATH");
    const meta = await this.api(
      `/repos/${this.cfg.repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit}`,
      token,
    );
    if (meta.type !== "file" || !meta.sha) throw new Fault("SOURCE_NOT_FILE");
    return (await this.api(
      `/repos/${this.cfg.repo}/git/blobs/${meta.sha}`,
      token,
      "GET",
      undefined,
      true,
    )) as Buffer;
  }
}
