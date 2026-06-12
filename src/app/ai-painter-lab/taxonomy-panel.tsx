import { DATASET_DOMAINS, DATASET_LAYERS } from "./dataset-taxonomy"
import styles from "./page.module.css"

const EXAMPLES: Record<string, string> = {
  world: "自然空地 / 水岸 / 建设场景 / 小镇场景",
  building: "整栋房屋 → 屋顶 / 墙体 / 门窗 → 木头 / 石材",
  character: "完整人物 → 头部 / 身体 / 四肢 / 服装 → 皮肤 / 布料",
  animal: "完整动物 → 头 / 身体 / 腿 / 尾巴 → 毛发 / 鳞片",
  vegetation: "树木 / 灌木 / 草簇 / 花朵 → 树干 / 树冠 / 叶片",
  terrain: "草地 / 土地 / 悬崖 / 岸线 → 地表纹理",
  road: "完整道路 → 边缘 / 转角 / 路口 → 泥土 / 石板",
  water: "河流 / 池塘 / 水岸 → 水面 / 波纹 / 睡莲",
  material: "木材 / 石材 / 草 / 土 / 金属 / 布料",
  prop: "木箱 / 桶 / 工具 / 建筑材料",
}

export function TaxonomyPanel() {
  return <><div className={styles.layerGrid}>{DATASET_LAYERS.map((layer) => <article key={layer.id}><b>{layer.zh}</b><code>{layer.id}</code><span>{layer.size}</span><p>{layer.primary ? "主场景模型正式训练数据" : "辅助学习数据，单独归档"}</p></article>)}</div><div className={styles.domainGrid}>{DATASET_DOMAINS.map((domain) => <article key={domain.id}><h3>{domain.zh}</h3><code>{domain.id}</code><p>{EXAMPLES[domain.id]}</p></article>)}</div></>
}
