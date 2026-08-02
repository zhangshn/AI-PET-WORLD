import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  completeMapOriginalGroupFor,
  findCompleteMapOriginalGroup,
  findOriginalImageRecord,
  originalImageProjectPath,
} from "@/server/ai-painter-original-image-library"
import styles from "../../../page.module.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "原图记录详情 | AI-PET-WORLD",
}

type PageProps = { params: Promise<{ categoryId: string; recordId: string }> }

export default async function OriginalImageRecordPage({ params }: PageProps) {
  const { categoryId, recordId } = await params
  const record = await findOriginalImageRecord(categoryId, recordId)
  if (!record) notFound()
  const imageUrl = `/api/ai-painter/original-images/${categoryId}/${recordId}`
  const completeMapGroup = categoryId === "complete-maps"
    ? findCompleteMapOriginalGroup(completeMapOriginalGroupFor(record))
    : null
  const backHref = completeMapGroup
    ? `/ai-painter-progress/original-images/complete-maps/types/${completeMapGroup.id}`
    : `/ai-painter-progress/original-images/${categoryId}`

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.back} href={backHref}>返回{completeMapGroup?.title ?? "原图分类"}</Link>
        <p className={styles.kicker}>ORIGINAL IMAGE LIBRARY / RECORD</p>
        <h1>{record.title}</h1>
        <p>本页只读取程序保存的单条原图记录，不改变审核、训练资格或正式登记状态。</p>
        <dl className={styles.metrics}>
          <Metric label="recordId" value={record.recordId} />
          <Metric label="状态" value={record.status} />
          <Metric label="尺寸" value={`${record.originalImage?.width ?? "--"}×${record.originalImage?.height ?? "--"}`} />
          <Metric label="北京时间" value={record.updatedAtAsiaShanghai ?? record.createdAtAsiaShanghai ?? "--"} />
        </dl>
      </header>

      <section className={styles.resultGrid}>
        <article className={styles.resultCard}>
          <span className={["eligible", "registered", "ai_assisted_cold_start_eligible"].includes(record.status) ? styles.pass : styles.fail}>{record.status}</span>
          {record.rebuild64Sequence?.sequenceLabel || record.autonomousGenerationTrainingOriginal?.sequenceLabel ? (
            <span className={styles.pass}>{record.rebuild64Sequence?.sequenceLabel ?? record.autonomousGenerationTrainingOriginal?.sequenceLabel}</span>
          ) : null}
          <h2>{record.originalImage?.fileName ?? "原图文件未记录"}</h2>
          <p><code>{originalImageProjectPath(record)}</code></p>
          {record.originalImage?.path ? (
            <Image
              src={imageUrl}
              alt={record.title}
              width={record.originalImage.width ?? 1024}
              height={record.originalImage.height ?? 768}
              unoptimized
            />
          ) : <p>record.json 没有绑定原图路径。</p>}
        </article>

        <article className={styles.resultCard}>
          <h2>来源与权属</h2>
          <p>来源类型：{record.source?.sourceType ?? "--"}</p>
          <p>创作方式：{record.source?.creationMethod ?? "--"}</p>
          <p>权利人：{record.source?.rightsHolder ?? "--"}</p>
          <p>第三方内容：{formatBoolean(record.source?.thirdPartyContentUsed)}</p>
          <p>第三方生成模型：{formatBoolean(record.source?.thirdPartyGenerativeModelUsed)}</p>
          <p>复制既有作品：{formatBoolean(record.source?.copiedFromExistingWork)}</p>
          <p>SHA-256：<code>{record.originalImage?.sha256 ?? "--"}</code></p>
        </article>
      </section>

      <JsonPanel title="世界绑定" value={record.worldBinding} />
      <JsonPanel title="分类与状态" value={record.classification} />
      <JsonPanel title="审核记录" value={record.reviews} />
    </main>
  )
}

function JsonPanel({ title, value }: { title: string; value?: Record<string, unknown> }) {
  return <section className={styles.panel}><h2>{title}</h2><p><code>{value ? JSON.stringify(value, null, 2) : "--"}</code></p></section>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function formatBoolean(value?: boolean) {
  if (value === true) return "是"
  if (value === false) return "否"
  return "--"
}
