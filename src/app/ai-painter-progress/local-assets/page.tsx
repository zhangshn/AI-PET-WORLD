import Link from "next/link"
import styles from "../detail.module.css"

const assets = [
  {
    name: "建筑",
    view: "building",
    samples: "50 / 2",
    loss: "0.3298",
    issue: "轮廓糊成色块，屋顶和墙体没有稳定像素边界。",
  },
  {
    name: "树木",
    view: "tree",
    samples: "50 / 2",
    loss: "0.3391",
    issue: "树冠层次被平均化，缺少叶片团簇、阴影和可识别枝干。",
  },
  {
    name: "道路",
    view: "road",
    samples: "50 / 2",
    loss: "0.3410",
    issue: "道路边缘、土路颗粒和草地过渡不清楚，结构像模糊斜线。",
  },
  {
    name: "水岸",
    view: "shoreline",
    samples: "25 / 1",
    loss: "0.3324",
    issue: "水岸材质没有形成清楚的湿边、石块、草丛和水面交界。",
  },
] as const

export default function LocalAssetsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress/training-directory">
          返回训练目录
        </Link>
        <p className={styles.kicker}>LOCAL ASSET TRAINING REVIEW</p>
        <h1>局部训练结果复盘</h1>
        <p>
          这不是合格的游戏素材结果。当前局部训练只能证明“切片、分类训练、局部推理、按 Mask 合成”这条链路跑通了，
          不能证明小模型已经学会画正式游戏地图资产。
        </p>
        <dl className={styles.metrics}>
          <div>
            <dt>局部样本</dt>
            <dd>182</dd>
          </div>
          <div>
            <dt>模型数量</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>单类训练</dt>
            <dd>140 Epoch</dd>
          </div>
          <div>
            <dt>世界展示</dt>
            <dd>禁止进入</dd>
          </div>
        </dl>
      </header>

      <section className={styles.panel}>
        <h2>当前判断</h2>
        <p>
          局部训练的输出偏糊、偏平均化，并且带有明显条纹和色块感。它比完整图更容易收敛出“像某种东西”的结果，
          但还没有达到游戏资产要求：边界不干净、可交互对象不可数、材质细节不稳定、不同资产之间无法无缝拼接。
        </p>
        <p className={styles.note}>
          所以这条线后续应该作为 VisualUnit 实验线，而不是继续拿来生成完整地图。真正的 MVP 地图仍要走“世界数据结构到 ChunkVisualInput，到小模型渲染，到结构一致性检查，再到人工复核”的闭环。
        </p>
      </section>

      <section className={styles.resultGrid}>
        {assets.map((asset) => (
          <article className={styles.resultCard} key={asset.view}>
            <span className={styles.fail}>视觉审核未通过</span>
            <h2>{asset.name}局部模型</h2>
            <p>
              训练/验证 {asset.samples}，最佳验证损失 {asset.loss}。{asset.issue}
            </p>
            <img src={`/api/ai-painter/local-assets/${asset.view}`} alt={`${asset.name}局部模型输出`} />
          </article>
        ))}
      </section>

      <section className={styles.resultGrid}>
        <article className={styles.resultCard}>
          <span className={styles.fail}>合成审核未通过</span>
          <h2>四类结构约束合成</h2>
          <p>
            四类结果已经按各自真实 Mask 合成，但整体清晰度和像素细节没有达到目标，建筑、树、道路、水岸之间也没有形成可信的统一光照和材质关系。
          </p>
          <img src="/api/ai-painter/local-assets/composite" alt="四类局部资产合成结果" />
        </article>
        <article className={styles.resultCard}>
          <h2>后续处理</h2>
          <p>
            暂停把这批局部图当成正样本。保留它们作为失败样本，用来标记“模糊平均、边缘丢失、对象不可数、材质无法拼接”四类问题。
          </p>
          <p className={styles.note}>
            下一轮如果继续局部训练，必须先补足同源局部数据、明确每类资产的可交互边界，并让输出服务于 Chunk 结构，而不是只追求单张 patch 看起来像。
          </p>
        </article>
      </section>
    </main>
  )
}
