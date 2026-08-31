import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureStage4V2MachineTicketIssuer,
} from "../lib/ai-painter-stage4-v2-readonly-gpu-ticket-v1.mjs";

const protector = {
  scheme: "fixture_copy_machine_protector_v1",
  protect: (bytes) => Buffer.from(bytes),
  unprotect: (bytes) => Buffer.from(bytes),
};

for (const hook of [
  "afterIssuerPublicKeyStaged",
  "afterIssuerPrivateKeyStaged",
  "afterIssuerRecordStaged",
  "afterIssuerDirectoryPublished",
]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stage4-v2-qualification-issuer-"));
  const machineKeyRoot = ".runtime/ai-painter/machine-keys/qualification-issuer-fixture";
  const directory = path.join(root, ...machineKeyRoot.split("/"));
  const staging = `${directory}.staging`;
  try {
    assert.throws(() => ensureStage4V2MachineTicketIssuer({
      projectRoot: root,
      machineKeyRoot,
      keyProtector: protector,
      _testHooks: {
        [hook]() {
          throw new Error(`injected:${hook}`);
        },
      },
    }), new RegExp(`injected:${hook}`, "u"));

    if (hook === "afterIssuerDirectoryPublished") {
      assert.equal(fs.existsSync(directory), true,
        "final publication crash did not leave the complete atomic issuer");
      assert.equal(fs.existsSync(staging), false,
        "final publication crash exposed both staging and published issuer");
    } else {
      assert.equal(fs.existsSync(directory), false,
        `${hook} exposed a partially published qualification issuer`);
      assert.equal(fs.existsSync(staging), true,
        `${hook} did not preserve a recoverable private staging namespace`);
    }
    const stagedPublic = fs.existsSync(path.join(staging, "public-key.pem"))
      ? fs.readFileSync(path.join(staging, "public-key.pem"), "utf8")
      : null;
    const recovered = ensureStage4V2MachineTicketIssuer({
      projectRoot: root,
      machineKeyRoot,
      keyProtector: protector,
    });
    assert.equal(fs.existsSync(staging), false,
      `${hook} left an issuer staging namespace after recovery`);
    for (const file of ["issuer.json", "public-key.pem", "private-key.pkcs8.dpapi"]) {
      assert.equal(fs.existsSync(path.join(directory, file)), true,
        `${hook} recovery omitted ${file}`);
    }
    if (hook === "afterIssuerRecordStaged") {
      assert.equal(fs.readFileSync(path.join(directory, "public-key.pem"), "utf8"),
        stagedPublic,
        "complete qualification issuer staging was regenerated instead of atomically published");
    }
    const repeated = ensureStage4V2MachineTicketIssuer({
      projectRoot: root,
      machineKeyRoot,
      keyProtector: protector,
    });
    assert.deepEqual(repeated.issuerBinding, recovered.issuerBinding,
      `${hook} recovery did not return the exact published issuer`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

process.stdout.write(
  "Stage4 V2 readonly-GPU qualification issuer publication: 4 crash-prefix recoveries passed.\n",
);
