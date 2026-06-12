import { readFile } from "node:fs/promises"
import path from "node:path"
import styles from "./page.module.css"

type InferenceManifest = {
  sampleId: string
  width: number
  height: number
  device: string
  sha256: string
}

export async function InferencePreview() {
  const manifest = await readManifest()
  if (!manifest) return null
  const targetUrl = `/api/ai-painter/dataset/scenes/${encodeURIComponent(manifest.sampleId)}/image`

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>LOCAL MODEL INFERENCE</small><h2>本地模型生成对照</h2></div>
        <p>仅用于训练诊断，未经视觉审核，禁止进入玩家画面。</p>
      </div>
      <div className={styles.inferenceGrid}>
        <figure><img src={targetUrl} alt="训练目标图" /><figcaption>训练目标图</figcaption></figure>
        <figure><img src="/api/ai-painter/inference/latest-image" alt="本地模型生成图" /><figcaption>当前模型生成图</figcaption></figure>
      </div>
      <dl className={styles.inferenceMeta}>
        <div><dt>样本</dt><dd>{manifest.sampleId}</dd></div>
        <div><dt>尺寸</dt><dd>{manifest.width} × {manifest.height}</dd></div>
        <div><dt>设备</dt><dd>{manifest.device}</dd></div>
        <div><dt>SHA-256</dt><dd>{manifest.sha256.slice(0, 16)}…</dd></div>
      </dl>
    </section>
  )
}

async function readManifest(): Promise<InferenceManifest | null> {
  try {
    const file = path.join(process.cwd(), ".runtime", "ai-painter", "inference-v0", "latest.json")
    return JSON.parse(await readFile(file, "utf8")) as InferenceManifest
  } catch {
    return null
  }
}
