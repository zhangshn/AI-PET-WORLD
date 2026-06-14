import type { Metadata } from "next"
import { readAiPainterDatasetStatus } from "./ai-painter-lab-status"
import { LayeredAssetStatus } from "./layered-asset-status"
import { ProjectStatusTables } from "./project-status-tables"
import { QualitySampleStatus } from "./quality-sample-status"
import styles from "./page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "AI Painter 单体资产实验室 | AI-PET-WORLD",
  description: "查看同源分层单体资产、精准 Alpha Mask 和真实训练准备状态。",
}

export default async function AiPainterLabPage() {
  const dataset = await readAiPainterDatasetStatus()

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
        <h2>当前下一步：扩充独立高质量树木正样本</h2>
        <p>当前已有 6 棵来源独立、结构不同的合格树木。下一阶段继续制作不同树冠结构、树干形态和光照细节的原创树木，不能只对同一棵树做微小变体凑数；达到每类 40 个可信样本后才启动 VJ-B2 训练。</p>
      </section>
    </main>
  )
}
