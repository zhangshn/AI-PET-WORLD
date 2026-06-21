import Link from "next/link"
import styles from "../detail.module.css"

const assets = [
  ["建筑", "building", "50 / 2", "0.3298"],
  ["树木", "tree", "50 / 2", "0.3391"],
  ["道路", "road", "50 / 2", "0.3410"],
  ["水岸", "shoreline", "25 / 1", "0.3324"],
] as const

export default function LocalAssetsPage() {
  return <main className={styles.page}><header className={styles.header}><Link className={styles.back} href="/ai-painter-progress">← 返回训练主页</Link><p className={styles.kicker}>STAGE 05 / LOCAL ASSET SUPERVISION</p><h1>局部资产高分辨率监督</h1><p>从同源世界图和14通道 Mask 自动切出建筑、树木、道路、水岸 Patch，分别训练，再按真实区域合成完整画面。</p><dl className={styles.metrics}><div><dt>局部样本</dt><dd>182</dd></div><div><dt>模型数量</dt><dd>4</dd></div><div><dt>单类训练</dt><dd>140 Epoch</dd></div><div><dt>世界展示</dt><dd>继续阻断</dd></div></dl></header><section className={styles.resultGrid}>{assets.map(([name, view, samples, loss]) => <article className={styles.resultCard} key={view}><span className={styles.fail}>视觉审核未通过</span><h2>{name}局部模型</h2><p>训练/验证 {samples}，最佳验证损失 {loss}。输出仍有平均化与色块问题。</p><img src={`/api/ai-painter/local-assets/${view}`} alt={`${name}局部模型输出`} /></article>)}</section><section className={styles.resultGrid}><article className={styles.resultCard}><span className={styles.fail}>合成审核未通过</span><h2>四类结构约束合成</h2><p>四类结果已按各自真实 Mask 合成，但整体清晰度和像素细节仍未达到目标。</p><img src="/api/ai-painter/local-assets/composite" alt="四类局部资产合成结果" /></article><article className={styles.resultCard}><h2>模块结论</h2><p className={styles.note}>数据切片、四模型训练、局部推理和结构合成链路均已真实运行。</p><p>失败原因已收敛为训练数据数量与目标分辨率不足，而不是结构链或训练入口缺失。</p></article></section><section className={styles.panel}><h2>下一阶段</h2><p>停止继续重复小数据全监督训练。保留 Stage 03 的结构头与 Stage 05 的局部流水线，下一步需要扩充同源局部资产数据并采用像素离散化输出，以解决模糊平均问题。</p></section></main>
}
