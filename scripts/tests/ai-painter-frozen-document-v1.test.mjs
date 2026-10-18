import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { FROZEN_AI_PAINTER_SPECIFICATION as frozen,
  readFrozenAiPainterSpecification as read } from "../lib/ai-painter-frozen-document-v1.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const source = read(repositoryRoot, { purpose: "historical_review" }).bytes;

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-painter-frozen-document-"));
  const archive = path.join(root, ...frozen.archivePath.split("/"));
  const live = path.join(root, ...frozen.path.split("/"));
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  fs.mkdirSync(path.dirname(live), { recursive: true });
  fs.writeFileSync(archive, source, { flag: "wx" });
  fs.writeFileSync(live, "new live specification 1.61\n", { flag: "wx" });
  t.after(() => {
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("ai-painter-frozen-document-"));
    assert.ok(!fs.lstatSync(resolved).isSymbolicLink());
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return { root, archive, live, read: () => read(root, { purpose: "historical_review" }) };
}

test("exact archived bytes and both bindings remain independent of the live document", (t) => {
  const f = fixture(t);
  const result = f.read();
  assert.ok(Buffer.isBuffer(result.bytes));
  assert.deepEqual(result.bytes, source);
  assert.deepEqual(result.metadata.originalBinding, {
    path: frozen.path, sha256: frozen.sha256, byteSize: frozen.byteSize,
  });
  assert.deepEqual(result.metadata.archiveBinding, {
    path: frozen.archivePath, sha256: frozen.sha256, byteSize: frozen.byteSize,
  });
  assert.equal(result.executionAllowed, false);
  assert.equal(result.qualificationGranted, false);
  assert.equal(result.metadata.executionAllowed, false);
  assert.equal(result.metadata.qualificationGranted, false);
  fs.writeFileSync(f.live, "entirely different active text\n");
  assert.deepEqual(f.read().bytes, source);
  // Mutating a returned Buffer cannot alter the source or subsequent reads.
  result.bytes[0] ^= 1;
  assert.deepEqual(f.read().bytes, source);
});

test("missing archive never falls back to live bytes, even when live equals the original", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.live, source);
  fs.unlinkSync(f.archive);
  assert.throws(f.read, /ENOENT/);
});

test("same-size archive tampering is rejected by the fixed SHA", (t) => {
  const f = fixture(t);
  const changed = Buffer.from(source);
  changed[changed.length - 1] ^= 1;
  fs.writeFileSync(f.archive, changed);
  assert.throws(f.read, /SHA-256 mismatch/);
});

for (const delta of [-1, 1]) {
  test(`wrong archive size (${delta}) rejects before opening a content handle`, (t) => {
    const f = fixture(t);
    fs.writeFileSync(f.archive, Buffer.alloc(source.length + delta));
    assert.throws(f.read, /byte size mismatch/);
  });
}

test("every non-historical purpose and all caller binding options refuse before I/O", () => {
  for (const purpose of [undefined, null, "", "execution", "training", "admission", "release", "publication", "historical_review ", true, {}]) {
    assert.throws(() => read(path.join(os.tmpdir(), "missing-purpose-fixture"), { purpose }), /purpose is required/);
  }
  for (const options of [undefined, null, [], {}, { purpose: "historical_review", binding: frozen },
    { purpose: "historical_review", archivePath: frozen.archivePath }]) {
    assert.throws(() => read(repositoryRoot, options), /purpose is required|unsupported historical review option/);
  }
});

function duringRead(t, f, mutate) {
  const open = fs.openSync;
  const readSync = fs.readSync;
  const close = fs.closeSync;
  let fd;
  let opens = 0;
  let reads = 0;
  let closes = 0;
  let fired = false;
  let mutating = false;
  // Synchronous tests are serial. The interception is private to this process,
  // targets only the fixture handle, and introduces no production test hooks.
  fs.openSync = (target, ...args) => {
    if (mutating) return open(target, ...args);
    assert.equal(target, f.archive);
    opens++;
    fd = open(target, ...args);
    return fd;
  };
  fs.readSync = (handle, ...args) => {
    assert.equal(handle, fd);
    reads++;
    const count = readSync(handle, ...args);
    if (!fired) {
      fired = true;
      mutating = true;
      try { mutate(); } finally { mutating = false; }
    }
    return count;
  };
  fs.closeSync = (handle) => {
    if (!mutating) { assert.equal(handle, fd); closes++; }
    return close(handle);
  };
  try {
    assert.throws(f.read, /changed during read|replaced during read|byte size mismatch|truncated during read/);
    assert.equal(fired, true);
    assert.equal(opens, 1);
    assert.ok(reads >= 1);
    assert.equal(closes, 1);
  } finally {
    fs.openSync = open;
    fs.readSync = readSync;
    fs.closeSync = close;
  }
}

test("replacement during read refuses even when replacement has exact original bytes", (t) => {
  const f = fixture(t);
  duringRead(t, f, () => {
    fs.renameSync(f.archive, `${f.archive}.retained`);
    fs.writeFileSync(f.archive, source);
  });
});

test("in-place truncation during read refuses and closes the single handle", (t) => {
  const f = fixture(t);
  duringRead(t, f, () => fs.truncateSync(f.archive, source.length - 1));
});

for (const kind of ["file", "ancestor"]) {
  test(`${kind} symbolic link is rejected; inability to create links is explicitly skipped`, (t) => {
    const f = fixture(t);
    const target = kind === "file" ? f.archive : path.dirname(f.archive);
    const retained = `${target}.retained`;
    fs.renameSync(target, retained);
    try {
      fs.symlinkSync(retained, target, kind === "file" ? "file" : process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(error.code)) {
        t.skip(`link creation environment blocked: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(f.read, /plain single-link file|plain directory/);
  });
}
