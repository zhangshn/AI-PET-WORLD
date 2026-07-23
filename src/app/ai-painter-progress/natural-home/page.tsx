import { readFile, readdir, stat } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import { listConditionalRgbGenerationAttempts } from "@/server/ai-painter-conditional-rgb-generation-records"
import { listIndexedChildDirectories, listLatestIndexedArtifacts } from "@/server/ai-pet-world-storage-catalog"
import styles from "../page.module.css"
import { TrainingRecordSelector } from "./training-record-selector"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "完整世界地图训练 | AI-PET-WORLD",
}

type PageProps = {
  searchParams?: Promise<{ run?: string }>
}

type TrainingRecord = {
  id: string
  name: string
  kind: string
  path: string
  modifiedAt: string
  status: string
  evidence: string[]
  previewImages: string[]
  summaryLines: string[]
}

type PipelineStage = {
  id: string
  order: number
  title: string
  status: "saved" | "ready" | "blocked" | "missing" | "running"
  statusText: string
  summary: string
  storagePath: string
  updatedAt: string
  evidence: string[]
  images: string[]
  nextAction: string
}

type JsonRecord = Record<string, unknown>

let broadAiPainterDirectoryRead: Promise<Array<{ entry: { name: string }; absolutePath: string; modifiedAtMs: number }>> | null = null

export default async function NaturalHomePage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const records = await readTrainingRecords()
  const selectedIndex =
    records.find((record) => record.id === params.run) ??
    records[0] ??
    null
  const selectedRecord = selectedIndex ? await hydrateTrainingRecord(selectedIndex) : null
  const pipeline = await buildPipelineLedgerView(records)
  const selectedCompleteImages = selectedRecord?.previewImages.filter(
    (imagePath) => isCompleteMapImage(imagePath) || selectedRecord.kind === "完整地图训练样本",
  ) ?? []
  const selectedEvidenceImages = selectedRecord?.previewImages.filter(
    (imagePath) => !selectedCompleteImages.includes(imagePath),
  ) ?? []

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">
          返回训练主页
        </Link>
        <p className={styles.kicker}>WORLD MAP / TRAINING DATA</p>
        <h1>完整世界地图训练</h1>
        <p>
          本页固定按正式游戏地图流水线展示：世界数据字典、世界导演层、地图结构/语义层、材料与过渡层、物体摆放层、完整地图合成、机器审核、失败回写、下一轮训练。页面只读取并展示程序自动保存的数据，不把局部样本当成完整地图结果。
        </p>
        <dl className={styles.metrics}>
          <Metric label="自动记录总数" value={`${records.length}`} />
          <Metric label="当前选择" value={selectedRecord?.name ?? "--"} />
          <Metric label="记录类型" value={selectedRecord?.kind ?? "--"} />
          <Metric label="阶段台账" value={pipeline.ledgerPath} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>TIME SEARCH</p>
        <h2>按时间搜索训练内容</h2>
        <TrainingRecordSelector
          records={records.map((record) => ({
            id: record.id,
            label: `${formatDate(record.modifiedAt)} / ${record.kind} / ${record.status} / ${record.name}`,
          }))}
          selectedId={selectedRecord?.id ?? ""}
        />
        <p className={styles.note}>
          下拉框选择一条自动保存记录后，只展示该记录对应内容。完整地图图像会进入主展示；局部训练样本只进入证据图，不作为完整地图验收结果。
        </p>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>FIXED WORLD MAP PIPELINE</p>
        <h2>完整地图阶段进度</h2>
        <p className={styles.note}>
          每个阶段都对应一个自动保存路径和证据文件。局部 crop 只会出现在材料/过渡或训练输入证据里；完整地图主结果只看 RuntimeFrame、composite-output 或正式候选图。
        </p>
        <section className={styles.stageGrid}>
          {pipeline.stages.map((stage) => (
            <Link
              className={styles.stageCard}
              href={`/ai-painter-progress/natural-home/stages/${stage.id}`}
              key={stage.id}
            >
              <div className={styles.stageTitle}>
                <h2>{stage.order}. {stage.title}</h2>
                <span data-danger={stage.status === "blocked" || stage.status === "missing"}>
                  {stage.statusText}
                </span>
              </div>
              <p>{stage.summary}</p>
              <small>更新时间：{formatDate(stage.updatedAt)}</small>
              <small>自动保存：{stage.storagePath}</small>
              <small>证据：{stage.evidence.length ? stage.evidence.join(" / ") : "暂无证据文件"}</small>
              <small>下一步：{stage.nextAction}</small>
              {stage.images[0] ? (
                <img
                  src={`/api/ai-painter/training-data-image?path=${encodeURIComponent(stage.images[0])}`}
                  alt={stage.title}
                />
              ) : null}
            </Link>
          ))}
        </section>
      </section>

      {selectedRecord ? (
        <section className={styles.panel}>
          <p className={styles.kicker}>SELECTED TRAINING RECORD</p>
          <h2>{selectedRecord.name}</h2>
          <dl className={styles.metrics}>
            <Metric label="Timestamp" value={selectedRecord.modifiedAt} />
            <Metric label="北京时间" value={formatDate(selectedRecord.modifiedAt)} />
            <Metric label="类型" value={selectedRecord.kind} />
            <Metric label="状态" value={selectedRecord.status} />
            <Metric label="完整地图图" value={`${selectedCompleteImages.length}`} />
            <Metric label="证据图" value={`${selectedEvidenceImages.length}`} />
          </dl>

          {selectedCompleteImages[0] ? (
            <section className={styles.featurePreview}>
              <article className={styles.resultCard}>
                <span className={selectedRecord.status === "world_page_ready" ? styles.pass : styles.fail}>
                  完整地图候选图
                </span>
                <h2>{path.basename(selectedCompleteImages[0])}</h2>
                <p>
                  UTC: <strong>{selectedRecord.modifiedAt}</strong>
                  <br />
                  北京时间: <strong>{formatDate(selectedRecord.modifiedAt)}</strong>
                  <br />
                  程序审查: <strong>{selectedRecord.status}</strong>
                  <br />
                  人工验收: <strong>未审核</strong>
                </p>
                <p>
                  <code>{selectedCompleteImages[0]}</code>
                </p>
                <img
                  src={`/api/ai-painter/training-data-image?path=${encodeURIComponent(selectedCompleteImages[0])}`}
                  alt={selectedCompleteImages[0]}
                />
              </article>
            </section>
          ) : (
            <section className={styles.featurePreview}>
              <article className={styles.resultCard}>
                <span className={styles.fail}>NO COMPLETE MAP IMAGE</span>
                {selectedRecord.kind === "条件 RGB 生成尝试" ? (
                  <>
                    <h2>生成失败，未产生图片</h2>
                    <p>程序已经自动保存本次失败尝试。失败码、生成路线、时间戳和证据文件均保留在下方，不得伪造图片补齐记录。</p>
                  </>
                ) : (
                  <>
                    <h2>本记录不是完整地图主结果</h2>
                    <p>
                      这条记录可能是数据集、局部材料训练、模型 checkpoint 或失败诊断。它会作为流水线证据保留，但不能作为完整游戏地图通过。
                    </p>
                  </>
                )}
              </article>
            </section>
          )}

          <div className={styles.qualityList}>
            <article>
              <strong>自动保存路径</strong>
              <span>{selectedRecord.path}</span>
              <small>证据文件：{selectedRecord.evidence.length ? selectedRecord.evidence.join(" / ") : "未发现摘要文件，但目录已存在"}</small>
            </article>
            {selectedRecord.summaryLines.map((line) => (
              <article key={line}>
                <strong>{line}</strong>
              </article>
            ))}
          </div>

          <section className={styles.resultGrid}>
            {selectedEvidenceImages.length ? (
              selectedEvidenceImages.map((imagePath) => (
                <article className={styles.resultCard} key={imagePath}>
                  <span className={styles.pass}>阶段证据图，不是完整地图结果</span>
                  <h2>{path.basename(imagePath)}</h2>
                  <small>Timestamp: {selectedRecord.modifiedAt}</small>
                  <small>Record: {selectedRecord.name}</small>
                  <p>
                    <code>{imagePath}</code>
                  </p>
                  <img
                    src={`/api/ai-painter/training-data-image?path=${encodeURIComponent(imagePath)}`}
                    alt={imagePath}
                  />
                </article>
              ))
            ) : (
              <article className={styles.resultCard}>
                <span className={styles.fail}>NO EVIDENCE IMAGE</span>
                <h2>这条记录没有图片证据</h2>
                <p>训练日志、模型文件、manifest 或审核报告仍然属于自动保存数据。</p>
              </article>
            )}
          </section>
        </section>
      ) : (
        <section className={styles.panel}>
          <p>没有读取到自动保存训练记录。</p>
        </section>
      )}
    </main>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  )
}

async function buildPipelineLedgerView(records: TrainingRecord[]) {
  const stages = await buildPipelineStages(records)
  const ledgerRoot = ".runtime/ai-painter/admin-console/world-map-pipeline"
  return {
    stages,
    ledgerPath: `${ledgerRoot}/latest.json`,
  }
}

async function buildPipelineStages(records: TrainingRecord[]): Promise<PipelineStage[]> {
  const latestRuntime = records.find((record) => record.kind === "FORMAL RUNTIME FRAME")
  const latestInference = records.find((record) => record.kind === "材料推理")
  const latestDataset = records.find((record) => record.kind === "WORLD MAP DATASET")
  const latestTraining = records.find((record) => record.kind === "WORLD MAP TRAINING")
  const latestRepair = records.find((record) => record.kind === "自动执行")
  const latestArchive = records.find((record) => record.kind === "训练归档")
  const runtimeBoundImage = latestRuntime?.previewImages.find(isCompleteMapImage) ?? null
  const latestCompositeImage = await latestFileRecord(
    ".runtime/game-map-runtime-compositor/world-d0znz8/0",
    (name) => name.endsWith("composite-output.png"),
  )
  const latestFullMapImage = runtimeBoundImage
    ?? latestInference?.previewImages.find(isCompleteMapImage)
    ?? latestCompositeImage?.path
    ?? null
  const formalJudge = await latestFileRecord(
    ".runtime/game-map-runtime-compositor/world-d0znz8/0",
    (name) => name.endsWith("formal-visual-judge.json"),
  )
  const machineJudge = formalJudge ? await readJsonFile<JsonRecord>(path.join(process.cwd(), formalJudge.path)) : null
  const machinePassed = booleanValue(machineJudge?.passed)
  const dictionaryEvidence = await existingPaths([
    "docs/world-visual-data-dictionary/FULL_DICTIONARY_PRINT.md",
    "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
  ])
  const directorEvidence = await existingPaths([
    "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    ".runtime/ai-painter/world-visual-generation-task-packages/latest.json",
  ])
  const structureEvidence = await existingPaths([
    "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md",
    ".runtime/game-map-runtime-frame/latest-runtime-frame.json",
    ".runtime/game-map-material-input-packs/world-d0znz8/0/latest.json",
  ])
  const transitionEvidence = uniqueStrings([
    ...(await existingPaths([
      "docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md",
    ])),
    ...(latestDataset ? [latestDataset.path] : []),
    ...(latestTraining ? [latestTraining.path] : []),
  ])
  const objectEvidence = await existingPaths([
    "data/world-visual-data-dictionary/source/mvp-natural-home-v0.3-source.json",
    ".runtime/game-map-runtime-frame/latest-runtime-frame.json",
  ])
  const compositeEvidence = uniqueStrings([
    ...(latestRuntime ? [latestRuntime.path] : []),
    ...(latestInference ? [latestInference.path] : []),
    ...(latestCompositeImage ? [latestCompositeImage.path] : []),
  ])
  const reviewEvidence = uniqueStrings([
    ...(formalJudge ? [formalJudge.path] : []),
    ...(await existingPaths([
      "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
    ])),
  ])
  const failureEvidence = await existingPaths([
    ".runtime/ai-painter/auto-visual-judge-learning/latest.json",
    "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
  ])
  const nextTrainingEvidence = uniqueStrings([
    ...(latestRepair ? [latestRepair.path] : []),
    ...(latestArchive ? [latestArchive.path] : []),
    ...(await existingPaths([
      ".runtime/ai-painter/training-control/state.json",
      "docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md",
    ])),
  ])

  return [
    makeStage(1, "world-dictionary", "世界数据字典", dictionaryEvidence.length ? "saved" : "missing", "类地球自然地图的事实、视觉标准、失败码和专业审美规则。", "docs/game-world-generation + docs/world-visual-data-dictionary", dictionaryEvidence, [], "继续保持为后续阶段的只读依据。"),
    makeStage(2, "world-director", "世界导演层", directorEvidence.length ? "saved" : "missing", "定义完整地图应该有什么、在哪里、比例关系如何，而不是直接画一张图。", "docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md", directorEvidence, [], "把导演输出绑定到每轮完整地图候选。"),
    makeStage(3, "map-structure-semantics", "地图结构/语义层", structureEvidence.length ? "saved" : "missing", "保存完整地图的结构、语义、空间关系和 RuntimeFrame 输入，不等于局部 crop。", ".runtime/game-map-runtime-frame", structureEvidence, [], "继续让结构层驱动合成，不让局部素材反客为主。"),
    makeStage(4, "material-transition", "材料与过渡层", transitionEvidence.length ? "saved" : "missing", "保存草地、水体、岸线、道路、材料模型和过渡训练证据；这里允许出现局部图。", ".runtime/ai-painter + .runtime/game-map-material-slot-inference-runs", transitionEvidence, latestDataset?.previewImages.slice(0, 1) ?? [], "补足过渡样本，避免草、水、路互相污染。"),
    makeStage(5, "object-placement", "物体摆放层", objectEvidence.length ? "saved" : "missing", "保存树、石头、花草等物体与地面的摆放关系，不能漂浮、不能遮挡路线。", ".runtime/game-map-runtime-frame", objectEvidence, [], "把物体摆放从合成图中独立检查出来。"),
    makeStage(6, "complete-map-composite", "完整地图合成", runtimeBoundImage ? "saved" : "blocked", completeMapCompositeSummary(Boolean(latestFullMapImage), Boolean(runtimeBoundImage)), ".runtime/game-map-runtime-compositor + .runtime/game-map-runtime-frame", compositeEvidence, latestFullMapImage ? [latestFullMapImage] : [], "完整地图必须绑定到 RuntimeFrame，并继续通过机器审核和人工终审。"),
    makeStage(7, "machine-review", "机器审核", machinePassed ? "ready" : "blocked", machinePassed ? "机器审核记录显示通过，仍需人工终审。" : "机器审核未通过或缺少正式通过记录。", ".runtime/game-map-runtime-compositor/world-d0znz8/0/*formal-visual-judge.json", reviewEvidence, [], machinePassed ? "等待项目所有者人工终审。" : "把漏判和失败原因写回失败经验。"),
    makeStage(8, "failure-backwrite", "失败回写", failureEvidence.length ? "saved" : "missing", "保存失败原因、漏判记录、负样本和下一轮训练约束。", ".runtime/ai-painter/auto-visual-judge-learning", failureEvidence, [], "失败记录必须进入下一轮训练任务。"),
    makeStage(9, "next-training", "下一轮训练", nextTrainingEvidence.length ? "saved" : "missing", "根据失败回写和数据缺口生成下一轮训练任务，而不是自由继续画。", ".runtime/ai-painter/training-control + repair-plan-runs", nextTrainingEvidence, [], "下一轮优先补完整地图正样本、过渡样本和失败负样本。"),
  ]
}

function completeMapCompositeSummary(hasImage: boolean, runtimeBound: boolean) {
  if (runtimeBound) return "当前 RuntimeFrame 已绑定完整地图合成图，但不代表通过人工终审。"
  if (hasImage) return "已有历史完整地图合成图，但当前 RuntimeFrame 未绑定可展示主图，因此仍然阻断。"
  return "当前没有可作为主图展示的完整地图候选图。"
}

function makeStage(
  order: number,
  id: string,
  title: string,
  status: PipelineStage["status"],
  summary: string,
  storagePath: string,
  evidence: string[],
  images: string[],
  nextAction: string,
): PipelineStage {
  return {
    id,
    order,
    title,
    status,
    statusText: stageStatusText(status),
    summary,
    storagePath,
    updatedAt: new Date().toISOString(),
    evidence: uniqueStrings(evidence),
    images: uniqueStrings(images),
    nextAction,
  }
}

function stageStatusText(status: PipelineStage["status"]) {
  const labels: Record<PipelineStage["status"], string> = {
    saved: "已保存",
    ready: "机器通过",
    blocked: "阻断",
    missing: "缺失",
    running: "运行中",
  }
  return labels[status]
}

async function readTrainingRecords(): Promise<TrainingRecord[]> {
  const groups = await Promise.all([
    readCurrentRuntimeFrameRecord(),
    readMaterialSlotDatasetRecords(),
    readMaterialSlotTrainingRecords(),
    readArchiveRecords(),
    readMaterialInferenceRecords(),
    readRepairPlanRunRecords(),
    readFoundationInferenceRecords(),
    readFoundationMachineReviewRecords(),
    readFoundationBatchRecords(),
    readWorldVisualTaskRecords(),
    readCompleteMapDatasetPackageRecords(),
    readCompleteMapSampleRecords(),
    readConditionalRgbGenerationAttemptRecords(),
    readAiAssistedConditionalInferenceValidationRecords(),
    readAiAssistedConditionalInferenceFailureRecords(),
  ])
  const byId = new Map<string, TrainingRecord>()
  for (const record of groups.flat()) byId.set(record.id, record)
  return [...byId.values()].sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt))
}

async function readAiAssistedConditionalInferenceValidationRecords() {
  const records = await readDirectoryRecords(
    ".runtime/ai-painter/ai-assisted-conditional-inference-validation",
    "AI\u8f85\u52a9\u6761\u4ef6\u63a8\u7406\u9a8c\u8bc1",
    /^ai-assisted-conditional-inference-validation-v\d+-/,
  )
  const completedRecords: TrainingRecord[] = []
  for (const record of records) {
    const artifacts = listLatestIndexedArtifacts(record.path, 500)
    const manifestArtifact = artifacts?.find((artifact) => artifact.name === "manifest.json")
    if (!manifestArtifact) continue
    const manifest = await readJsonFile<JsonRecord>(path.join(process.cwd(), manifestArtifact.path))
    if (!manifest) continue
    completedRecords.push({
      ...record,
      modifiedAt: stringValue(manifest.createdAtUtc) ?? record.modifiedAt,
      status: stringValue(manifest.status) ?? record.status,
    })
  }
  return completedRecords
}

async function readAiAssistedConditionalInferenceFailureRecords(): Promise<TrainingRecord[]> {
  const root = ".runtime/ai-painter/ai-assisted-conditional-inference-validation/failures"
  const artifacts = listLatestIndexedArtifacts(root, 500)
  if (!artifacts) return []
  const records: TrainingRecord[] = []
  for (const artifact of artifacts) {
    if (artifact.name === "latest.json" || !artifact.name.endsWith(".json")) continue
    const json = await readJsonFile<JsonRecord>(path.join(process.cwd(), artifact.path))
    if (!json) continue
    const failureCodes = stringArrayValue(json.blockers)
    const outputImagePath = stringValue(json.outputImagePath)
    const timestampUtc = stringValue(json.timestampUtc) ?? artifact.modifiedAt
    records.push({
      id: artifact.path,
      name: stringValue(json.runId) ?? path.basename(artifact.name, ".json"),
      kind: "AI\u8f85\u52a9\u6761\u4ef6\u63a8\u7406\u5931\u8d25",
      path: artifact.path,
      modifiedAt: timestampUtc,
      status: stringValue(json.status) ?? "failed",
      evidence: [artifact.path],
      previewImages: outputImagePath ? [outputImagePath] : [],
      summaryLines: [
        `runId: ${stringValue(json.runId) ?? "--"}`,
        `conditionLabel: ${stringValue(json.conditionLabel) ?? "--"}`,
        `failureCodes: ${failureCodes.length ? failureCodes.join(", ") : "--"}`,
        `candidateGenerated: ${String(booleanValue(json.candidateGenerated) ?? false)}`,
        `exitCode: ${numberValue(json.exitCode) ?? "--"}`,
        `UTC: ${timestampUtc}`,
        `\u5317\u4eac\u65f6\u95f4: ${stringValue(json.timestampAsiaShanghai) ?? "--"}`,
        `automaticStorage: ${String(booleanValue(json.automaticStorage) ?? false)}`,
      ],
    })
    if (records.length >= 80) break
  }
  return records
}

async function readConditionalRgbGenerationAttemptRecords(): Promise<TrainingRecord[]> {
  const attempts = await listConditionalRgbGenerationAttempts()
  return attempts.map((attempt) => ({
        id: attempt.evidencePath,
        name: attempt.outputRecordId,
        kind: "条件 RGB 生成尝试",
        path: attempt.evidencePath,
        modifiedAt: attempt.createdAtUtc,
        status: attempt.status,
        evidence: [attempt.evidencePath],
        previewImages: attempt.generatedImagePath ? [attempt.generatedImagePath] : [],
        summaryLines: [
          `attemptId: ${attempt.attemptId}`,
          `requestId: ${attempt.requestId}`,
          `failureCode: ${attempt.failureCode}`,
          `failureMessage: ${attempt.failureMessage}`,
          `attemptedRoute: ${attempt.attemptedRoute}`,
          `UTC: ${attempt.createdAtUtc}`,
          `北京时间: ${attempt.createdAtAsiaShanghai}`,
          `generatedImageCreated: ${String(attempt.generatedImageCreated)}`,
          `automaticStorage: ${String(attempt.automaticStorage)}`,
        ],
      }))
}

async function readCurrentRuntimeFrameRecord(): Promise<TrainingRecord[]> {
  const relativePath = ".runtime/game-map-runtime-frame/latest-runtime-frame.json"
  const absolutePath = path.join(process.cwd(), relativePath)
  const json = await readJsonFile<JsonRecord>(absolutePath)
  if (!json) return []
  const meta = await stat(absolutePath)
  const createdAt = stringValue(json.createdAt) ?? meta.mtime.toISOString()
  const recordId = stringValue(json.recordId) ?? "latest-runtime-frame"
  const runtimeFrame = objectValue(json.runtimeFrame)
  const composition = objectValue(runtimeFrame?.composition)
  const compositeOutput = objectValue(composition?.compositeOutput)
  const compositionStatus = objectValue(composition?.compositionStatus)
  const imagePath = normalizeRuntimeImagePath(stringValue(compositeOutput?.imageUrl))
  const canEnterWorld = booleanValue(compositionStatus?.canEnterWorld)
  return [
    {
      id: relativePath,
      name: recordId,
      kind: "FORMAL RUNTIME FRAME",
      path: relativePath,
      modifiedAt: createdAt,
      status: canEnterWorld ? "world_page_ready" : "blocked",
      evidence: [
        "latest-runtime-frame.json",
        ".runtime/game-map-runtime-compositor/world-d0znz8/0/formal-visual-judge.json",
      ],
      previewImages: imagePath ? [imagePath] : [],
      summaryLines: [
        `recordId: ${recordId}`,
        `createdAt: ${createdAt}`,
        `canEnterWorld: ${canEnterWorld === null ? "--" : String(canEnterWorld)}`,
      ],
    },
  ]
}

async function readArchiveRecords() {
  return readDirectoryRecords(".runtime/ai-painter/training-run-archive", "训练归档", /^game-map-material-slot-/)
}

async function readMaterialSlotDatasetRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter",
    "WORLD MAP DATASET",
    /^game-map-material-slot-v\d+-repair-dataset$/,
  )
}

async function readMaterialSlotTrainingRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter",
    "WORLD MAP TRAINING",
    /^natural-home-local-detail-v\d+-.*training$/,
  )
}

async function readMaterialInferenceRecords() {
  return readDirectoryRecords(
    ".runtime/game-map-material-slot-inference-runs/world-d0znz8/0",
    "材料推理",
    /^material-slot-inference-/,
  )
}

async function readRepairPlanRunRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter/game-map-material-slot-next-repair-plan-runs",
    "自动执行",
    /^game-map-material-slot-/,
  )
}

async function readFoundationInferenceRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter/complete-world-visual-bootstrap-inference",
    "完整地图模型推理",
    /^(foundation-bootstrap-complete-map-|bootstrap-complete-map-)/,
  )
}

async function readFoundationMachineReviewRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter/complete-world-visual-machine-reviews",
    "完整地图机器审核",
    /^bootstrap-machine-review-/,
  )
}

async function readFoundationBatchRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter/complete-world-visual-foundation-batches",
    "完整地图自动候选批次",
    /^foundation-candidate-batch-/,
  )
}

async function readWorldVisualTaskRecords() {
  return readDirectoryRecords(
    ".runtime/ai-painter/world-visual-generation-task-packages",
    "完整地图任务包",
    /^world-visual-task-/,
  )
}

async function readCompleteMapDatasetPackageRecords() {
  return readDirectoryRecords(
    "data/world-samples/dataset-packages",
    "完整地图数据包",
    /^natural-home-complete-map-/,
  )
}

async function readCompleteMapSampleRecords(): Promise<TrainingRecord[]> {
  const dictionaryPointer = await readJsonFile<JsonRecord>(
    path.join(process.cwd(), "data/world-visual-data-dictionary/latest.json"),
  )
  const dictionaryVersionId = stringValue(dictionaryPointer?.dictionaryVersionId)
  if (!dictionaryVersionId) return []
  const relativeRoot = `data/world-samples/registry/${dictionaryVersionId}/records`
  const absoluteRoot = path.join(process.cwd(), relativeRoot)
  try {
    const entries = await readdir(absoluteRoot, { withFileTypes: true })
    const candidates = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue
      const absolutePath = path.join(absoluteRoot, entry.name)
      const info = await stat(absolutePath)
      candidates.push({ entry, absolutePath, modifiedAtMs: info.mtimeMs })
    }
    candidates.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
    const records: TrainingRecord[] = []
    for (const candidate of candidates.slice(0, 80)) {
      const json = await readJsonFile<JsonRecord>(candidate.absolutePath)
      if (!json) continue
      const relativePath = `${relativeRoot}/${candidate.entry.name}`
      const imagePath = stringValue(json.imagePath)
      const createdAt = stringValue(json.createdAtUtc) ?? new Date(candidate.modifiedAtMs).toISOString()
      records.push({
        id: relativePath,
        name: stringValue(json.sampleId) ?? candidate.entry.name,
        kind: "完整地图训练样本",
        path: relativePath,
        modifiedAt: createdAt,
        status: stringValue(json.sampleType) ?? "saved",
        evidence: [candidate.entry.name],
        previewImages: imagePath ? [imagePath] : [],
        summaryLines: [
          `sampleType: ${stringValue(json.sampleType) ?? "--"}`,
          `trainingUsage: ${stringValue(json.trainingUsage) ?? "--"}`,
          `machineReviewStatus: ${stringValue(json.machineReviewStatus) ?? "--"}`,
          `ownerReviewStatus: ${stringValue(json.ownerReviewStatus) ?? "--"}`,
        ],
      })
    }
    return records
  } catch {
    return []
  }
}

async function readDirectoryRecords(root: string, kind: string, pattern: RegExp): Promise<TrainingRecord[]> {
  const absoluteRoot = path.join(process.cwd(), root)
  try {
    const indexedEntries = root === ".runtime/ai-painter" ? null : listIndexedChildDirectories(root, 500)
    const candidates = root === ".runtime/ai-painter"
      ? (await readBroadAiPainterDirectoryCandidates(absoluteRoot)).filter((entry) => pattern.test(entry.entry.name))
      : indexedEntries
        ? indexedEntries
          .filter((entry) => pattern.test(entry.name))
          .map((entry) => ({
            entry: { name: entry.name },
            absolutePath: path.join(absoluteRoot, entry.name),
            modifiedAtMs: Date.parse(entry.modifiedAt),
          }))
        : await readDirectoryCandidates(absoluteRoot, kind, pattern)
    candidates.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
    const visibleCandidates = candidates.slice(0, 80)

    const records: TrainingRecord[] = []
    for (const candidate of visibleCandidates) {
      const relativePath = path.join(root, candidate.entry.name).replace(/\\/g, "/")
      records.push({
        id: relativePath,
        name: candidate.entry.name,
        kind,
        path: relativePath,
        modifiedAt: new Date(candidate.modifiedAtMs).toISOString(),
        status: "saved",
        evidence: [],
        previewImages: [],
        summaryLines: [],
      })
    }
    return records
  } catch {
    return []
  }
}

async function readBroadAiPainterDirectoryCandidates(absoluteRoot: string) {
  if (!broadAiPainterDirectoryRead) {
    broadAiPainterDirectoryRead = (async () => {
      const entries = await readdir(absoluteRoot, { withFileTypes: true })
      const directories = entries.filter((entry) => entry.isDirectory())
      return Promise.all(directories.map(async (entry) => {
        const absolutePath = path.join(absoluteRoot, entry.name)
        const meta = await stat(absolutePath)
        return { entry: { name: entry.name }, absolutePath, modifiedAtMs: meta.mtimeMs }
      }))
    })().finally(() => {
      broadAiPainterDirectoryRead = null
    })
  }
  return broadAiPainterDirectoryRead
}

async function readDirectoryCandidates(absoluteRoot: string, kind: string, pattern: RegExp) {
  const entries = await readdir(absoluteRoot, { withFileTypes: true })
  const candidates = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !pattern.test(entry.name)) continue
    const absolutePath = path.join(absoluteRoot, entry.name)
    const meta = await stat(absolutePath)
    const modifiedAtMs = kind.startsWith("WORLD MAP")
      ? await latestFileMtimeMs(absolutePath, meta.mtimeMs)
      : meta.mtimeMs
    candidates.push({ entry: { name: entry.name }, absolutePath, modifiedAtMs })
  }
  return candidates
}

async function latestFileMtimeMs(absolutePath: string, fallback: number) {
  let latest = fallback
  const candidates = [
    "dataset-summary.json",
    "training-summary.json",
    "manifest.json",
    "machine-review.json",
    "batch.json",
    "task-package.json",
    "model-report.json",
    "run-report.json",
    "latest.json",
    "material-quality-report.json",
    "latest-material-quality-report.json",
    "combined-model-root-manifest.json",
    "grass/training-summary.json",
    "grass/training-log.jsonl",
    "grass/latest.pt",
    "grass/best.pt",
    "road/training-summary.json",
    "road/training-log.jsonl",
    "road/latest.pt",
    "road/best.pt",
    "reports/material-quality-report.json",
    "reports/formal-visual-judge.json",
    "reports/visual-delta-review.json",
  ]
  for (const candidate of candidates) {
    try {
      const info = await stat(path.join(absolutePath, candidate))
      latest = Math.max(latest, info.mtimeMs)
    } catch {
      // Optional evidence file.
    }
  }
  return latest
}

async function hydrateTrainingRecord(record: TrainingRecord): Promise<TrainingRecord> {
  const absolutePath = path.join(process.cwd(), record.path)
  const summary = record.summaryLines.length ? null : await readRecordSummary(absolutePath)
  const indexedArtifacts = listLatestIndexedArtifacts(record.path, 500)
  const indexedEvidence = indexedArtifacts?.filter((artifact) => !isPreviewImage(artifact.path)).slice(0, 32) ?? []
  const indexedImages = indexedArtifacts?.filter((artifact) => isPreviewImage(artifact.path)).slice(0, 18) ?? []
  const evidence = uniqueStrings([
    ...record.evidence,
    ...(indexedArtifacts?.length
      ? indexedEvidence.map((artifact) => artifact.path)
      : await collectEvidenceFiles(absolutePath)),
  ])
  const previewImages = uniqueStrings([
    ...record.previewImages,
    ...(indexedArtifacts?.length
      ? indexedImages.map((artifact) => artifact.path)
      : await collectPreviewImages(absolutePath, record.path)),
    ...(indexedArtifacts?.length ? [] : await collectReferencedImages(absolutePath)),
  ])
  return {
    ...record,
    status: summary?.status ?? record.status,
    summaryLines: summary?.lines ?? record.summaryLines,
    evidence,
    previewImages,
  }
}

async function readRecordSummary(absolutePath: string) {
  const candidates = [
    "manifest.json",
    "machine-review.json",
    "batch.json",
    "task-package.json",
    "model-report.json",
    "run-report.json",
    "material-quality-report.json",
    "latest-material-quality-report.json",
    "latest.json",
    "dataset-summary.json",
    "training-summary.json",
    "combined-model-root-manifest.json",
  ]
  for (const candidate of candidates) {
    const json = await readJsonFile<JsonRecord>(path.join(absolutePath, candidate))
    if (!json) continue
    return summarizeJson(candidate, json)
  }
  return { status: "saved", lines: ["目录已自动保存"] }
}

async function collectReferencedImages(absolutePath: string) {
  const candidates = ["manifest.json", "machine-review.json", "batch.json", "task-package.json", "model-report.json"]
  const images: string[] = []
  for (const candidate of candidates) {
    const json = await readJsonFile<unknown>(path.join(absolutePath, candidate))
    if (!json) continue
    for (const value of collectStringValues(json)) {
      const imagePath = normalizeProjectImagePath(value)
      if (!imagePath || !isPreviewImage(imagePath)) continue
      if (await fileExists(path.join(process.cwd(), imagePath))) images.push(imagePath)
      if (images.length >= 18) return uniqueStrings(images)
    }
  }
  return uniqueStrings(images)
}

function collectStringValues(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(collectStringValues)
  if (!value || typeof value !== "object") return []
  return Object.values(value as JsonRecord).flatMap(collectStringValues)
}

function normalizeProjectImagePath(value: string) {
  const normalized = value.replace(/\\/g, "/")
  const cwd = process.cwd().replace(/\\/g, "/")
  if (normalized.startsWith(`${cwd}/`)) return normalized.slice(cwd.length + 1)
  if (normalized.startsWith(".runtime/") || normalized.startsWith("data/")) return normalized
  return null
}

function summarizeJson(fileName: string, json: JsonRecord) {
  const status = stringValue(json.status) ?? (booleanValue(json.passed) === false ? "failed" : "saved")
  const machineReviewIssueCodes = stringArrayValue(json.machineReviewIssueCodes)
  const lines = [
    `${fileName}: ${status}`,
    stringValue(json.runId) ? `runId: ${stringValue(json.runId)}` : null,
    stringValue(json.conditionLabel) ? `conditionLabel: ${stringValue(json.conditionLabel)}` : null,
    stringValue(json.sourceSplit) ? `sourceSplit: ${stringValue(json.sourceSplit)}` : null,
    stringValue(json.machineReviewStatus) ? `machineReviewStatus: ${stringValue(json.machineReviewStatus)}` : null,
    machineReviewIssueCodes.length ? `machineReviewIssueCodes: ${machineReviewIssueCodes.join(", ")}` : null,
    stringValue(json.outputImageSha256) ? `outputImageSha256: ${stringValue(json.outputImageSha256)}` : null,
    stringValue(json.modelCheckpointSha256) ? `modelCheckpointSha256: ${stringValue(json.modelCheckpointSha256)}` : null,
    stringValue(json.createdAtUtc) ? `UTC: ${stringValue(json.createdAtUtc)}` : null,
    stringValue(json.createdAtAsiaShanghai) ? `\u5317\u4eac\u65f6\u95f4: ${stringValue(json.createdAtAsiaShanghai)}` : null,
    booleanValue(json.automaticStorage) !== null ? `automaticStorage: ${String(booleanValue(json.automaticStorage))}` : null,
    numberValue(json.materialCount) !== null ? `materialCount: ${numberValue(json.materialCount)}` : null,
    numberValue(json.slotCount) !== null ? `slotCount: ${numberValue(json.slotCount)}` : null,
    summarizeQuality(json),
  ].filter((line): line is string => Boolean(line))
  return { status, lines }
}

function summarizeQuality(json: JsonRecord) {
  const summary = json.summary
  if (!summary || typeof summary !== "object") return null
  const row = summary as JsonRecord
  const passedCount = numberValue(row.passedCount)
  const failedCount = numberValue(row.failedCount)
  if (passedCount === null && failedCount === null) return null
  return `quality: passed ${passedCount ?? "--"} / failed ${failedCount ?? "--"}`
}

async function collectEvidenceFiles(absolutePath: string) {
  const candidates = [
    "manifest.json",
    "run-report.json",
    "latest.json",
    "training-summary.json",
    "material-quality-report.json",
    "latest-material-quality-report.json",
    "dataset-summary.json",
    "combined-model-root-manifest.json",
    "grass/training-summary.json",
    "grass/training-log.jsonl",
    "grass/best.pt",
    "grass/latest.pt",
    "road/training-summary.json",
    "road/training-log.jsonl",
    "road/best.pt",
    "road/latest.pt",
    "reports/material-quality-report.json",
    "reports/formal-visual-judge.json",
    "reports/visual-delta-review.json",
    "reports/training-summary-grass.json",
    "reports/training-summary-road.json",
    "models/model-root-manifest.json",
  ]
  const evidence: string[] = []
  for (const candidate of candidates) {
    if (await fileExists(path.join(absolutePath, candidate))) evidence.push(candidate)
  }
  return evidence
}

async function collectPreviewImages(absolutePath: string, relativePath: string) {
  const images: string[] = []
  const candidates = [
    "images/composite-output.png",
    "images/reference-baseline.png",
    "images/materials/slot-terrain-terrain-terrain-current-grass-main.png",
    "images/materials/slot-terrain-path-corridor-path-current-entry-to-home.png",
    "images/materials/slot-terrain-path-corridor-path-current-home-to-water.png",
    "images/materials/slot-terrain-terrain-terrain-current-water-east.png",
    "images/materials/slot-terrain-terrain-terrain-current-shoreline-east.png",
    "materials/slot-terrain-terrain-terrain-current-grass-main.png",
    "materials/slot-terrain-path-corridor-path-current-entry-to-home.png",
    "materials/slot-terrain-path-corridor-path-current-home-to-water.png",
    "materials/slot-terrain-terrain-terrain-current-water-east.png",
    "materials/slot-terrain-terrain-terrain-current-shoreline-east.png",
    "contact-sheet.png",
    "candidate.png",
    "candidate-native-768x576.png",
    "controlnet-seg-condition.png",
    "generated.png",
    "target.png",
  ]
  for (const candidate of candidates) {
    const absoluteCandidate = path.join(absolutePath, candidate)
    if (await fileExists(absoluteCandidate)) images.push(`${relativePath}/${candidate}`.replace(/\\/g, "/"))
  }
  await appendDirectoryImages(path.join(absolutePath, "images/materials"), `${relativePath}/images/materials`, images)
  await appendDirectoryImages(path.join(absolutePath, "materials"), `${relativePath}/materials`, images)
  await appendNestedSampleImages(absolutePath, relativePath, images)
  return images.sort((left, right) => previewImageRank(left) - previewImageRank(right) || left.localeCompare(right)).slice(0, 18)
}

async function appendDirectoryImages(absolutePath: string, relativePath: string, images: string[]) {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !isPreviewImage(entry.name)) continue
      const imagePath = `${relativePath}/${entry.name}`.replace(/\\/g, "/")
      if (!images.includes(imagePath)) images.push(imagePath)
      if (images.length >= 32) return
    }
  } catch {
    // Optional image folder.
  }
}

async function appendNestedSampleImages(absolutePath: string, relativePath: string, images: string[]) {
  const sampleRoots = [
    "grass/samples",
    "road/samples",
    "water/samples",
    "shoreline/samples",
    "tree/samples",
    "rock/samples",
  ]
  for (const sampleRoot of sampleRoots) {
    await appendSampleTargetImages(
      path.join(absolutePath, sampleRoot),
      `${relativePath}/${sampleRoot}`,
      images,
    )
    if (images.length >= 32) return
  }
}

async function appendSampleTargetImages(absolutePath: string, relativePath: string, images: string[]) {
  try {
    const entries = await readdir(absolutePath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const sampleRelativePath = `${relativePath}/${entry.name}`.replace(/\\/g, "/")
      const sampleAbsolutePath = path.join(absolutePath, entry.name)
      for (const candidate of ["target.png", "masks/grass.png", "masks/road_center.png", "masks/water_body.png", "masks/shoreline.png"]) {
        if (await fileExists(path.join(sampleAbsolutePath, candidate))) {
          images.push(`${sampleRelativePath}/${candidate}`.replace(/\\/g, "/"))
        }
      }
      if (images.length >= 32) return
    }
  } catch {
    // Optional sample folder.
  }
}

async function existingPaths(paths: string[]) {
  const existing: string[] = []
  for (const candidate of paths) {
    if (await fileExists(path.join(process.cwd(), candidate))) existing.push(candidate)
  }
  return existing
}

async function latestFileRecord(root: string, predicate: (name: string) => boolean) {
  const indexed = listLatestIndexedArtifacts(root, 1000)
  if (indexed) {
    const match = indexed.find((candidate) => predicate(candidate.name))
    return match ? { path: match.path, modifiedAtMs: Date.parse(match.modifiedAt) } : null
  }
  const absoluteRoot = path.join(process.cwd(), root)
  const files = await collectFiles(absoluteRoot, root, predicate, 48)
  files.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)
  return files[0] ?? null
}

async function collectFiles(
  absoluteRoot: string,
  relativeRoot: string,
  predicate: (name: string) => boolean,
  limit: number,
  depth = 0,
): Promise<Array<{ path: string; modifiedAtMs: number }>> {
  if (depth > 4 || limit <= 0) return []
  try {
    const entries = await readdir(absoluteRoot, { withFileTypes: true })
    const files: Array<{ path: string; modifiedAtMs: number }> = []
    for (const entry of entries) {
      const absolutePath = path.join(absoluteRoot, entry.name)
      const relativePath = `${relativeRoot}/${entry.name}`.replace(/\\/g, "/")
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(absolutePath, relativePath, predicate, limit - files.length, depth + 1)))
      } else if (entry.isFile() && predicate(entry.name)) {
        const info = await stat(absolutePath)
        files.push({ path: relativePath, modifiedAtMs: info.mtimeMs })
      }
      if (files.length >= limit) break
    }
    return files
  } catch {
    return []
  }
}

async function fileExists(filePath: string) {
  try {
    const info = await stat(filePath)
    return info.isFile()
  } catch {
    return false
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T
  } catch {
    return null
  }
}

function isPreviewImage(filePath: string) {
  return [".png", ".jpg", ".jpeg", ".webp"].includes(path.extname(filePath).toLowerCase())
}

function isCompleteMapImage(imagePath: string) {
  const normalized = imagePath.toLowerCase().replace(/\\/g, "/")
  const name = path.basename(normalized)
  return (
    normalized.includes(".runtime/game-map-runtime-compositor/") ||
    normalized.includes(".runtime/game-map-runtime-frame/") ||
    normalized.includes(".runtime/ai-painter/ai-assisted-conditional-inference-validation/") ||
    normalized.endsWith("composite-output.png") ||
    normalized.includes("/images/composite-output.png") ||
    (normalized.includes("/complete-world-visual-bootstrap-inference/") && name === "candidate.png")
  )
}

function previewImageRank(imagePath: string) {
  const normalized = imagePath.toLowerCase()
  const name = path.basename(normalized)
  if (isCompleteMapImage(imagePath)) return 0
  if (name === "candidate.png") return 1
  if (name === "controlnet-seg-condition.png") return 2
  if (name === "contact-sheet.png") return 1
  if (normalized.includes("slot-terrain-terrain-terrain-current-grass-main")) return 2
  if (normalized.includes("slot-terrain-path")) return 3
  if (normalized.includes("slot-terrain-terrain-terrain-current-water")) return 4
  if (normalized.includes("slot-terrain-terrain-terrain-current-shoreline")) return 5
  if (normalized.includes("/materials/slot-terrain-")) return 6
  if (normalized.includes("/images/materials/slot-terrain-")) return 7
  if (name === "target.png") return 8
  if (name === "generated.png") return 9
  return 20
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length ? value : null
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null
}

function stringArrayValue(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function objectValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null
}

function normalizeRuntimeImagePath(imagePath: string | null) {
  if (!imagePath) return null
  const normalized = imagePath.replace(/\\/g, "/")
  const cwd = process.cwd().replace(/\\/g, "/")
  if (normalized.startsWith(`${cwd}/`)) return normalized.slice(cwd.length + 1)
  if (normalized.startsWith(".runtime/")) return normalized
  return null
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}
