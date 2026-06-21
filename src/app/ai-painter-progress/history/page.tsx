import Link from "next/link"
import styles from "../detail.module.css"

const records = [
  ["单图 Tiny U-Net", "120 Epoch", "Loss 0.04827", "工程验证通过", "/ai-painter-progress/bootstrap"],
  ["多场景 Tiny U-Net", "120 Epoch", "Validation 0.19613", "视觉未通过", "/ai-painter-progress/multiscene"],
  ["多场景 Conditional GAN", "200 Epoch", "Generator 0.15710", "视觉未通过", "/ai-painter-progress/multiscene"],
  ["结构加权 V2", "180 + 200 Epoch", "Structure weighted", "结构仍未通过", "/ai-painter-progress/multiscene"],
  ["显式结构监督 V3", "160 Epoch", "Structure IoU 89.0%", "结构通过，画面未通过", "/ai-painter-progress/structure-guided"],
  ["RGB 像素细化 V4", "220 Epoch", "Validation 0.3027", "细节审核未通过", "/ai-painter-progress/rgb-refiner"],
  ["局部资产监督 V5", "4 x 140 Epoch", "182 patches", "四类与合成未通过", "/ai-painter-progress/local-assets"],
  ["离散像素生成 V6", "4 x 100 Epoch", "4 x 48 colors", "清晰度改善，语义审核未通过", "/ai-painter-progress/discrete-assets"],
  ["部件实例与训练闸门 V7", "14 channels", "20 scenes", "训练闸门已开放", "/ai-painter-progress/component-readiness"],
  ["同源训练数据扩展 V8", "20 scenes", "14/14 channels ready", "允许启动自主训练", "/ai-painter-progress/training-expansion"],
  ["本地自主训练闭环 V9", "20 scenes", "structure 98.2% IoU", "画面未通过", "/ai-painter-progress/autonomous-training"],
  ["MVP 缺口审计 V11", "local model route", "program drawing removed", "继续补数据与模型训练", "/ai-painter-progress"],
] as const

export default function TrainingHistoryPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">返回训练主页</Link>
        <p className={styles.kicker}>TRAINING RECORDS</p>
        <h1>训练历史与审核结论</h1>
        <p>这里集中记录每一轮本地模型训练和预览结果。未通过视觉审核的内容不会进入正式世界展示。</p>
      </header>
      <section className={styles.history}>
        <div className={styles.historyList}>
          {records.map(([name, epochs, loss, result, href]) => (
            <article className={styles.historyItem} key={name}>
              <strong>{name}</strong>
              <span>{epochs}</span>
              <span>{loss}</span>
              <span>{result}</span>
              <Link href={href}>查看结果</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
