"use client"

import { useEffect, useMemo, useState } from "react"
import { CONDITION_CHANNELS_V1 } from "./ai-painter-lab-data"
import styles from "./page.module.css"

type ChannelSummary = {
  samples: number
  nonEmptySamples: number
  emptySamples: number
  minNonZeroPixels: number
  maxNonZeroPixels: number
  averageNonZeroPixels: number
  coverageRatio: number
}

type SampleStatus = {
  sampleId: string
  status: string
  trainable: boolean
  split?: string | null
  pendingReviewStructures?: number
  blockingReasons: string[]
  warnings?: string[]
}

type ReadinessReport = {
  readinessStatus: string
  readyForFirstTraining: boolean
  engineeringValidationReady: boolean
  sampleCount: number
  trainableSampleCount: number
  blockedSampleCount: number
  statusCounts: Record<string, number>
  splits: { splits: Record<string, { count: number; sampleIds: string[] }> }
  channelSummary: Record<string, ChannelSummary>
  duplicateTargets: Array<{ sha256: string; sampleIds: string[] }>
  warnings: string[]
  blockers: string[]
  readinessReasons: string[]
  samples: SampleStatus[]
}

type StatusResponse = { ok: boolean; report?: ReadinessReport; message?: string }

export function V1DatasetManagementPanel() {
  const [report, setReport] = useState<ReadinessReport | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [forceMigration, setForceMigration] = useState(false)
  const [status, setStatus] = useState("正在读取训练数据状态...")
  const [busy, setBusy] = useState(false)

  useEffect(() => { void load() }, [])
  const v0Only = useMemo(() => report?.samples.filter((item) => item.status === "v0_only") ?? [], [report])
  const forceable = useMemo(() => report?.samples.filter((item) => item.status === "v1_draft" || item.status === "review_pending" || item.status === "blocked") ?? [], [report])
  const pending = useMemo(() => report?.samples.filter((item) => item.status === "review_pending") ?? [], [report])
  const untrainable = useMemo(() => report?.samples.filter((item) => !item.trainable) ?? [], [report])
  const selectable = forceMigration ? forceable : v0Only
  const selectedIds = Object.keys(selected).filter((key) => selected[key])

  async function load() {
    const response = await fetch("/api/ai-painter/dataset/v1-status", { cache: "no-store" })
    const result = await response.json() as StatusResponse
    if (!result.ok || !result.report) {
      setStatus(result.message ?? "读取训练数据状态失败。")
      return
    }
    setReport(result.report)
    setStatus("训练数据状态已刷新。")
  }

  async function migrate() {
    if (selectedIds.length === 0) return
    if (forceMigration && !window.confirm("确认重新生成选中样本的 v1 草案？已有 Review Record 的样本仍会被拒绝覆盖。")) return
    setBusy(true)
    setStatus(`正在批量迁移 ${selectedIds.length} 个样本...`)
    try {
      const response = await fetch("/api/ai-painter/dataset/scenes/migrate-v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: selectedIds, force: forceMigration }),
      })
      const result = await response.json() as { ok: boolean; message: string; result?: { results?: Array<{ sampleId: string; status: string; reason?: string }> } }
      setStatus(`${result.message}${result.result?.results ? "｜" + result.result.results.map((item) => `${item.sampleId}:${item.status}${item.reason ? ":" + item.reason : ""}`).join("；") : ""}`)
      setSelected({})
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function updateIndexes() {
    setBusy(true)
    setStatus("正在按可训练 v1 样本更新 train/validation 索引...")
    try {
      const response = await fetch("/api/ai-painter/dataset/index-v1", { method: "POST" })
      const result = await response.json() as { message: string }
      setStatus(result.message)
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!report) return <p className={styles.annotationEmpty}>{status}</p>

  return (
    <div className={styles.annotationEditor}>
      <div className={styles.sectionHeading}>
        <div><small>V1 DATASET MANAGEMENT</small><h2>训练数据 v1 准备总控</h2></div>
        <p>{status}</p>
      </div>
      <div className={styles.inferenceMeta}>
        <Metric label="样本总数" value={report.sampleCount} />
        <Metric label="可训练" value={report.trainableSampleCount} />
        <Metric label="待迁移" value={report.statusCounts.v0_only ?? 0} />
        <Metric label="待复核" value={report.statusCounts.review_pending ?? 0} />
        <Metric label="阻断" value={report.blockedSampleCount} />
        <Metric label="train" value={report.splits.splits.train?.count ?? 0} />
        <Metric label="validation" value={report.splits.splits.validation?.count ?? 0} />
        <Metric label="就绪状态" value={statusLabel(report.readinessStatus)} />
      </div>

      <section className={styles.annotationSummary}>
        <h3>批量 v0 → v1 迁移</h3>
        <p>默认只显示缺少 blueprint.v1.json 的 v0_only 样本，禁止覆盖现有 v1、review record、masks_v1 和 target.png。</p>
        <label><input type="checkbox" checked={forceMigration} onChange={(event) => { setForceMigration(event.target.checked); setSelected({}) }} />需要重新生成已有 v1 草案时启用 force，执行前会再次确认</label>
        <button type="button" disabled={busy || selectable.length === 0} onClick={() => setSelected(Object.fromEntries(selectable.map((item) => [item.sampleId, true])))}>全选当前可迁移样本</button>
        <button type="button" disabled={busy || selectedIds.length === 0} onClick={migrate}>执行批量迁移</button>
        <div className={styles.stageList}>{selectable.map((item) => (
          <label key={item.sampleId}>
            <input type="checkbox" checked={Boolean(selected[item.sampleId])} onChange={(event) => setSelected({ ...selected, [item.sampleId]: event.target.checked })} />
            {item.sampleId}｜{item.status}
          </label>
        ))}</div>
      </section>

      <section className={styles.annotationSummary}>
        <h3>待复核样本队列</h3>
        {pending.length === 0 && <p>当前没有 review_pending 样本。</p>}
        <div className={styles.maskGrid}>{pending.map((item) => (
          <article className={styles.maskCard} key={item.sampleId}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/ai-painter/dataset/scenes/${item.sampleId}/image?original=1`} alt={`${item.sampleId} 待复核缩略图`} />
            <div><b>{item.sampleId}</b><code>review_pending</code></div>
            <p>待复核结构：{item.pendingReviewStructures ?? 0} 个。请在下方 v1 逐项复核面板中处理。</p>
            {item.blockingReasons.map((reason) => <p key={reason}>原因：{reason}</p>)}
          </article>
        ))}</div>
      </section>

      <section className={styles.annotationSummary}>
        <h3>训练索引与就绪检查</h3>
        <button type="button" disabled={busy} onClick={updateIndexes}>按可训练样本更新 train/validation 索引</button>
        <p>工程验证：至少 20 个可训练样本且 validation 至少 2 个。正式训练：至少 100 个高质量可训练样本。</p>
        <p>当前 readiness：{report.readinessStatus}；readyForFirstTraining={String(report.readyForFirstTraining)}。</p>
        {report.readinessReasons.map((item) => <p key={item}>原因：{item}</p>)}
      </section>

      <section className={styles.annotationSummary}>
        <h3>14 通道覆盖统计</h3>
        <div className={styles.maskGrid}>{CONDITION_CHANNELS_V1.map((channel) => {
          const item = report.channelSummary[channel.id]
          return <article className={styles.maskCard} key={channel.id}><div><b>{channel.zh}</b><code>{channel.id}</code></div><p>非空 {item?.nonEmptySamples ?? 0}/{item?.samples ?? 0}｜最小 {item?.minNonZeroPixels ?? 0}｜最大 {item?.maxNonZeroPixels ?? 0}｜平均非零像素 {item?.averageNonZeroPixels ?? 0}｜覆盖 {Math.round((item?.coverageRatio ?? 0) * 100)}%</p></article>
        })}</div>
      </section>

      <section className={styles.annotationSummary}>
        <h3>不可训练样本及原因</h3>
        {untrainable.length === 0 ? <p>当前所有样本均通过完整校验。</p> : untrainable.map((item) => (
          <article className={styles.annotationSummary} key={item.sampleId}>
            <strong>{item.sampleId}</strong>
            <p>状态：{item.status}｜split：{item.split ?? "未进入索引"}</p>
            {item.blockingReasons.length === 0 ? <p>尚未发现阻断原因，但仍未满足 trainable 条件。</p> : item.blockingReasons.map((reason) => <p key={reason}>原因：{reason}</p>)}
          </article>
        ))}
      </section>

      <section className={styles.annotationSummary}>
        <h3>阻断与警告</h3>
        {report.blockers.length === 0 ? <p>没有数据完整性阻断项。</p> : report.blockers.map((item) => <p key={item}>阻断：{item}</p>)}
        {report.warnings.map((item) => <p key={item}>警告：{item}</p>)}
        {report.duplicateTargets.map((item) => <p key={item.sha256}>重复图片：{item.sampleIds.join("，")}</p>)}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string | number | boolean; value: string | number | boolean }) {
  return <div><dt>{label}</dt><dd>{String(value)}</dd></div>
}

function statusLabel(value: string) {
  if (value === "first_training_ready") return "正式训练就绪"
  if (value === "engineering_validation_ready") return "工程验证就绪"
  return "未就绪"
}
