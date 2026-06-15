import Link from "next/link"
import styles from "../detail.module.css"

export default function BootstrapTrainingPage() {
  return <main className={styles.page}><header className={styles.header}><Link className={styles.back} href="/ai-painter-progress">← 返回训练主页</Link><p className={styles.kicker}>STAGE 01 / BOOTSTRAP</p><h1>单图训练验证</h1><p>这一阶段只验证本地 Tiny U-Net、CUDA、权重保存和 PNG 推理链是否真实可运行。</p><dl className={styles.metrics}><div><dt>训练样本</dt><dd>1 张</dd></div><div><dt>Epoch</dt><dd>120</dd></div><div><dt>最佳 Loss</dt><dd>0.04827</dd></div><div><dt>结论</dt><dd>工程链通过</dd></div></dl></header><section className={styles.resultGrid}><article className={styles.resultCard}><span className={styles.pass}>工程验证通过</span><h2>本地模型重建结果</h2><p>该图片由本地权重推理生成，但模型只学习了一张图片，不能代表自主生成能力。</p><img src="/api/ai-painter/bootstrap-inference" alt="单图过拟合模型结果" /></article><article className={styles.resultCard}><h2>阶段限制</h2><p className={styles.note}>这不是正式世界生成模型。它只能证明代码、GPU、训练和推理链路可用。</p><p>继续重复训练不会产生新的世界，也不会自动获得新的构图能力。</p></article></section></main>
}
