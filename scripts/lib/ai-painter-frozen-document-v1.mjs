import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const FROZEN_AI_PAINTER_SPECIFICATION = Object.freeze({
  schemaVersion: "ai-painter-frozen-specification-v1",
  version: "AI-PAINTER-SPEC-1.60",
  path: "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  archivePath: "data/ai-painter/system-governance/document-baselines/ai-painter-spec-1.60-a88d9351.txt",
  sha256: "a88d93514264f8b6c24bcc5f60e87189ba8df1f9f13848030fb0ee9e2ace35cc",
  byteSize: 247500,
  purpose: "historical_review",
  executionAllowed: false,
  qualificationGranted: false,
});

function identity(stat) {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.nlink].map(String);
}

function directoryChain(target) {
  const directories = [];
  for (let directory = path.dirname(target);; directory = path.dirname(directory)) {
    const stat = fs.lstatSync(directory, { bigint: true });
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(),
      "frozen specification ancestor must be a plain directory");
    directories.push({ directory, dev: stat.dev, ino: stat.ino });
    if (path.dirname(directory) === directory) break;
  }
  return directories;
}

function plainFile(stat) {
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n,
    "frozen specification must be a plain single-link file");
  assert.equal(stat.size, BigInt(FROZEN_AI_PAINTER_SPECIFICATION.byteSize),
    "frozen specification byte size mismatch");
}

/** Historical evidence only. Never resolves caller-supplied document bindings. */
export function readFrozenAiPainterSpecification(root, options) {
  assert.ok(options && typeof options === "object" && !Array.isArray(options),
    "historical_review purpose is required");
  assert.deepEqual(Object.keys(options), ["purpose"], "unsupported historical review option");
  assert.equal(options.purpose, "historical_review", "historical_review purpose is required");
  assert.ok(typeof root === "string" && path.isAbsolute(root), "absolute project root required");
  const projectRoot = path.resolve(root);
  const target = path.join(projectRoot, ...FROZEN_AI_PAINTER_SPECIFICATION.archivePath.split("/"));
  const directories = directoryChain(target);
  const before = fs.lstatSync(target, { bigint: true });
  plainFile(before);
  const handle = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  let bytes;
  try {
    const opened = fs.fstatSync(handle, { bigint: true });
    plainFile(opened);
    assert.deepEqual(identity(opened), identity(before), "frozen specification replaced before read");
    bytes = Buffer.alloc(FROZEN_AI_PAINTER_SPECIFICATION.byteSize);
    for (let offset = 0; offset < bytes.length;) {
      const count = fs.readSync(handle, bytes, offset, bytes.length - offset, offset);
      assert.ok(count > 0, "frozen specification truncated during read");
      offset += count;
    }
    const extra = Buffer.alloc(1);
    assert.equal(fs.readSync(handle, extra, 0, 1, bytes.length), 0,
      "frozen specification grew during read");
    const afterHandle = fs.fstatSync(handle, { bigint: true });
    const afterPath = fs.lstatSync(target, { bigint: true });
    plainFile(afterHandle);
    plainFile(afterPath);
    assert.deepEqual(identity(afterHandle), identity(opened), "frozen specification changed during read");
    assert.deepEqual(identity(afterPath), identity(opened), "frozen specification replaced during read");
    for (const directory of directories) {
      const current = fs.lstatSync(directory.directory, { bigint: true });
      assert.ok(current.isDirectory() && !current.isSymbolicLink()
        && current.dev === directory.dev && current.ino === directory.ino,
      "frozen specification ancestor changed during read");
    }
    assert.equal(createHash("sha256").update(bytes).digest("hex"),
      FROZEN_AI_PAINTER_SPECIFICATION.sha256, "frozen specification SHA-256 mismatch");
  } finally {
    fs.closeSync(handle);
  }
  const binding = Object.freeze({ path: FROZEN_AI_PAINTER_SPECIFICATION.path,
    sha256: FROZEN_AI_PAINTER_SPECIFICATION.sha256, byteSize: bytes.length });
  const archiveBinding = Object.freeze({ ...binding,
    path: FROZEN_AI_PAINTER_SPECIFICATION.archivePath });
  return { bytes, metadata: Object.freeze({ ...FROZEN_AI_PAINTER_SPECIFICATION,
    originalBinding: binding, archiveBinding }), executionAllowed: false, qualificationGranted: false };
}
