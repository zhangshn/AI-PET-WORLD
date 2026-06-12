import { readFile } from "node:fs/promises"
import path from "node:path"
import styles from "./page.module.css"

type EvaluationReport = {
  sampleCount: number
  meanMae: number
  meanPsnr: number
  meanEdgeMae?: number
  meanSharpnessRatio?: number
  samples: Array<{ sampleId: string }>
}

export async function ValidationPreview() {
  const report = await readReport()
  const sample = report?.samples[0]
  if (!report || !sample) return null
  const targetUrl = `/api/ai-painter/dataset/scenes/${encodeURIComponent(sample.sampleId)}/image?original=1`

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>UNSEEN VALIDATION</small><h2>未参与训练样本验证</h2></div>
        <p>该结果用于判断泛化能力，当前不符合视觉展示标准。</p>
      </div>
      <div className={styles.inferenceGrid}>
        <figure><img className={styles.originalImage} src={targetUrl} alt="验证目标图" /><figcaption>原始高清验证目标图</figcaption></figure>
        <figure><img src="/api/ai-painter/evaluation/image" alt="验证生成图" /><figcaption>模型验证生成图</figcaption></figure>
      </div>
      <dl className={styles.inferenceMeta}>
        <div><dt>验证样本</dt><dd>{sample.sampleId}</dd></div>
        <div><dt>样本数量</dt><dd>{report.sampleCount}</dd></div>
        <div><dt>MAE（越低越好）</dt><dd>{report.meanMae.toFixed(4)}</dd></div>
        <div><dt>PSNR（越高越好）</dt><dd>{report.meanPsnr.toFixed(2)} dB</dd></div>
        <div><dt>边缘误差（越低越好）</dt><dd>{report.meanEdgeMae?.toFixed(4) ?? "待评估"}</dd></div>
        <div><dt>清晰度比例（接近 1）</dt><dd>{report.meanSharpnessRatio?.toFixed(3) ?? "待评估"}</dd></div>
      </dl>
    </section>
  )
}

async function readReport(): Promise<EvaluationReport | null> {
  try {
    const file = path.join(process.cwd(), ".runtime", "ai-painter", "evaluation-v0", "evaluation.json")
    return JSON.parse(await readFile(file, "utf8")) as EvaluationReport
  } catch {
    return null
  }
}
