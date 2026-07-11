import Link from "next/link"
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import styles from "../page.module.css"

type TrialRecord = {
  recordId: string
  source?: string
  sampleId?: string
  machineStatus?: string
  agentStatus?: string
  ownerStatus?: string
  trainingEligibility?: string
  failureCodes: string[]
  positiveLabels: string[]
  negativeLabels: string[]
  storedImagePath?: string
  sourceImagePath?: string
  runtimeFramePath?: string
  imageUrl: string
}

type TrialResponse = {
  ok: boolean
  records: TrialRecord[]
}

export const dynamic = "force-dynamic"

export default async function TrialReviewsPage() {
  const data = await readTrialReviews()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.textLink} href="/ai-painter-progress">
          返回训练主控台
        </Link>
        <p className={styles.kicker}>DICTIONARY TRIAL REVIEWS</p>
        <h1>字典试验与审核记录</h1>
        <p>
          这里所有内容都从存储记录读取。没有 review-record、没有存图、没有标签的内容，不算训练内容。
          局部候选可以作为材料样本，但不能当成完整游戏地图通过。
        </p>
      </header>

      <section className={styles.compactPanel}>
        <p className={styles.kicker}>DEAD RULE</p>
        <h2>训练内容必须从存储读取</h2>
        <p>
          页面只展示 `.runtime/world-visual-dictionary-trials/` 中已经保存的 review-record 和 candidate.png。
          聊天里的判断只能写回记录，不能替代项目数据。
        </p>
      </section>

      <section className={styles.entryGrid}>
        {data.records.map((record) => {
          const type = classifyRecord(record)
          return (
            <article className={styles.previewPanel} key={record.recordId}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.kicker}>{record.source ?? "trial"}</p>
                  <h2>{shortRecordId(record.recordId)}</h2>
                </div>
                <span className={type.tone === "fail" ? styles.badgeFail : styles.badgeWarn}>{type.label}</span>
              </div>
              <img src={record.imageUrl} alt={record.recordId} />
              <dl className={styles.factList}>
                <div>
                  <dt>内容类型</dt>
                  <dd>{type.label}</dd>
                </div>
                <div>
                  <dt>训练资格</dt>
                  <dd>{record.trainingEligibility ?? "--"}</dd>
                </div>
                <div>
                  <dt>人工审核</dt>
                  <dd>{record.ownerStatus ?? "--"}</dd>
                </div>
                <div>
                  <dt>失败码</dt>
                  <dd>{record.failureCodes.length}</dd>
                </div>
                <div>
                  <dt>正向标签</dt>
                  <dd>{record.positiveLabels.length}</dd>
                </div>
                <div>
                  <dt>负向标签</dt>
                  <dd>{record.negativeLabels.length}</dd>
                </div>
              </dl>
              <p className={styles.note}>{type.description}</p>
              {record.sampleId ? <p className={styles.kicker}>{record.sampleId}</p> : null}
              <p>{record.failureCodes.join(" / ") || "暂无失败码"}</p>
              <p className={styles.note}>存储图: {record.storedImagePath ?? "--"}</p>
              <p className={styles.note}>记录源: {record.runtimeFramePath ?? record.sourceImagePath ?? "--"}</p>
            </article>
          )
        })}
        {data.records.length === 0 ? (
          <article className={styles.compactPanel}>
            <h2>还没有审核记录</h2>
            <p>先运行字典试验记录脚本，页面会自动显示保存下来的候选图。</p>
          </article>
        ) : null}
      </section>
    </main>
  )
}

async function readTrialReviews(): Promise<TrialResponse> {
  const trialsRoot = path.join(process.cwd(), ".runtime", "world-visual-dictionary-trials")
  try {
    const entries = await readdir(trialsRoot, { withFileTypes: true })
    const records = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const record = await readJson(path.join(trialsRoot, entry.name, "review-record.json"))
      if (!record?.recordId) continue
      records.push({
        recordId: String(record.recordId),
        source: stringValue(record.source),
        sampleId: stringValue(record.sampleId),
        machineStatus: stringValue(record.machineStatus),
        agentStatus: stringValue(record.agentStatus),
        ownerStatus: stringValue(record.ownerStatus),
        trainingEligibility: stringValue(record.trainingEligibility),
        failureCodes: arrayValue(record.failureCodes),
        positiveLabels: arrayValue(record.positiveLabels),
        negativeLabels: arrayValue(record.negativeLabels),
        storedImagePath: stringValue(record.storedImagePath),
        sourceImagePath: stringValue(record.sourceImagePath),
        runtimeFramePath: stringValue(record.runtimeFramePath),
        imageUrl: `/api/ai-painter/world-visual-dictionary-trials/image?recordId=${encodeURIComponent(
          String(record.recordId),
        )}`,
      })
    }
    return {
      ok: true,
      records: records.sort((a, b) => b.recordId.localeCompare(a.recordId)),
    }
  } catch {
    return { ok: false, records: [] }
  }
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

function classifyRecord(record: TrialRecord) {
  if (record.failureCodes.includes("partial_candidate_not_full_world")) {
    return {
      label: "局部候选，不是完整地图",
      tone: "warn" as const,
      description: "这类图可以作为局部正向材料，但不能作为第一版完整游戏地图通过。",
    }
  }
  if (record.agentStatus === "fail" || record.trainingEligibility?.includes("negative")) {
    return {
      label: "完整地图失败样本",
      tone: "fail" as const,
      description: "这类图必须作为失败/负向候选记录保存，不能进入正式世界展示。",
    }
  }
  return {
    label: "待人工审核",
    tone: "warn" as const,
    description: "机器或智能体还不能给最终通过，需要项目所有者人工审核。",
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value.map(String) : []
}

function shortRecordId(recordId: string) {
  return recordId
    .replace("world-visual-dictionary-trial-", "")
    .replace("ai-painter-dictionary-trial-", "")
    .slice(0, 72)
}
