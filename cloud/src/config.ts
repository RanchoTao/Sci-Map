export class Fault extends Error {
  constructor(
    public code: string,
    public status = 503,
  ) {
    super(code);
  }
}
export type Config = {
  origin: string;
  appId: string;
  clientId: string;
  clientSecret: string;
  installationId: string;
  privateKey: string;
  allowedIds: Set<number>;
  secret: string;
  repo: string;
};
export function config(env = process.env): Config {
  const keys = [
    "APP_ORIGIN",
    "GITHUB_APP_ID",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_INSTALLATION_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_ALLOWED_USER_IDS",
    "SESSION_SECRET",
  ];
  if (
    keys.some((k) => !env[k]) ||
    Buffer.from(env.SESSION_SECRET ?? "", "base64").length !== 32
  )
    throw new Fault("SETUP_REQUIRED");
  const origin = new URL(env.APP_ORIGIN!);
  if (
    origin.protocol !== "https:" &&
    !(env.NODE_ENV !== "production" && origin.hostname === "127.0.0.1")
  )
    throw new Fault("HTTPS_REQUIRED");
  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username
  )
    throw new Fault("INVALID_ORIGIN");
  const allowedIds = new Set(
    env.GITHUB_ALLOWED_USER_IDS!.split(",").map((x) => Number(x.trim())),
  );
  if (
    !allowedIds.size ||
    [...allowedIds].some((x) => !Number.isSafeInteger(x) || x <= 0)
  )
    throw new Fault("INVALID_ALLOWLIST");
  return {
    origin: origin.origin,
    appId: env.GITHUB_APP_ID!,
    clientId: env.GITHUB_CLIENT_ID!,
    clientSecret: env.GITHUB_CLIENT_SECRET!,
    installationId: env.GITHUB_INSTALLATION_ID!,
    privateKey: env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    allowedIds,
    secret: env.SESSION_SECRET!,
    repo: "RanchoTao/Research-Archive",
  };
}
