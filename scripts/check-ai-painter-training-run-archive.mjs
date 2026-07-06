import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const defaultManifestPath = path.join(cwd, ".runtime", "ai-painter", "training-run-archive", "latest.json")

const manifestPath = path.resolve(cwd, process.argv[2] ?? defaultManifestPath)
const failures = []

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function check(condition, message) {
  if (!condition) failures.push(message)
}

function resolveProjectFile(value) {
  if (typeof value !== "string" || !value.trim()) return null
  return path.isAbsolute(value) ? value : path.resolve(cwd, value)
}

function fileExists(value) {
  const filePath = resolveProjectFile(value)
  return Boolean(filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile())
}

function directoryExists(value) {
  const directoryPath = resolveProjectFile(value)
  return Boolean(directoryPath && fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory())
}

function countFiles(value) {
  const directoryPath = resolveProjectFile(value)
  if (!directoryPath || !fs.existsSync(directoryPath)) return 0
  const stack = [directoryPath]
  let count = 0
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(fullPath)
      if (entry.isFile()) count += 1
    }
  }
  return count
}

function readTextIfExists(value) {
  const filePath = resolveProjectFile(value)
  if (!filePath || !fs.existsSync(filePath)) return ""
  return fs.readFileSync(filePath, "utf8")
}

function main() {
  check(fs.existsSync(manifestPath), `训练档案 manifest 不存在：${manifestPath}`)
  if (failures.length) return finish()

  const manifest = readJson(manifestPath)
  check(manifest.schemaVersion === "ai-painter-training-run-archive-v1", "schemaVersion 必须是 ai-painter-training-run-archive-v1")
  check(typeof manifest.runId === "string" && manifest.runId.length > 0, "runId 必须存在")
  check(typeof manifest.action === "string" && manifest.action.length > 0, "action 必须存在")
  check(typeof manifest.startedAt === "string" && manifest.startedAt.length > 0, "startedAt 必须存在")
  check(typeof manifest.finishedAt === "string" && manifest.finishedAt.length > 0, "finishedAt 必须存在")

  check(fileExists(manifest.referenceBaseline?.archivedImage), "必须归档参考基准图")
  check(fileExists(manifest.output?.archivedCompositeOutput), "必须归档完整合成图")
  check(directoryExists(manifest.inference?.archivedMaterialDir), "必须归档材料槽图片目录")
  check(countFiles(manifest.inference?.archivedMaterialDir) >= 1, "材料槽图片目录必须包含文件")

  check(fileExists(manifest.quality?.archivedMaterialQualityReport), "必须归档材料质量报告")
  check(fileExists(manifest.quality?.archivedFormalVisualJudge), "必须归档 Formal VisualJudge 报告")
  check(fileExists(manifest.visualDeltaReview?.archivedReport), "必须归档视觉差距复盘报告")
  check(fileExists(manifest.output?.archivedApprovedPack), "必须归档 Approved Material Pack")
  check(fileExists(manifest.output?.archivedRuntimeFrameCandidate), "必须归档 RuntimeFrame 候选记录")
  check(fileExists(manifest.training?.archivedDatasetSummary), "必须归档数据集 summary")
  check(fileExists(manifest.training?.categories?.grass?.archivedSummary), "必须归档 grass 训练 summary")
  check(fileExists(manifest.training?.categories?.road?.archivedSummary), "必须归档 road 训练 summary")
  check(fileExists(manifest.model?.archivedModelManifest), "必须归档模型合并清单")

  check(manifest.quality?.materialPassed === true, "材料质量必须记录为通过")
  check(manifest.quality?.formalVisualJudgePassed === true, "Formal VisualJudge 必须记录为通过")
  check(manifest.manualReview?.required === true, "必须记录需要项目所有者人工复核")
  check(manifest.manualReview?.status === "pending_owner_review", "人工复核状态必须是 pending_owner_review")
  check(manifest.output?.compositeImageMeta?.width === 1024, "完整合成图宽度必须是 1024")
  check(manifest.output?.compositeImageMeta?.height === 768, "完整合成图高度必须是 768")
  check(
    typeof manifest.visualDeltaReview?.priorityIssueCount === "number" &&
      manifest.visualDeltaReview.priorityIssueCount >= 1,
    "视觉差距复盘必须记录至少一个优先修复问题",
  )
  check(
    Array.isArray(manifest.visualDeltaReview?.targetSlots) && manifest.visualDeltaReview.targetSlots.length >= 1,
    "视觉差距复盘必须记录下一轮目标材料槽",
  )

  const manifestText = JSON.stringify(manifest)
  const visualDeltaText = readTextIfExists(manifest.visualDeltaReview?.archivedReport)
  const mojibakePattern = new RegExp(
    String.fromCharCode(0x953f, 0x6d93, 0x7cb9, 0x6d74, 0x7281, 0x308, 0x6fe1, 0x693b, 0x5053),
  )
  check(!mojibakePattern.test(manifestText + visualDeltaText), "训练档案不能包含常见中文乱码字符")

  finish(manifest)
}

function finish(manifest) {
  if (failures.length > 0) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: "ai_painter_training_run_archive_check_failed",
          manifestPath,
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
        status: "ai_painter_training_run_archive_check_passed",
        manifestPath,
        runId: manifest.runId,
        action: manifest.action,
        materialFiles: countFiles(manifest.inference?.archivedMaterialDir),
        manualReview: manifest.manualReview,
      },
      null,
      2,
    ),
  )
}

main()
