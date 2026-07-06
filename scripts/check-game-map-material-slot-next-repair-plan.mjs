import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const planPath = path.resolve(process.argv[2] ?? ".runtime/ai-painter/game-map-material-slot-next-repair-plan/latest.json")
const failures = []

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function resolveProjectFile(value) {
  if (typeof value !== "string" || !value.trim()) return null
  return path.isAbsolute(value) ? value : path.resolve(cwd, value)
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

function main() {
  check(fs.existsSync(planPath), `下一轮材料槽修复计划不存在：${planPath}`)
  if (failures.length) return finish(null)

  const plan = readJson(planPath)
  check(plan.schemaVersion === "game-map-material-slot-next-repair-plan-v1", "schemaVersion 必须正确")
  check(plan.status === "ready_for_v47_visual_delta_repair", "计划状态必须是 ready_for_v47_visual_delta_repair")
  check(typeof plan.runId === "string" && plan.runId.length > 0, "runId 必须存在")
  check(typeof plan.sourceArchiveRunId === "string" && plan.sourceArchiveRunId.length > 0, "必须记录来源训练档案")
  check(fs.existsSync(resolveProjectFile(plan.sourceVisualDeltaReview) ?? ""), "来源视觉差距复盘必须存在")
  check(fs.existsSync(resolveProjectFile(plan.sourceMaterialQualityReport) ?? ""), "来源材料质量报告必须存在")
  check(Array.isArray(plan.targetSlots) && plan.targetSlots.length >= 1, "必须包含目标材料槽")
  check(Array.isArray(plan.targetSummary?.targetCategories) && plan.targetSummary.targetCategories.length >= 1, "必须包含目标训练类别")
  check(Array.isArray(plan.categoryTrainingPlan) && plan.categoryTrainingPlan.length === plan.targetSummary.targetCategories.length, "训练类别计划必须与目标类别一致")
  check(Array.isArray(plan.recommendedCommands) && plan.recommendedCommands.length >= 5, "必须包含推荐执行命令")
  check(typeof plan.assembleCommand === "string" && plan.assembleCommand.includes("assemble-game-map-material-slot-v44-model-root.mjs"), "必须包含组装命令")
  check(plan.acceptance?.materialQualityMustPass === true, "必须要求材料质量通过")
  check(plan.acceptance?.archiveMustIncludeVisualDeltaReview === true, "必须要求训练档案继续包含复盘")
  check(plan.acceptance?.ownerReviewRequired === true, "必须要求人工复核")

  finish(plan)
}

function finish(plan) {
  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: "game_map_material_slot_next_repair_plan_check_failed",
          planPath,
          failures,
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: "game_map_material_slot_next_repair_plan_check_passed",
        planPath,
        runId: plan.runId,
        sourceArchiveRunId: plan.sourceArchiveRunId,
        targetSlotCount: plan.targetSlots.length,
        targetCategories: plan.targetSummary.targetCategories,
      },
      null,
      2,
    ),
  )
}

main()
