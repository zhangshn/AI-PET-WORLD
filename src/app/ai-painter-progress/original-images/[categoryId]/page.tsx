import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  listConditionalRgbGenerationAttempts,
  type ConditionalRgbGenerationAttemptRecord,
} from "@/server/ai-painter-conditional-rgb-generation-records"
import {
  COMPLETE_MAP_ORIGINAL_GROUPS,
  completeMapOriginalGroupFor,
  listOriginalImageRecords,
  readOriginalImageLibrary,
  readOriginalImageSpeciesCatalog,
  type OriginalImageCategory,
  type OriginalImageLibraryManifest,
  type OriginalImageRecord,
  type OriginalImageSpecies,
} from "@/server/ai-painter-original-image-library"
import styles from "../../page.module.css"
import { OriginalImageLibraryLiveRefresh } from "../library-live-refresh"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "原图分类目录 | AI-PET-WORLD",
}

type PageProps = {
  params: Promise<{ categoryId: string }>
  searchParams?: Promise<{ record?: string }>
}

type OriginalImageActivity =
  | {
      id: string
      kind: "original_image"
      timestamp: string
      status: string
      title: string
      record: OriginalImageRecord
    }
  | {
      id: string
      kind: "generation_attempt"
      timestamp: string
      status: string
      title: string
      attempt: ConditionalRgbGenerationAttemptRecord
    }

export default async function OriginalImageCategoryPage({ params, searchParams }: PageProps) {
  const { categoryId } = await params
  const query = searchParams ? await searchParams : {}
  const library = await readOriginalImageLibrary()
  const category = library.categories.find((item) => item.id === categoryId)
  if (!category) notFound()
  const [records, speciesCatalog, generationAttempts] = await Promise.all([
    listOriginalImageRecords(categoryId),
    categoryId === "vegetation" ? readOriginalImageSpeciesCatalog() : Promise.resolve(null),
    categoryId === "complete-maps" ? listConditionalRgbGenerationAttempts() : Promise.resolve([]),
  ])
  if (categoryId === "complete-maps") {
    return (
      <CompleteMapTypeLanding
        category={category}
        generationAttempts={generationAttempts}
        library={library}
        records={records}
      />
    )
  }
  const activities = buildActivities(records, generationAttempts)
  const selectedActivity = activities.find((activity) => activity.id === query.record) ?? activities[0] ?? null
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
          <Metric label="记录数量" value={`${activities.length}`} />
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
        <h2>程序自动保存的原图与失败记录</h2>
        {activities.length ? (
          <form className={styles.toolbar} method="get">
            <label className={styles.field}>
              <span>查看记录</span>
              <select defaultValue={selectedActivity?.id} name="record">
                {activities.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {formatTimestamp(activity.timestamp)} / {activity.status} / {activity.title}
                  </option>
                ))}
              </select>
            </label>
            <button className={styles.actionButton} type="submit">查看</button>
          </form>
        ) : null}
        <div className={styles.qualityList}>
          {selectedActivity ? (
            <OriginalImageActivityCard activity={selectedActivity} categoryId={categoryId} />
          ) : (
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

function CompleteMapTypeLanding({
  category,
  generationAttempts,
  library,
  records,
}: {
  category: OriginalImageCategory
  generationAttempts: ConditionalRgbGenerationAttemptRecord[]
  library: OriginalImageLibraryManifest
  records: OriginalImageRecord[]
}) {
  const savedRecordIds = new Set(records.map((record) => record.recordId))
  const unsavedAttempts = generationAttempts.filter((attempt) => !savedRecordIds.has(attempt.outputRecordId))
  const counts = new Map(COMPLETE_MAP_ORIGINAL_GROUPS.map((group) => [group.id, 0]))
  for (const record of records) {
    const groupId = completeMapOriginalGroupFor(record)
    counts.set(groupId, (counts.get(groupId) ?? 0) + 1)
  }
  counts.set("failed-records", (counts.get("failed-records") ?? 0) + unsavedAttempts.length)
  const totalActivities = records.length + unsavedAttempts.length

  return (
    <main className={styles.page}>
      <OriginalImageLibraryLiveRefresh />
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress/original-images">返回原图资料库</Link>
        <p className={styles.kicker}>ORIGINAL IMAGE LIBRARY / COMPLETE MAP TYPES</p>
        <h1>{category.title}</h1>
        <p>{category.description}。本页只提供固定类型入口，每个类型在下一级页面按时间查看自己的记录。</p>
        <dl className={styles.metrics}>
          <Metric label="目录原名" value={category.id} />
          <Metric label="全部活动" value={`${totalActivities}`} />
          <Metric label="可用于训练" value={`${records.filter((record) => ["eligible", "registered", "ai_assisted_cold_start_eligible"].includes(record.status)).length}`} />
          <Metric label="资料库状态" value={library.status} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>DIRECTORY TREE</p>
        <h2>完整地图原图类型</h2>
        <p><code>{library.rootPath}/complete-maps/&lt;recordId&gt;/</code></p>
        <p>以下分级是只读页面分类，不移动、不复制、不重命名真实记录目录。每条新记录仍由程序保存到原目录，并根据记录字段自动进入唯一类型。</p>
      </section>

      <section className={styles.entryGrid}>
        {COMPLETE_MAP_ORIGINAL_GROUPS.map((group) => (
          <Link
            className={styles.entryCard}
            href={`/ai-painter-progress/original-images/complete-maps/types/${group.id}`}
            key={group.id}
          >
            <span>{group.id}</span>
            <h2>{group.title}</h2>
            <p>{group.description}</p>
            <strong>{counts.get(group.id) ?? 0} 条记录</strong>
          </Link>
        ))}
      </section>
    </main>
  )
}

function OriginalImageActivityCard({ activity, categoryId }: { activity: OriginalImageActivity; categoryId: string }) {
  if (activity.kind === "original_image") {
    const { record } = activity
    return (
      <article>
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
        <small>时间: {formatTimestamp(activity.timestamp)}</small>
        <Link className={styles.textLink} href={`/ai-painter-progress/original-images/${categoryId}/${record.recordId}`}>查看原图详情</Link>
      </article>
    )
  }

  const { attempt } = activity
  return (
    <article>
      {attempt.generatedImageCreated && attempt.generatedImagePath ? (
        <Image
          className={styles.recordThumbnail}
          src={`/api/ai-painter/training-data-image?path=${encodeURIComponent(attempt.generatedImagePath)}`}
          alt={attempt.outputRecordId}
          width={1024}
          height={768}
          unoptimized
        />
      ) : (
        <span className={styles.fail}>未生成图片</span>
      )}
      <strong>{attempt.outputRecordId}</strong>
      <span>{attempt.evidencePath}</span>
      <small>状态: {attempt.status} / 失败码: {attempt.failureCode}</small>
      <small>失败说明: {attempt.failureMessage}</small>
      <small>生成路线: {attempt.attemptedRoute}</small>
      <small>UTC: {attempt.createdAtUtc} / 北京时间: {attempt.createdAtAsiaShanghai}</small>
      <small>程序自动保存: {String(attempt.automaticStorage)} / generatedImageCreated: {String(attempt.generatedImageCreated)}</small>
    </article>
  )
}

function buildActivities(
  records: OriginalImageRecord[],
  attempts: ConditionalRgbGenerationAttemptRecord[],
): OriginalImageActivity[] {
  const savedRecordIds = new Set(records.map((record) => record.recordId))
  const activities: OriginalImageActivity[] = records.map((record) => ({
    id: `image:${record.recordId}`,
    kind: "original_image",
    timestamp: record.updatedAtUtc ?? record.createdAtUtc ?? record.updatedAtAsiaShanghai ?? record.createdAtAsiaShanghai ?? "",
    status: record.status,
    title: record.title,
    record,
  }))
  for (const attempt of attempts) {
    if (savedRecordIds.has(attempt.outputRecordId)) continue
    activities.push({
      id: `attempt:${attempt.attemptId}`,
      kind: "generation_attempt",
      timestamp: attempt.createdAtUtc,
      status: attempt.status,
      title: attempt.outputRecordId,
      attempt,
    })
  }
  return activities.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || "--"
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
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
