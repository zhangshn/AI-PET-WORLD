import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { appendAiPainterProgramEvent, formatShanghai, writeJsonAtomic } from "./lib/ai-painter-program-event-store.mjs"
import { indexArtifact } from "./lib/ai-pet-world-storage-catalog.mjs"
import { logicalProjectPath } from "./lib/ai-pet-world-storage.mjs"

const ROOT = process.cwd()
const runId = "20260823-030433697"
const output = path.resolve(ROOT, `.runtime/ai-painter/stage4-controlled-structure-arm-gpu-qualification-successes/${runId}`)
const terminal = path.join(output, "phase-terminal.json")
if (!fs.existsSync(terminal)) throw new Error("bound_success_terminal_missing")
const recordPath = path.join(output, "governance-recorder-parent-namespace-repair.json")
if (fs.existsSync(recordPath)) throw new Error("repair_record_already_exists")
const sha = (value) => crypto.createHash("sha256").update(fs.readFileSync(value)).digest("hex")
const relative = (value) => path.relative(ROOT, value).replace(/\\/g, "/")
const now = new Date().toISOString()
writeJsonAtomic(recordPath, {
  schemaVersion: "stage4-controlled-structure-gpu-success-governance-recorder-repair-v1",
  status: "local_governance_recorder_parent_namespace_repaired",
  initialFailure: { errorCode: "ENOENT", operation: "create_combined_success_run_directory", qualificationImpact: "none", gpuRerun: false },
  repair: "create_missing_registered_parent_namespace_before immutable run directory",
  boundSuccessTerminal: { path: relative(terminal), sha256: sha(terminal) },
  recordedAtUtc: now,
  recordedAtAsiaShanghai: formatShanghai(now),
})
const stat = fs.statSync(recordPath)
indexArtifact({ logicalPath: logicalProjectPath(recordPath), physicalUri: fs.realpathSync(recordPath), storageLayer: "hot", runId, artifactType: "local_governance_recorder_repair", byteSize: stat.size, modifiedAtUtc: stat.mtime.toISOString(), sha256: sha(recordPath) })
appendAiPainterProgramEvent({
  id: `stage4-controlled-structure-gpu-success-recorder-repair-${runId}`,
  timestamp: now,
  action: "stage4_controlled_structure_gpu_success_governance_recorder_repair",
  runId,
  kind: "local_governance_recorder_repair",
  status: "success",
  title: "Stage4 GPU success recorder parent namespace repair recorded",
  titleZh: "Stage4 GPU成功收尾记录器父命名空间修复已登记",
  detailZh: "首次合并记录因父命名空间不存在而未写入；最小修正后成功，未重跑GPU且不影响两臂资格证据。",
  evidencePath: relative(recordPath),
  evidenceSha256: sha(recordPath),
  fixedTotalProgress: { completedStages: 3, totalStages: 5, percent: 60 },
})
console.log(JSON.stringify({ status: "governance_recorder_repair_recorded", record: { path: relative(recordPath), sha256: sha(recordPath) } }, null, 2))
