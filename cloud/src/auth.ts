import { randomBytes, timingSafeEqual } from "node:crypto";
import { Config, Fault } from "./config.js";
import { GitHub } from "./github.js";
import { hash } from "./model.js";
import { Store, seal, unseal } from "./store.js";
export type Session = {
  user: { id: number; login: string };
  token: string;
  expires: number;
  csrf: string;
};
export const random = () => randomBytes(32).toString("base64url");
export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
export class Auth {
  constructor(
    public cfg: Config,
    private store: Store,
    private gh: GitHub,
  ) {}
  cookie(name: string, value: string, age: number) {
    return `${this.cfg.origin.startsWith("https:") ? "__Host-" : ""}atlas-${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${this.cfg.origin.startsWith("https:") ? "; Secure" : ""}`;
  }
  readCookie(header: string | undefined, name: string) {
    const key =
      (this.cfg.origin.startsWith("https:") ? "__Host-" : "") + "atlas-" + name;
    return (
      (header ?? "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith(key + "="))
        ?.slice(key.length + 1) ?? ""
    );
  }
  async begin() {
    const state = random(),
      verifier = random(),
      nonce = random();
    await this.store.write(
      "oauth/" + hash(nonce),
      seal({ state, verifier, expires: Date.now() + 600000 }, this.cfg.secret),
    );
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: this.cfg.clientId,
      redirect_uri: this.cfg.origin + "/api/auth/callback",
      state,
      code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
      code_challenge_method: "S256",
      allow_signup: "false",
      prompt: "select_account",
    }).toString();
    return { url: url.toString(), cookie: this.cookie("oauth", nonce, 600) };
  }
  async callback(nonce: string, state: string, code: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(nonce) || !code || code.length > 512)
      throw new Fault("OAUTH_STATE_INVALID", 400);
    const key = "oauth/" + hash(nonce),
      b = await this.store.read(key);
    if (!b) throw new Fault("OAUTH_STATE_INVALID", 400);
    const saved = unseal<{ state: string; verifier: string; expires: number }>(
      b,
      this.cfg.secret,
    );
    await this.store.remove(key);
    if (saved.expires < Date.now() || !safeEqual(state, saved.state))
      throw new Fault("OAUTH_STATE_INVALID", 400);
    const token = await this.gh.exchange(code, saved.verifier),
      user = await this.gh.identity(token.token);
    await this.gh.checkInstallation();
    const sid = random(),
      session: Session = {
        user,
        token: token.token,
        expires: Date.now() + token.expiresIn * 1000,
        csrf: random(),
      };
    await this.store.write(
      "sessions/" + hash(sid),
      seal(session, this.cfg.secret),
    );
    return { cookie: this.cookie("session", sid, token.expiresIn) };
  }
  async session(sid: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(sid))
      throw new Fault("LOGIN_REQUIRED", 401);
    const b = await this.store.read("sessions/" + hash(sid));
    if (!b) throw new Fault("LOGIN_REQUIRED", 401);
    const s = unseal<Session>(b, this.cfg.secret);
    if (s.expires < Date.now()) throw new Fault("SESSION_EXPIRED", 401);
    const identity = await this.gh.identity(s.token);
    // Installation policy is checked even while the snapshot cache is fresh.
    await this.gh.checkInstallation();
    if (identity.id !== s.user.id)
      throw new Fault("SESSION_IDENTITY_CHANGED", 403);
    return { ...s, user: identity };
  }
  async logout(sid: string) {
    if (/^[A-Za-z0-9_-]{43}$/.test(sid))
      await this.store.remove("sessions/" + hash(sid));
    return this.cookie("session", "", 0);
  }
  csrf(
    origin: string | undefined,
    value: string | undefined,
    session: Session,
  ) {
    if (origin !== this.cfg.origin || !value || !safeEqual(value, session.csrf))
      throw new Fault("CSRF_REJECTED", 403);
  }
}
