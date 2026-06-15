import Link from "next/link"
import styles from "../detail.module.css"

const records = [
  ["单图 Tiny U-Net", "120 Epoch", "Loss 0.04827", "工程验证通过", "/ai-painter-progress/bootstrap"],
  ["多场景 Tiny U-Net", "120 Epoch", "Validation 0.19613", "视觉未通过", "/ai-painter-progress/multiscene"],
  ["多场景 Conditional GAN", "200 Epoch", "Generator 0.15710", "视觉未通过", "/ai-painter-progress/multiscene"],
  ["结构加权 V2", "180 + 200 Epoch", "Structure weighted", "结构仍未通过", "/ai-painter-progress/multiscene"],
] as const

export default function TrainingHistoryPage() {
  return <main className={styles.page}><header className={styles.header}><Link className={styles.back} href="/ai-painter-progress">← 返回训练主页</Link><p className={styles.kicker}>TRAINING RECORDS</p><h1>训练历史与审核结论</h1><p>这里集中记录每一轮训练，不用在主页堆叠图片和日志。</p></header><section className={styles.history}><div className={styles.historyList}>{records.map(([name, epochs, loss, result, href]) => <article className={styles.historyItem} key={name}><strong>{name}</strong><span>{epochs}</span><span>{loss}</span><span>{result}</span><Link href={href}>查看结果</Link></article>)}</div></section></main>
}
