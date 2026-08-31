import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureStage4V2SmokeTicketIssuer,
} from "../lib/ai-painter-stage4-v2-controlled-smoke-ticket-v1.mjs";

const protector = {
  scheme: "fixture_copy_protector_v1",
  protect: (bytes) => Buffer.from(bytes),
  unprotect: (bytes) => Buffer.from(bytes),
};

for (const hook of [
  "afterIssuerPublicKeyStaged",
  "afterIssuerPrivateKeyStaged",
  "afterIssuerRecordStaged",
]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-smoke-issuer-"));
  const machineKeyRoot = ".runtime/machine-keys/smoke-issuer";
  const directory = path.join(root, ...machineKeyRoot.split("/"));
  const staging = `${directory}.staging`;
  try {
    assert.throws(() => ensureStage4V2SmokeTicketIssuer({
      projectRoot: root, machineKeyRoot, keyProtector: protector,
      _testHooks: { [hook]: () => { throw new Error(`injected:${hook}`); } },
    }), new RegExp(`injected:${hook}`, "u"));
    assert.equal(fs.existsSync(directory), false,
      `${hook} exposed a partially published issuer directory`);
    assert.equal(fs.existsSync(staging), true,
      `${hook} did not retain a recoverable private staging directory`);
    const stagedPublic = fs.existsSync(path.join(staging, "public-key.pem"))
      ? fs.readFileSync(path.join(staging, "public-key.pem"), "utf8") : null;
    const recovered = ensureStage4V2SmokeTicketIssuer({
      projectRoot: root, machineKeyRoot, keyProtector: protector,
    });
    assert.equal(fs.existsSync(staging), false,
      `${hook} staging directory remained after recovery`);
    for (const file of ["issuer.json", "public-key.pem", "private-key.pkcs8.dpapi"]) {
      assert.equal(fs.existsSync(path.join(directory, file)), true,
        `${hook} recovery omitted ${file}`);
    }
    if (hook === "afterIssuerRecordStaged") {
      assert.equal(fs.readFileSync(path.join(directory, "public-key.pem"), "utf8"),
        stagedPublic, "complete staged issuer was regenerated instead of atomically published");
    }
    const repeated = ensureStage4V2SmokeTicketIssuer({
      projectRoot: root, machineKeyRoot, keyProtector: protector,
    });
    assert.deepEqual(repeated.issuerBinding, recovered.issuerBinding,
      `${hook} recovery was not idempotent`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

process.stdout.write("Stage4 V2 Smoke issuer atomic publication: 3 staging-prefix crash recoveries passed.\n");
