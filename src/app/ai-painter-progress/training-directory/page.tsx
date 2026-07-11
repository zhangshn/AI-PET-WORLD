import Link from "next/link"
import styles from "../detail.module.css"

const trainingLines = [
  {
    label: "完整图训练",
    title: "自然家园完整画面训练",
    status: "候选图未达标",
    href: "/ai-painter-progress/natural-home",
    body:
      "目标是一次生成完整自然家园画面，作为未来世界画面的视觉基准。目前多轮结果仍存在模糊、结构不稳、细节不足和候选图质量波动，不能直接进入 /world。",
    decision: "保留为完整图训练主线，但不能把当前候选图当成正式游戏画面。",
  },
  {
    label: "局部资产训练",
    title: "建筑、树、道路、水岸局部模型",
    status: "流水线跑通，视觉不合格",
    href: "/ai-painter-progress/local-assets",
    body:
      "这条线训练的是局部 patch，不是完整地图。当前 building、tree、road、shoreline 和 composite 输出都偏糊、偏平均化，能证明切片、训练、推理、合成链路存在，但不能作为正式游戏素材。",
    decision: "后续只作为视觉单元实验线，必须扩充数据和改输出约束后再训练。",
  },
  {
    label: "GameMap 材料训练",
    title: "材料槽与 RuntimeFrame 合成",
    status: "最新 v46 归档存在",
    href: "/ai-painter-progress/generated-results",
    body:
      "这条线尝试把草地、道路、水体、边缘、物体等材料槽组合为运行时画面。它更接近数据驱动世界的方向，但最新结果仍有网格感、泥糊纹理和材料拼接问题。",
    decision: "继续作为结构到视觉的主实验线，但所有输出必须经过结构一致性和人工视觉复核。",
  },
  {
    label: "活世界候选图",
    title: "P10-P17 九张 Chunk 候选",
    status: "全部等待人工复核",
    href: "/ai-painter-progress",
    body:
      "这批图来自活世界 Chunk 数据，当前问题非常明显：可见网格、泥糊纹理、路径与地形不自然。它们只能作为失败样本和问题定位材料，不能进入训练正样本库。",
    decision: "全部阻断进入 /world，先沉淀为负样本和修复目标。",
  },
  {
    label: "结果归档",
    title: "训练输出、失败图和审核记录",
    status: "必须保留",
    href: "/ai-painter-progress/generated-results",
    body:
      "所有训练图片、失败图片、候选图片、耗时、电费、模型路径、审核结论都必须归档。这个模块不是展示最终效果，而是让本地 AI 训练闭环能复盘和选样。",
    decision: "继续保留，后续正样本、负样本、人工复核都从这里进入训练闭环。",
  },
  {
    label: "数据清单",
    title: "样本、Mask、结构数据和资源记录",
    status: "支撑训练",
    href: "/ai-painter-progress/dataset-inventory",
    body:
      "这里记录样本来源、结构 mask、训练输入和可用数据范围。MVP 不能只看最终图，必须先确认每次训练到底吃了哪些数据、哪些数据有效、哪些数据污染模型。",
    decision: "数据不清楚时不继续盲目训练，先清洗样本和标记失败原因。",
  },
]

export default function TrainingDirectoryPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">
          返回训练主页
        </Link>
        <p className={styles.kicker}>AI PAINTER TRAINING DIRECTORY</p>
        <h1>训练目录与当前结论</h1>
        <p>
          这里专门管理训练入口。主页不再堆所有训练卡片，只负责显示当前状态和关键候选图。
          每条训练线必须写清楚目标、当前质量、是否能进入世界、下一步应该做什么。
        </p>
        <dl className={styles.metrics}>
          <div>
            <dt>当前可进入世界</dt>
            <dd>0 条</dd>
          </div>
          <div>
            <dt>可作为正样本</dt>
            <dd>0 批</dd>
          </div>
          <div>
            <dt>保留为负样本</dt>
            <dd>九张 Chunk 候选</dd>
          </div>
          <div>
            <dt>主线方向</dt>
            <dd>数据驱动视觉</dd>
          </div>
        </dl>
      </header>

      <section className={styles.resultGrid}>
        {trainingLines.map((line) => (
          <article className={styles.resultCard} key={line.label}>
            <span className={styles.fail}>{line.status}</span>
            <p className={styles.kicker}>{line.label}</p>
            <h2>{line.title}</h2>
            <p>{line.body}</p>
            <p className={styles.note}>{line.decision}</p>
            <Link className={styles.back} href={line.href}>
              进入详情
            </Link>
          </article>
        ))}
      </section>
    </main>
  )
}
