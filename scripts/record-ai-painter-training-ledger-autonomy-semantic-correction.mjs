import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  appendAiPainterProgramEvent,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";

const runId = "training-ledger-autonomy-semantics-v2-20260827";
const recordedAtUtc = new Date().toISOString();
const record = {
  schemaVersion: "ai-painter-training-ledger-autonomy-semantic-correction-v1",
  status: "corrected_for_future_projection",
  supersededSemantic:
    "final_map_requires_project_owner_per_run_final_review",
  currentSemantic:
    "released_capability_machine_gates_and_atomic_world_write_without_per_run_owner_review",
  historicalEventsMutated: false,
  ownerAuthorizationRequired: false,
  recordedAtUtc,
};
const materialized = writeImmutableProgramRun({
  root: ".runtime/ai-painter/training-ledger-semantic-corrections",
  runId,
  fileName: "correction.json",
  record,
});
const absolute = path.resolve(materialized.runPath);
const sha256 = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
appendAiPainterProgramEvent({
  id: `training-ledger-autonomy-semantics-corrected-${runId}`,
  timestamp: recordedAtUtc,
  action: "training_ledger_autonomy_semantics_corrected",
  runId,
  kind: "governance_semantic_correction",
  status: "success",
  title: "Training ledger autonomy semantics corrected",
  titleZh: "训练事件账本已切换到本地机器发布语义",
  detailZh:
    "历史事件保持不可变；未来投影不再要求Owner逐次人工终审，正式发布由本地程序重算能力身份并执行机器闸门。",
  evidencePath: materialized.runPath,
  evidenceSha256: sha256,
});
console.log(JSON.stringify({ status: "recorded", ...materialized, sha256 }, null, 2));
