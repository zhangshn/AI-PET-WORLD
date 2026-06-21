import Link from "next/link"
import styles from "../detail.module.css"

const assets = [
  ["建筑", "building", "4.93%"],
  ["树木", "tree", "4.96%"],
  ["道路", "road", "3.75%"],
  ["水岸", "shoreline", "5.06%"],
] as const

export default function DiscreteAssetsPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.back} href="/ai-painter-progress">← 返回训练主页</Link>
      <p className={styles.kicker}>STAGE 06 / DISCRETE PIXEL GENERATION</p>
      <h1>四结构离散像素生成</h1>
      <p>建筑、树木、道路、水岸分别使用项目训练图提取的 48 色词表，以 14 通道结构条件进行逐像素分类，再按同源 Mask 合成。</p>
      <dl className={styles.metrics}><div><dt>结构类型</dt><dd>4 类</dd></div><div><dt>项目颜色词表</dt><dd>4 × 48 色</dd></div><div><dt>训练轮次</dt><dd>4 × 100 Epoch</dd></div><div><dt>世界展示</dt><dd>继续阻断</dd></div></dl>
    </header>
    <section className={styles.resultGrid}>
      {assets.map(([name, view, accuracy]) => <article className={styles.resultCard} key={view}><span className={styles.fail}>视觉审核未通过</span><h2>{name}离散像素模型</h2><p>最佳验证像素准确率 {accuracy}。颜色边界更硬，但结构语义发生错位，不能作为正式资产。</p><img src={`/api/ai-painter/discrete-assets/${view}`} alt={`${name}离散像素输出`} /></article>)}
    </section>
    <section className={styles.resultGrid}>
      <article className={styles.resultCard}><span className={styles.fail}>合成审核未通过</span><h2>四结构世界合成</h2><p>离散颜色解决了部分平均化模糊，但没有解决小样本下的结构到外观映射，输出仍存在错误色块与对象错位。</p><img src="/api/ai-painter/discrete-assets/composite" alt="离散像素四结构合成结果" /></article>
      <article className={styles.resultCard}><h2>阶段结论</h2><p className={styles.note}>四种局部结构已经全部完成数据准备、训练、推理和合成，没有跳过任何一类。</p><p>失败原因已经进一步收敛：当前 14 通道只描述大区域，无法提供建筑部件、树冠层级、道路纹理方向、水岸材质等细粒度条件；同时每类验证样本只有 1 到 2 张。</p></article>
    </section>
    <section className={styles.panel}><h2>下一阶段</h2><p>不再重复相同模型。下一步应把局部资产拆成部件级结构条件，并增加同源训练覆盖；世界页面继续只接受 Visual Judge 审核通过的 ApprovedFrame。</p></section>
  </main>
}
