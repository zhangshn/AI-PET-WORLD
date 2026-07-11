import { readFile } from "node:fs/promises"
import path from "node:path"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import styles from "../../../page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "完整地图阶段详情 | AI-PET-WORLD",
}

type PageProps = {
  params: Promise<{ stageId: string }>
}

type PipelineLedger = {
  schemaVersion?: string
  persistedAt?: string
  snapshotHash?: string
  stages?: PipelineStage[]
}

type StageLedger = {
  schemaVersion?: string
  persistedAt?: string
  snapshotHash?: string
  stage?: PipelineStage
}

type PipelineStage = {
  id: string
  order: number
  title: string
  status: string
  statusText: string
  summary: string
  storagePath: string
  updatedAt: string
  evidence: string[]
  images: string[]
  nextAction: string
}

export default async function WorldMapStagePage({ params }: PageProps) {
  const { stageId } = await params
  const stageLedger = await readStageLedger(stageId)
  const ledger = await readPipelineLedger()
  const stages = ledger.stages ?? []
  const stage = stageLedger.stage ?? stages.find((item) => item.id === stageId)
  if (!stage) notFound()

  const previous = stages.find((item) => item.order === stage.order - 1)
  const next = stages.find((item) => item.order === stage.order + 1)
  const stageLedgerPath = `.runtime/ai-painter/admin-console/world-map-pipeline/stages/${stage.id}/latest.json`

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress/natural-home">
          返回完整世界地图训练
        </Link>
        <p className={styles.kicker}>WORLD MAP PIPELINE / STAGE DETAIL</p>
        <h1>{stage.order}. {stage.title}</h1>
        <p>
          这里是完整地图流水线第三级详情页。内容来自程序自动保存的阶段台账，不由聊天记录替代，不把局部图当成完整地图主结果。
        </p>
        <dl className={styles.metrics}>
          <Metric label="阶段状态" value={stage.statusText} />
          <Metric label="状态码" value={stage.status} />
          <Metric label="更新时间" value={formatDate(stage.updatedAt)} />
          <Metric label="图片数量" value={`${stage.images.length}`} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>STORAGE</p>
        <h2>自动保存与台账</h2>
        <div className={styles.qualityList}>
          <article>
            <strong>阶段自动保存路径</strong>
            <span>{stage.storagePath}</span>
          </article>
          <article>
            <strong>阶段台账</strong>
            <span>{stageLedgerPath}</span>
            <small>schema: {stageLedger.schemaVersion ?? "--"} / persistedAt: {formatDate(stageLedger.persistedAt)} / hash: {stageLedger.snapshotHash ?? "--"}</small>
          </article>
          <article>
            <strong>总台账</strong>
            <span>.runtime/ai-painter/admin-console/world-map-pipeline/latest.json</span>
            <small>schema: {ledger.schemaVersion ?? "--"} / persistedAt: {formatDate(ledger.persistedAt)} / hash: {ledger.snapshotHash ?? "--"}</small>
          </article>
          <article>
            <strong>阶段说明</strong>
            <span>{stage.summary}</span>
            <small>下一步：{stage.nextAction}</small>
          </article>
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>EVIDENCE</p>
        <h2>证据文件</h2>
        <div className={styles.qualityList}>
          {stage.evidence.length ? (
            stage.evidence.map((evidencePath) => (
              <article key={evidencePath}>
                <strong>{path.basename(evidencePath)}</strong>
                <span>{evidencePath}</span>
              </article>
            ))
          ) : (
            <article>
              <strong>暂无证据文件</strong>
              <span>该阶段还没有程序自动保存的证据路径。</span>
            </article>
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>IMAGES</p>
        <h2>阶段图片</h2>
        <section className={styles.resultGrid}>
          {stage.images.length ? (
            stage.images.map((imagePath) => (
              <article className={styles.resultCard} key={imagePath}>
                <span className={isCompleteMapImage(imagePath) ? styles.pass : styles.fail}>
                  {isCompleteMapImage(imagePath) ? "完整地图候选图" : "阶段证据图，不是完整地图结果"}
                </span>
                <h2>{path.basename(imagePath)}</h2>
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
              <span className={styles.fail}>NO IMAGE</span>
              <h2>本阶段没有图片</h2>
              <p>这不代表阶段没有保存数据；文档、manifest、审核 JSON、模型文件也属于程序自动保存证据。</p>
            </article>
          )}
        </section>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>NAVIGATION</p>
        <h2>阶段切换</h2>
        <div className={styles.stageActions}>
          {previous ? (
            <Link href={`/ai-painter-progress/natural-home/stages/${previous.id}`}>
              上一阶段：{previous.title}
            </Link>
          ) : (
            <button disabled>已经是第一阶段</button>
          )}
          {next ? (
            <Link href={`/ai-painter-progress/natural-home/stages/${next.id}`}>
              下一阶段：{next.title}
            </Link>
          ) : (
            <button disabled>已经是最后阶段</button>
          )}
        </div>
      </section>
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

async function readStageLedger(stageId: string): Promise<StageLedger> {
  const filePath = path.join(
    process.cwd(),
    ".runtime",
    "ai-painter",
    "admin-console",
    "world-map-pipeline",
    "stages",
    stageId,
    "latest.json",
  )
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as StageLedger
  } catch {
    return {}
  }
}

async function readPipelineLedger(): Promise<PipelineLedger> {
  const filePath = path.join(
    process.cwd(),
    ".runtime",
    "ai-painter",
    "admin-console",
    "world-map-pipeline",
    "latest.json",
  )
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as PipelineLedger
  } catch {
    return { stages: [] }
  }
}

function isCompleteMapImage(imagePath: string) {
  const normalized = imagePath.toLowerCase().replace(/\\/g, "/")
  return (
    normalized.includes(".runtime/game-map-runtime-compositor/") ||
    normalized.includes(".runtime/game-map-runtime-frame/") ||
    normalized.endsWith("composite-output.png") ||
    normalized.includes("/images/composite-output.png")
  )
}

function formatDate(value?: string) {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}
