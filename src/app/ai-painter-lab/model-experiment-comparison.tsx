import { readFile } from "node:fs/promises"
import path from "node:path"
import styles from "./page.module.css"

type Evaluation = { meanMae: number; meanPsnr: number; meanSharpnessRatio?: number }

const EXPERIMENTS = [
  { name: "纯 L1 基线", directory: "evaluation-v0-baseline", verdict: "结构较稳，但严重模糊" },
  { name: "边缘与纹理损失", directory: "evaluation-v1-detail", verdict: "清晰度提升，仍不合格" },
  { name: "局部判别器 GAN", directory: "evaluation-v2-gan", verdict: "更清晰，但出现伪纹理" },
]

export async function ModelExperimentComparison() {
  const rows = (await Promise.all(EXPERIMENTS.map(async (item) => ({ ...item, report: await readReport(item.directory) })))).filter(
    (item): item is typeof item & { report: Evaluation } => Boolean(item.report)
  )
  if (!rows.length) return null
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>MODEL A/B TEST</small><h2>模型实验对比</h2></div>
        <p>所有候选均未通过视觉审核，不会进入玩家画面。</p>
      </div>
      <div className={styles.experimentTable}>
        <div className={styles.experimentHeader}><b>实验</b><b>MAE ↓</b><b>PSNR ↑</b><b>清晰度比例</b><b>结论</b></div>
        {rows.map((item) => <div key={item.directory}>
          <strong>{item.name}</strong>
          <span>{item.report.meanMae.toFixed(4)}</span>
          <span>{item.report.meanPsnr.toFixed(2)} dB</span>
          <span>{item.report.meanSharpnessRatio?.toFixed(3) ?? "-"}</span>
          <em>{item.verdict}</em>
        </div>)}
      </div>
    </section>
  )
}

async function readReport(directory: string): Promise<Evaluation | null> {
  try {
    const file = path.join(process.cwd(), ".runtime", "ai-painter", directory, "evaluation.json")
    return JSON.parse(await readFile(file, "utf8")) as Evaluation
  } catch { return null }
}
