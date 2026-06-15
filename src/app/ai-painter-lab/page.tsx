import type { Metadata } from "next"
import { readAiPainterDatasetStatus } from "./ai-painter-lab-status"
import { LayeredAssetStatus } from "./layered-asset-status"
import { ProjectStatusTables } from "./project-status-tables"
import { QualitySampleStatus } from "./quality-sample-status"
import { CandidateReviewPanel } from "./candidate-review-panel"
import { readCandidateReviewItems } from "./candidate-review-data"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "AI Painter 单体资产实验室 | AI-PET-WORLD",
  description: "查看同源分层单体资产、精准 Alpha Mask 和真实训练准备状态。",
}

export default async function AiPainterLabPage() {
  const dataset = await readAiPainterDatasetStatus()
  const candidateReviews = await readCandidateReviewItems()

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AI-PET-WORLD / AI PAINTER LAB</p>
          <h1>同源单体资产实验室</h1>
          <p className={styles.lead}>先生成可拆分单体，再由相同图层同步生成精灵图与精准训练 Mask。</p>
        </div>
        <div className={styles.status}><span />分层资产构建器已接入</div>
      </header>

      <section className={styles.notice}>
        <strong>未完成的图片不会展示或进入训练。</strong>
        <span>原始图片仅作为参考；可信训练数据必须来自同一份 RGBA 图层、Alpha Mask 和哈希记录。</span>
      </section>

      <section className={styles.metrics}>
        <article><small>原始参考素材</small><strong>{dataset.sourceMaterials}</strong><span>张，仅作参考</span></article>
        <article><small>工程验证资产</small><strong>{dataset.engineeringAssets}</strong><span>个，不进入训练</span></article>
        <article><small>画质候选资产</small><strong>{dataset.candidateAssets}</strong><span>个，等待审核</span></article>
        <article><small>可信同源资产</small><strong>{dataset.trainableAssets}</strong><span>个，可进入训练</span></article>
        <article><small>最低训练目标</small><strong>{dataset.trainingMinimum}</strong><span>个同源资产</span></article>
        <article><small>VJ-B2 合格样本</small><strong>{dataset.vjB2Acceptable}</strong><span>/{dataset.vjB2MinimumPerLabel} 个</span></article>
        <article><small>VJ-B2 不合格样本</small><strong>{dataset.vjB2Unacceptable}</strong><span>/{dataset.vjB2MinimumPerLabel} 个</span></article>
      </section>

      <LayeredAssetStatus />

      <CandidateReviewPanel initialCandidates={candidateReviews} />

      <QualitySampleStatus />

      <ProjectStatusTables
        engineeringAssets={dataset.engineeringAssets}
        candidateAssets={dataset.candidateAssets}
        trainableAssets={dataset.trainableAssets}
        vjB2Acceptable={dataset.vjB2Acceptable}
        vjB2Unacceptable={dataset.vjB2Unacceptable}
      />

      <section className={styles.nextStep}>
        <small>NEXT MODULE</small>
        <h2>当前下一步：依据标准树档案生成第二批改进候选</h2>
        <p>标准树档案与双边界比对器已经接入。当前合格样本仍少于 40 个，下一批候选必须保存完整生成参数，并优先学习已通过样本的结构范围；系统无法确定时才交给人工确认。</p>
      </section>
    </main>
  )
}
