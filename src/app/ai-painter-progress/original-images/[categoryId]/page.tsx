import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  listOriginalImageRecords,
  readOriginalImageLibrary,
  readOriginalImageSpeciesCatalog,
  type OriginalImageSpecies,
} from "@/server/ai-painter-original-image-library"
import styles from "../../page.module.css"
import { OriginalImageLibraryLiveRefresh } from "../library-live-refresh"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "原图分类目录 | AI-PET-WORLD",
}

type PageProps = { params: Promise<{ categoryId: string }> }

export default async function OriginalImageCategoryPage({ params }: PageProps) {
  const { categoryId } = await params
  const library = await readOriginalImageLibrary()
  const category = library.categories.find((item) => item.id === categoryId)
  if (!category) notFound()
  const [records, speciesCatalog] = await Promise.all([
    listOriginalImageRecords(categoryId),
    categoryId === "vegetation" ? readOriginalImageSpeciesCatalog() : Promise.resolve(null),
  ])
  const directoryPattern = category.directoryPattern ?? ["recordId"]

  return (
    <main className={styles.page}>
      <OriginalImageLibraryLiveRefresh />
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress/original-images">返回原图资料库</Link>
        <p className={styles.kicker}>ORIGINAL IMAGE LIBRARY / CATEGORY</p>
        <h1>{category.title}</h1>
        <p>{category.description}</p>
        <dl className={styles.metrics}>
          <Metric label="目录原名" value={category.id} />
          <Metric label="记录数量" value={`${records.length}`} />
          <Metric label="可用于训练" value={`${records.filter((record) => ["eligible", "registered", "ai_assisted_cold_start_eligible"].includes(record.status)).length}`} />
          <Metric label="资料库状态" value={library.status} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>DIRECTORY TREE</p>
        <h2>正式目录层级</h2>
        <p><code>{library.rootPath}/{category.id}/{directoryPattern.map((segment) => `<${segment}>`).join("/")}/</code></p>
        <p>这是程序接收原图时使用的真实目录规则。没有接收记录时页面只显示规划节点，不会创建空目录或训练数据。</p>
        {speciesCatalog ? <SpeciesDirectory species={speciesCatalog.species} /> : (
          <div className={styles.qualityList}>
            <article>
              <strong>{category.title}</strong>
              <span>{directoryPattern.join(" → ")}</span>
              <small>记录成功接收后，实际相对路径会按以上字段自动生成并显示在下方记录列表。</small>
            </article>
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>SAVED RECORDS</p>
        <h2>程序自动保存的原图记录</h2>
        <div className={styles.qualityList}>
          {records.length ? records.map((record) => (
            <article key={record.recordId}>
              {record.originalImage?.path ? (
                <Image
                  className={styles.recordThumbnail}
                  src={`/api/ai-painter/original-images/${categoryId}/${record.recordId}`}
                  alt={record.title}
                  width={record.originalImage.width ?? 1024}
                  height={record.originalImage.height ?? 768}
                  unoptimized
                />
              ) : null}
              <strong>{record.title}</strong>
              <span>{record.relativeDirectory}</span>
              <small>recordId: {record.recordId} / 状态: {record.status} / 尺寸: {record.originalImage?.width ?? "--"}×{record.originalImage?.height ?? "--"}</small>
              <Link className={styles.textLink} href={`/ai-painter-progress/original-images/${categoryId}/${record.recordId}`}>查看原图详情</Link>
            </article>
          )) : (
            <article>
              <strong>当前没有原图记录</strong>
              <span>{library.rootPath}/{categoryId}/</span>
              <small>页面不会创建假记录。原图接收程序写入 record.json 和源文件后，这里才会自动出现。</small>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}

const plantKindLabels: Record<string, string> = {
  tree: "乔木",
  shrub: "灌木",
  grass_detail: "草本地被",
  flower_patch: "花草",
  reed: "水岸苇类",
}

function SpeciesDirectory({ species }: { species: OriginalImageSpecies[] }) {
  const groups = Array.from(new Set(species.map((item) => item.plantKind)))
  return (
    <div className={styles.qualityList}>
      {groups.map((plantKind) => {
        const items = species.filter((item) => item.plantKind === plantKind)
        return (
          <article key={plantKind}>
            <strong>{plantKindLabels[plantKind] ?? plantKind} / {plantKind}</strong>
            <span>{items.length} 个现实物种</span>
            {items.map((item) => (
              <small key={item.speciesId}>
                {item.nameZh} / {item.speciesId} / {item.scientificName} / {item.lifecycleProfileId}
              </small>
            ))}
          </article>
        )
      })}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
