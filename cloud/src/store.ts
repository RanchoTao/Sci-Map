import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { get, put, list, del } from "@vercel/blob";
import { Fault } from "./config.js";
export interface Store {
  read(key: string): Promise<Buffer | null>;
  write(key: string, value: Buffer): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}
// Every object is private. Only small projected API responses reach browsers.
export class BlobStore implements Store {
  async read(key: string) {
    const b = await get(key, { access: "private", useCache: false });
    return b?.statusCode === 200 && b.stream
      ? Buffer.from(await new Response(b.stream).arrayBuffer())
      : null;
  }
  async write(key: string, value: Buffer) {
    await put(key, value, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/octet-stream",
    });
  }
  async remove(key: string) {
    await del(key);
  }
  async keys(prefix: string) {
    let cursor: string | undefined;
    const paths: string[] = [];
    do {
      const p = await list({ prefix, cursor, limit: 1000 });
      paths.push(...p.blobs.map((x) => x.pathname));
      cursor = p.hasMore ? p.cursor : undefined;
    } while (cursor);
    return paths;
  }
}
export function seal(value: unknown, secret: string): Buffer {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", Buffer.from(secret, "base64"), iv);
  const ciphertext = Buffer.concat([
    c.update(JSON.stringify(value), "utf8"),
    c.final(),
  ]);
  return Buffer.concat([iv, c.getAuthTag(), ciphertext]);
}
export function unseal<T>(value: Buffer, secret: string): T {
  try {
    const d = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(secret, "base64"),
      value.subarray(0, 12),
    );
    d.setAuthTag(value.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([d.update(value.subarray(28)), d.final()]).toString("utf8"),
    );
  } catch {
    throw new Fault("INVALID_SESSION", 401);
  }
}
