import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const inputPackRoot = path.resolve(process.argv[2] ?? ".runtime/game-map-material-input-packs")
const outputRoot = path.resolve(process.argv[3] ?? ".runtime/game-map-material-slot-inference-runs")
const inferenceCommand = process.env.AI_PAINTER_SLOT_INFERENCE_COMMAND

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

function writeReport(report, reportPath = null) {
  if (reportPath) {
    writeJson(reportPath, report)
  }
  console.log(JSON.stringify(report, null, 2))
}

function findLatestInputPackIndex(root) {
  if (!fs.existsSync(root)) return null
  const stack = [root]
  const matches = []
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.name === "latest-material-input-pack.json") {
        matches.push(fullPath)
      }
    }
  }
  matches.sort()
  return matches.at(-1) ?? null
}

function safeTimestamp(value) {
  return value.replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "")
}

function verifyMaterialOutputs(slots, materialDir) {
  const missing = []
  const files = []
  for (const slot of slots) {
    const expectedPath = path.join(materialDir, slot.expectedOutputFileName)
    if (!fs.existsSync(expectedPath)) {
      missing.push(slot.expectedOutputFileName)
    } else {
      files.push({
        slotId: slot.slotId,
        path: expectedPath,
        bytes: fs.statSync(expectedPath).size,
      })
    }
  }
  return { missing, files }
}

function main() {
  const latestIndexPath = findLatestInputPackIndex(inputPackRoot)
  if (!latestIndexPath) {
    writeReport({
      ok: false,
      status: "blocked_material_input_pack_missing",
      inputPackRoot,
      outputRoot,
      blockedReasons: ["latest_material_input_pack_missing"],
      tags: ["game_map_material_slot_inference", "blocked"],
    })
    return
  }

  const latestIndex = readJson(latestIndexPath)
  const packPath = path.resolve(latestIndex.path ?? "")
  if (!latestIndex.path || !fs.existsSync(packPath)) {
    writeReport({
      ok: false,
      status: "blocked_material_input_pack_file_missing",
      latestIndexPath,
      packPath,
      outputRoot,
      blockedReasons: ["material_input_pack_file_missing"],
      tags: ["game_map_material_slot_inference", "blocked"],
    })
    return
  }

  const pack = readJson(packPath)
  const createdAt = new Date().toISOString()
  const runId = `material-slot-inference-${pack.worldId}-${pack.tick}-${safeTimestamp(createdAt)}`
  const runRoot = path.join(outputRoot, pack.worldId, String(pack.tick), runId)
  const materialDir = path.join(runRoot, "materials")
  const reportPath = path.join(runRoot, "latest.json")
  fs.mkdirSync(materialDir, { recursive: true })

  const expectedOutputs = {
    schemaVersion: "game-map-material-slot-inference-expected-outputs-v1",
    runId,
    packId: pack.packId,
    requestId: pack.requestId,
    worldId: pack.worldId,
    tick: pack.tick,
    materialDir,
    requiredFiles: pack.slots.map((slot) => ({
      slotId: slot.slotId,
      unitKind: slot.unitKind,
      conditionMaskPath: slot.conditionMaskPath,
      taskPath: slot.taskPath,
      outputFileName: slot.expectedOutputFileName,
      outputPath: path.join(materialDir, slot.expectedOutputFileName),
    })),
    tags: [
      "game_map_material_slot_inference_contract",
      "local_model_outputs_required",
      "not_world_page_runtime",
      "not_program_render",
    ],
  }
  writeJson(path.join(runRoot, "expected-material-outputs.json"), expectedOutputs)

  if (!inferenceCommand) {
    writeReport(
      {
        ok: false,
        status: "blocked_local_model_slot_inference_command_missing",
        runId,
        packPath,
        materialDir,
        slotCount: pack.slots.length,
        blockedReasons: ["AI_PAINTER_SLOT_INFERENCE_COMMAND_missing"],
        note: "This step refuses to draw placeholder materials. Set AI_PAINTER_SLOT_INFERENCE_COMMAND to a local model command that writes every required slotId.png into materialDir.",
        tags: ["game_map_material_slot_inference", "blocked", "no_program_placeholder"],
      },
      reportPath
    )
    return
  }

  const startedAt = Date.now()
  const child = spawnSync(inferenceCommand, {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      AI_PAINTER_MATERIAL_INPUT_PACK: packPath,
      AI_PAINTER_MATERIAL_OUTPUT_DIR: materialDir,
      AI_PAINTER_EXPECTED_OUTPUTS: path.join(runRoot, "expected-material-outputs.json"),
    },
  })
  const durationMs = Date.now() - startedAt
  const verification = verifyMaterialOutputs(pack.slots, materialDir)
  const passed = child.status === 0 && verification.missing.length === 0
  writeReport(
    {
      ok: passed,
      status: passed ? "material_slot_inference_completed" : "blocked_material_slot_outputs_incomplete",
      runId,
      packPath,
      materialDir,
      slotCount: pack.slots.length,
      generatedCount: verification.files.length,
      missingCount: verification.missing.length,
      missingFiles: verification.missing,
      durationMs,
      commandExitCode: child.status,
      tags: passed
        ? ["game_map_material_slot_inference", "completed", "ready_for_approved_material_pack"]
        : ["game_map_material_slot_inference", "blocked"],
    },
    reportPath
  )
}

main()
