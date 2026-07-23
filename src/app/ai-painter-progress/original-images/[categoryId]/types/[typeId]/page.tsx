import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  listConditionalRgbGenerationAttempts,
  type ConditionalRgbGenerationAttemptRecord,
} from "@/server/ai-painter-conditional-rgb-generation-records"
import {
  completeMapOriginalGroupFor,
  findCompleteMapOriginalGroup,
  listOriginalImageRecords,
  readOriginalImageLibrary,
  type OriginalImageRecord,
} from "@/server/ai-painter-original-image-library"
import styles from "../../../../page.module.css"
import { OriginalImageLibraryLiveRefresh } from "../../../library-live-refresh"
import { OwnerReviewControls } from "../../../owner-review-controls"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "完整地图原图类型 | AI-PET-WORLD",
}

type PageProps = {
  params: Promise<{ categoryId: string; typeId: string }>
  searchParams?: Promise<{ record?: string }>
}

type CompleteMapActivity =
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

export default async function CompleteMapOriginalTypePage({ params, searchParams }: PageProps) {
  const { categoryId, typeId } = await params
  if (categoryId !== "complete-maps") notFound()
  const group = findCompleteMapOriginalGroup(typeId)
  if (!group) notFound()
  const query = searchParams ? await searchParams : {}
  const [library, records, generationAttempts] = await Promise.all([
    readOriginalImageLibrary(),
    listOriginalImageRecords("complete-maps"),
    listConditionalRgbGenerationAttempts(),
  ])
  const selectedRecords = records.filter((record) => completeMapOriginalGroupFor(record) === typeId)
  const savedRecordIds = new Set(records.map((record) => record.recordId))
  const selectedAttempts = typeId === "failed-records"
    ? generationAttempts.filter((attempt) => !savedRecordIds.has(attempt.outputRecordId))
    : []
  const activities = buildActivities(selectedRecords, selectedAttempts)
  const selectedActivity = activities.find((activity) => activity.id === query.record) ?? activities[0] ?? null
  const imageCount = activities.filter((activity) =>
    activity.kind === "original_image" || activity.attempt.generatedImageCreated,
  ).length

  return (
    <main className={styles.page}>
      <OriginalImageLibraryLiveRefresh />
      <header className={styles.header}>
        <Link className={styles.back} href="/ai-painter-progress/original-images/complete-maps">返回完整地图原图类型</Link>
        <p className={styles.kicker}>ORIGINAL IMAGE LIBRARY / COMPLETE MAP TYPE</p>
        <h1>{group.title}</h1>
        <p>{group.description}</p>
        <dl className={styles.metrics}>
          <Metric label="类型标识" value={group.id} />
          <Metric label="活动记录" value={`${activities.length}`} />
          <Metric label="带图片记录" value={`${imageCount}`} />
          <Metric label="资料库状态" value={library.status} />
        </dl>
      </header>

      <section className={styles.panel}>
        <p className={styles.kicker}>STORAGE CONTRACT</p>
        <h2>真实目录与页面分类边界</h2>
        <p><code>{library.rootPath}/complete-maps/&lt;recordId&gt;/</code></p>
        <p>本页只按程序记录字段筛选并展示，不移动目录、不改名、不补造记录。新增记录和失败记录由程序自动写入后，会自动出现在对应类型。</p>
      </section>

      <section className={styles.panel}>
        <p className={styles.kicker}>SAVED RECORDS</p>
        <h2>程序自动保存的本类型记录</h2>
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
            <CompleteMapActivityCard activity={selectedActivity} />
          ) : (
            <article>
              <strong>当前没有本类型记录</strong>
              <span>{group.id}</span>
              <small>页面不会创建占位数据；程序保存符合本类型的记录后，这里才会自动出现。</small>
            </article>
          )}
        </div>
      </section>
    </main>
  )
}

function CompleteMapActivityCard({ activity }: { activity: CompleteMapActivity }) {
  if (activity.kind === "original_image") {
    const { record } = activity
    const sequenceLabel = record.autonomousGenerationTrainingOriginal?.sequenceLabel
    return (
      <article>
        {record.originalImage?.path ? (
          <Image
            className={styles.recordThumbnail}
            src={`/api/ai-painter/original-images/complete-maps/${record.recordId}`}
            alt={record.title}
            width={record.originalImage.width ?? 1024}
            height={record.originalImage.height ?? 768}
            unoptimized
          />
        ) : null}
        {sequenceLabel ? <span className={styles.pass}>{sequenceLabel}</span> : null}
        <strong>{record.title}</strong>
        <span>{record.relativeDirectory}</span>
        <small>recordId: {record.recordId} / 状态: {record.status} / 尺寸: {record.originalImage?.width ?? "--"}×{record.originalImage?.height ?? "--"}</small>
        <small>项目所有者审核: {stringField(record.reviews, "ownerReviewStatus")} / 时间: {formatTimestamp(activity.timestamp)}</small>
        <OwnerReviewControls
          categoryId="complete-maps"
          recordId={record.recordId}
          machineReviewStatus={stringField(record.reviews, "machineReviewStatus")}
          ownerReviewStatus={stringField(record.reviews, "ownerReviewStatus")}
        />
        <Link className={styles.textLink} href={`/ai-painter-progress/original-images/complete-maps/${record.recordId}`}>查看原图详情</Link>
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
): CompleteMapActivity[] {
  const activities: CompleteMapActivity[] = records.map((record) => ({
    id: `image:${record.recordId}`,
    kind: "original_image",
    timestamp: record.updatedAtUtc ?? record.createdAtUtc ?? record.updatedAtAsiaShanghai ?? record.createdAtAsiaShanghai ?? "",
    status: record.status,
    title: record.title,
    record,
  }))
  for (const attempt of attempts) {
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

function stringField(value: Record<string, unknown> | undefined, key: string) {
  const field = value?.[key]
  return typeof field === "string" ? field : "--"
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}
