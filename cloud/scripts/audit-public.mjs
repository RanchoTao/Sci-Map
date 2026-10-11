import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const allowedPages = new Set([
  "index.html",
  "app.js",
  "style.css",
  "data/merged.json",
  ".nojekyll",
]);
const forbiddenClientPatterns = [
  [
    "server secret variable",
    /\b(?:GITHUB_CLIENT_SECRET|GITHUB_APP_PRIVATE_KEY|SESSION_SECRET|BLOB_READ_WRITE_TOKEN|BLOB_STORE_ID)\b/,
  ],
  [
    "public environment injection",
    /\b(?:NEXT_PUBLIC|VITE)_[A-Z0-9_]*(?:TOKEN|SECRET|KEY|PRIVATE|CATALOG)[A-Z0-9_]*\b/,
  ],
  [
    "credential placeholder",
    /\b(?:YOUR|PASTE|REPLACE_WITH|INSERT)_(?:GITHUB_)?(?:PAT|TOKEN|SECRET|API_KEY)\b/i,
  ],
  [
    "GitHub token literal",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/,
  ],
  ["provider key literal", /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  [
    "embedded private catalog",
    /(?:window\.|globalThis\.)?(?:PRIVATE_CATALOG|RESEARCH_RECORDS)\s*=\s*(?:\[|\{)/,
  ],
];

async function exists(target) {
  try {
    return await stat(target);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function listFiles(directory, prefix = "") {
  const found = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    assert(
      !item.isSymbolicLink(),
      `Symlink is forbidden in a public artifact: ${prefix}${item.name}`,
    );
    const relative = `${prefix}${item.name}`;
    if (item.isDirectory())
      found.push(
        ...(await listFiles(path.join(directory, item.name), `${relative}/`)),
      );
    else if (item.isFile()) found.push(relative);
    else assert.fail(`Unsupported public artifact entry: ${relative}`);
  }
  return found.sort();
}

function checkEmptyCatalog(bytes, label) {
  const catalog = JSON.parse(bytes.toString("utf8"));
  assert.equal(
    catalog.schema_version,
    "atlas-catalog-v0.2",
    `${label}: unsupported catalog version`,
  );
  const allowedKeys = new Set([
    "schema_version",
    "project",
    "data_policy",
    "archive_scope",
    "generated_utc",
    "records",
    "nodes",
    "edges",
    "review_queue",
    "source_archives",
    "statistics",
    "index_errors",
    "inventory",
    "semantic_review",
    "duplicates",
    "raw_entries",
    "sessions",
  ]);
  assert(
    Object.keys(catalog).every((key) => allowedKeys.has(key)),
    `${label}: unexpected field may contain private data`,
  );
  for (const key of ["records", "nodes", "edges", "review_queue"]) {
    assert(Array.isArray(catalog[key]), `${label}: ${key} must be an array`);
    assert.equal(
      catalog[key].length,
      0,
      `${label}: ${key} must contain zero private records`,
    );
  }
  assert(
    catalog.source_archives &&
      typeof catalog.source_archives === "object" &&
      !Array.isArray(catalog.source_archives),
    `${label}: source_archives object required`,
  );
  assert.equal(
    Object.keys(catalog.source_archives).length,
    0,
    `${label}: private source manifests forbidden`,
  );
  for (const key of [
    "inventory",
    "semantic_review",
    "duplicates",
    "raw_entries",
    "sessions",
    "index_errors",
  ]) {
    if (Object.hasOwn(catalog, key)) {
      assert(
        Array.isArray(catalog[key]),
        `${label}: ${key} must be an empty array`,
      );
      assert.equal(catalog[key].length, 0, `${label}: ${key} must be empty`);
    }
  }
  if (catalog.statistics)
    assert(
      Object.values(catalog.statistics).every((value) => value === 0),
      `${label}: public statistics must all be zero`,
    );
}

function checkBrowserText(text, label) {
  for (const [name, pattern] of forbiddenClientPatterns)
    assert(!pattern.test(text), `${label}: forbidden ${name}`);
}

async function auditBrowser(directory) {
  if (!(await exists(directory))) return 0;
  let files = 0;
  for (const relative of await listFiles(directory)) {
    if (/\.(?:html?|[cm]?js)$/i.test(relative)) {
      checkBrowserText(
        await readFile(path.join(directory, relative), "utf8"),
        `${path.relative(repo, directory)}/${relative}`,
      );
      files++;
    }
    if (/\.json$/i.test(relative)) {
      const value = JSON.parse(
        await readFile(path.join(directory, relative), "utf8"),
      );
      if (Object.hasOwn(value, "records"))
        checkEmptyCatalog(Buffer.from(JSON.stringify(value)), relative);
    }
  }
  return files;
}

async function auditPages(directory) {
  const files = await listFiles(directory);
  assert.deepEqual(
    files,
    [...allowedPages].sort(),
    "Pages must contain exactly the five public allowlisted files; no cloud sources, manifests, secrets or private blobs",
  );
  checkEmptyCatalog(
    await readFile(path.join(directory, "data/merged.json")),
    "generated Pages catalog",
  );
  await auditBrowser(directory);
}

function auditTrackedPaths() {
  let files;
  try {
    files = execFileSync("git", ["ls-files", "-z"], {
      cwd: repo,
      encoding: "utf8",
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    throw new Error(
      "Public source audit requires the actual Git checkout; refusing an unverifiable source inventory",
    );
  }
  for (const file of files) {
    assert(
      !/(?:^|\/)(?:\.env(?:\..*)?|\.vercel\/|\.state\/)/i.test(file) ||
        /\.env\.example$/.test(file),
      `Tracked environment/session/project state forbidden: ${file}`,
    );
    assert(
      !/(?:^|\/)(?:snapshots|tao-compact|evidence|private-blobs)(?:\/|$)/i.test(
        file,
      ),
      `Private payload directory forbidden: ${file}`,
    );
    assert(
      !/(?:^|\/)(?:CURRENT|SHA256SUMS(?:\.txt)?|(?:RANCHO|TAO)_ARCHIVE_MANIFEST\.json|TAO_RESEARCH_INDEX\.jsonl|derived-reviewed\.json)$/i.test(
        file,
      ),
      `Private manifest/catalog forbidden: ${file}`,
    );
    assert(
      !/\.(?:zip|bundle|pem|p12|pfx|key)$/i.test(file),
      `Private archive/key payload forbidden: ${file}`,
    );
  }
  return files.length;
}

async function buildAuditPages(directory) {
  await mkdir(path.join(directory, "data"), { recursive: true });
  for (const file of ["index.html", "app.js", "style.css"])
    await writeFile(
      path.join(directory, file),
      await readFile(path.join(repo, "web", file)),
    );
  await writeFile(
    path.join(directory, "data/merged.json"),
    JSON.stringify({
      schema_version: "atlas-catalog-v0.2",
      data_policy: "PUBLIC_SOFTWARE_ONLY_NO_PRIVATE_RECORDS",
      records: [],
      nodes: [],
      edges: [],
      review_queue: [],
      source_archives: {},
    }),
  );
  await writeFile(path.join(directory, ".nojekyll"), "");
}

async function withScratch(callback) {
  const base = path.resolve(tmpdir());
  const directory = await mkdtemp(
    path.join(base, "research-atlas-public-audit-"),
  );
  try {
    return await callback(directory);
  } finally {
    assert.equal(
      path.dirname(path.resolve(directory)),
      base,
      "Scratch cleanup escaped intended temporary root",
    );
    assert(path.basename(directory).startsWith("research-atlas-public-audit-"));
    await rm(directory, { recursive: true, force: true });
  }
}

async function selfTest() {
  let rejected = 0;
  const empty = {
    schema_version: "atlas-catalog-v0.2",
    records: [],
    nodes: [],
    edges: [],
    review_queue: [],
    source_archives: {},
  };
  checkEmptyCatalog(Buffer.from(JSON.stringify(empty)), "empty fixture");
  for (const invalid of [
    { ...empty, records: [{ id: "private-fixture" }] },
    { ...empty, source_archives: { private: {} } },
    { ...empty, statistics: { count: 1 } },
    { ...empty, privateCatalog: { title: "private-fixture" } },
  ]) {
    assert.throws(() =>
      checkEmptyCatalog(
        Buffer.from(JSON.stringify(invalid)),
        "negative fixture",
      ),
    );
    rejected++;
  }
  for (const text of [
    'const key = "GITHUB_CLIENT_SECRET";',
    'const token = "YOUR_GITHUB_TOKEN";',
    `const token = "ghp_${"A".repeat(40)}";`,
  ]) {
    assert.throws(() => checkBrowserText(text, "negative browser fixture"));
    rejected++;
  }
  await withScratch(async (directory) => {
    await buildAuditPages(directory);
    await auditPages(directory);
    await writeFile(path.join(directory, "private-manifest.json"), "{}");
    await assert.rejects(() => auditPages(directory));
    rejected++;
  });
  console.log(
    `Public audit self-test passed: ${rejected} unsafe fixtures rejected`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--self-test") return selfTest();
  assert(
    args.length === 0 || (args.length === 2 && args[0] === "--site"),
    "Usage: audit-public.mjs [--site <Pages artifact directory> | --self-test]",
  );
  const tracked = auditTrackedPaths();
  checkEmptyCatalog(
    await readFile(path.join(repo, "data/catalog.json")),
    "public data/catalog.json",
  );
  const browserFiles =
    (await auditBrowser(path.join(repo, "web"))) +
    (await auditBrowser(path.join(repo, "cloud/public")));
  if (args[0] === "--site") await auditPages(path.resolve(args[1]));
  else
    await withScratch(async (directory) => {
      await buildAuditPages(directory);
      await auditPages(directory);
    });
  console.log(
    `Public audit passed: ${tracked} tracked paths, ${browserFiles} browser source files, empty source/catalog and five-file Pages artifact; no deployment or private data access`,
  );
}

main().catch((error) => {
  console.error(`Public audit failed: ${error.message}`);
  process.exitCode = 1;
});
