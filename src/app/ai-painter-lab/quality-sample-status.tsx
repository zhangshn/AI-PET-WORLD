import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import styles from "./page.module.css"

const SAMPLE_ROOT = path.join(process.cwd(), "data", "ai-painter-quality", "vj-b2", "samples")

type QualitySample = {
  sampleId: string
  category: string
  qualityLabel: "acceptable" | "unacceptable"
  evidenceZh: string[]
  lineage: {
    sourceAssetId: string
    variationKind: string
    creationMethod: string
  }
}

async function readSamples(): Promise<QualitySample[]> {
  try {
    const entries = await readdir(SAMPLE_ROOT, { withFileTypes: true })
    const samples = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      try {
        return JSON.parse(await readFile(path.join(SAMPLE_ROOT, entry.name, "label.json"), "utf8")) as QualitySample
      } catch {
        return null
      }
    }))
    return samples.filter((sample): sample is QualitySample => Boolean(sample?.sampleId))
  } catch {
    return []
  }
}

export async function QualitySampleStatus() {
  const samples = await readSamples()
  const acceptable = samples.filter((sample) => sample.qualityLabel === "acceptable")
  const unacceptable = samples.filter((sample) => sample.qualityLabel === "unacceptable")

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>VJ-B2 QUALITY DATA</small><h2>学习型画质审核样本</h2></div>
        <p>只接受项目自有、哈希绑定、来源可追溯且具有明确质量证据的样本。</p>
      </div>
      <div className={styles.qualitySummary}>
        <span>合格样本 <strong>{acceptable.length}/40</strong></span>
        <span>不合格样本 <strong>{unacceptable.length}/40</strong></span>
        <span>当前状态 <strong>训练阻断</strong></span>
      </div>
      <div className={styles.qualityGrid}>
        {samples.map((sample) => (
          <article key={sample.sampleId} className={styles.qualityCard}>
            <div className={styles.qualityImage}>
              <img src={`/api/ai-painter/quality-samples/${encodeURIComponent(sample.sampleId)}/image`} alt={`${sample.sampleId} 质量样本`} />
            </div>
            <small className={sample.qualityLabel === "acceptable" ? styles.qualityAcceptable : styles.qualityUnacceptable}>
              {sample.qualityLabel === "acceptable" ? "合格样本" : "不合格样本"}
            </small>
            <h3>{sample.sampleId}</h3>
            <p>{sample.lineage.variationKind} · {sample.category}</p>
            <ul>{sample.evidenceZh.map((reason) => <li key={reason}>{reason}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  )
}
