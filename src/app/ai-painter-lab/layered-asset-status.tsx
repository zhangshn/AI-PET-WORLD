import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import styles from "./page.module.css"

const ASSET_ROOT = path.resolve(process.cwd(), "data", "ai-painter-assets", "accepted")
const ENGINEERING_ROOT = path.resolve(process.cwd(), "data", "ai-painter-assets", "engineering")
const CANDIDATE_ROOT = path.resolve(process.cwd(), "data", "ai-painter-assets", "candidates")

type AssetMetadata = {
  assetId: string
  category: string
  size: [number, number]
  annotationSource: string
  admission: "engineering_only" | "candidate" | "accepted"
  trainable: boolean
  layers: Array<{ id: string; channel: string }>
  masks: Record<string, { path: string }>
  quality?: {
    technicalGate: "passed" | "failed"
    visualGate: "pending" | "not_applicable"
    paletteColorCount: number
    opaquePixelCount: number
    approvedForTraining: boolean
  }
  visualReview?: {
    gate: "vj_a"
    status: "passed" | "failed"
    failureReasonsZh: string[]
    metrics: {
      coverageRatio: number
      paletteColorCount: number
      luminanceRange: number
      edgeDensity: number
    }
    vjB: {
      status: "passed" | "failed"
      failureReasonsZh: string[]
      metrics: {
        paletteColorCount: number
        dominantColorRatio: number
        internalEdgeDensity: number
        silhouetteEdgeDensity: number
        shadowRatio: number
        highlightRatio: number
        minimumLayerColorDistance: number
      }
      vjB2LearnedJudgeStatus: "not_implemented"
      approvedForTraining: false
    }
    approvedForTraining: false
  }
}

async function readAssets(root: string): Promise<AssetMetadata[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true })
    const assets = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      try {
        const assetRoot = path.join(root, entry.name)
        const metadata = JSON.parse(await readFile(path.join(assetRoot, "metadata.json"), "utf8")) as AssetMetadata
        try {
          metadata.visualReview = JSON.parse(await readFile(path.join(assetRoot, "visual-review.json"), "utf8")) as AssetMetadata["visualReview"]
        } catch {
          // Engineering assets do not require a visual review report.
        }
        return metadata
      } catch {
        return null
      }
    }))
    return assets.filter((asset): asset is AssetMetadata => Boolean(asset?.assetId))
  } catch {
    return []
  }
}

export async function LayeredAssetStatus() {
  const assets = [...await readAssets(ENGINEERING_ROOT), ...await readAssets(CANDIDATE_ROOT), ...await readAssets(ASSET_ROOT)]

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>SAME-SOURCE ASSET PIPELINE</small><h2>同源单体资产与精准 Mask</h2></div>
        <p>先分层绘制，再由同一份 Alpha 数据合成精灵图和训练标注，不从完整 PNG 猜测结构。</p>
      </div>

      <div className={styles.assetFlow}>
        <span>RGBA 分层单体</span><b>→</b><span>合成 sprite.png</span><b>→</b><span>Alpha 精准 Mask</span><b>→</b><span>哈希绑定</span>
      </div>

      {assets.length === 0 ? (
        <div className={styles.assetEmpty}>
          <strong>当前没有可展示的真实单体资产</strong>
          <p>分层构建器已经完成，但异常图像生成结果没有进入数据集。只有树干、树冠等真实透明图层构建成功后，这里才会显示精灵图与对应 Mask。</p>
          <code>data/ai-painter-assets/accepted/&lt;assetId&gt;/</code>
        </div>
      ) : (
        <div className={styles.assetList}>
          {assets.map((asset) => (
            <article key={asset.assetId} className={styles.assetCard}>
              <div className={styles.assetImage}><img src={`/api/ai-painter/assets/${encodeURIComponent(asset.assetId)}/sprite`} alt={`${asset.assetId} 精灵图`} /></div>
              <div className={styles.assetInfo}>
                <small>{asset.trainable ? "正式训练资产" : asset.admission === "candidate" ? "画质候选资产 · 等待审核" : "工程验证资产 · 不进入训练"}</small><h3>{asset.assetId}</h3>
                <p>{asset.size.join(" × ")} · {asset.annotationSource}</p>
                <dl className={styles.assetAudit}>
                  <div><dt>技术完整性</dt><dd>{asset.quality?.technicalGate === "passed" ? "通过" : "未通过"}</dd></div>
                  <div><dt>VJ-A 像素审核</dt><dd>{asset.visualReview?.status === "passed" ? "通过" : asset.visualReview?.status === "failed" ? "未通过" : "不适用"}</dd></div>
                  <div><dt>调色板颜色</dt><dd>{asset.quality?.paletteColorCount ?? "-"}</dd></div>
                  <div><dt>正式训练</dt><dd>{asset.quality?.approvedForTraining ? "允许" : "禁止"}</dd></div>
                </dl>
                {asset.visualReview && (
                  <div className={asset.visualReview.status === "failed" || asset.visualReview.vjB.status === "failed" ? styles.reviewFailed : styles.reviewPending}>
                    <strong>单体视觉审核 VJ-A：{asset.visualReview.status === "passed" ? "通过" : "未通过"}</strong>
                    {asset.visualReview.failureReasonsZh.length > 0 ? (
                      <ul>{asset.visualReview.failureReasonsZh.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    ) : <p>可计算像素指标通过，但仍需 VJ-B 最终风格与参考质量审核。</p>}
                    <strong>VJ-B1 目标品质代理：{asset.visualReview.vjB.status === "passed" ? "通过" : "未通过"}</strong>
                    {asset.visualReview.vjB.failureReasonsZh.length > 0 && (
                      <ul>{asset.visualReview.vjB.failureReasonsZh.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                    )}
                    <p>VJ-B2 学习型参考审核：尚未实现；正式训练资格：禁止。</p>
                  </div>
                )}
                <div className={styles.assetMasks}>
                  {Object.keys(asset.masks).map((channel) => (
                    <figure key={channel}>
                      <img src={`/api/ai-painter/assets/${encodeURIComponent(asset.assetId)}/mask-${encodeURIComponent(channel)}`} alt={`${channel} Mask`} />
                      <figcaption>{channel}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
