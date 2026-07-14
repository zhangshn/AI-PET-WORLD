import type { Metadata } from "next"
import Link from "next/link"
import { listOriginalImageRecords, readOriginalImageLibrary } from "@/server/ai-painter-original-image-library"
import { OriginalImageLibraryLiveRefresh } from "./library-live-refresh"
import styles from "../page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "原图资料库 | AI-PET-WORLD",
}

export default async function OriginalImagesPage() {
  const [library, records] = await Promise.all([readOriginalImageLibrary(), listOriginalImageRecords()])
  const eligible = records.filter((record) => ["eligible", "registered", "ai_assisted_cold_start_eligible"].includes(record.status)).length
  const blocked = records.filter((record) => record.status === "blocked" || record.status === "rejected").length

  return (
    <main className={styles.page}>
      <OriginalImageLibraryLiveRefresh />
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress">返回训练主页</Link>
        <p className={styles.kicker}>ORIGINAL IMAGE LIBRARY</p>
        <h1>原图资料库</h1>
        <p>这里只读取第一版家园原图目录。原图必须先由程序保存并写入 record.json，页面不会创建、搬运、重命名或补造任何训练数据。</p>
        <dl className={styles.metrics}>
          <Metric label="原图分类" value={`${library.categories.length}`} />
          <Metric label="原图记录" value={`${records.length}`} />
          <Metric label="可用于训练" value={`${eligible}`} />
          <Metric label="阻断/拒绝" value={`${blocked}`} />
        </dl>
      </header>

      <section className={styles.resultGrid} aria-label="原图分类">
        {library.categories.map((category) => {
          const categoryCount = records.filter((record) => record.categoryId === category.id).length
          return (
            <article className={styles.resultCard} key={category.id}>
              <span className={categoryCount ? styles.pass : styles.fail}>{categoryCount} 条记录</span>
              <h2>{category.title}</h2>
              <p>{category.description}</p>
              <p><code>{library.rootPath}/{category.id}/</code></p>
              <Link className={styles.back} href={`/ai-painter-progress/original-images/${category.id}`}>进入目录</Link>
            </article>
          )
        })}
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>STORAGE CONTRACT</p>
        <h2>目录与登记边界</h2>
        <p><code>{library.rootPath}/</code></p>
        <p>本目录保存原始来源；通过全部审核后，程序才可登记到正式样本 registry。历史局部裁片不会自动迁入，也不会自动取得训练资格。</p>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
