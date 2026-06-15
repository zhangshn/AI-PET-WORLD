"use client"

import { useMemo, useState } from "react"
import type { CandidateReviewDecision as Decision, CandidateReviewItem as Candidate } from "./candidate-review-data"
import styles from "./page.module.css"

export function CandidateReviewPanel({ initialCandidates }: { initialCandidates: Candidate[] }) {
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates)
  const [selectedId, setSelectedId] = useState(
    initialCandidates.find((item) => !item.review)?.assetId ?? initialCandidates[0]?.assetId ?? "",
  )
  const [reason, setReason] = useState("")
  const [message, setMessage] = useState(`已读取 ${initialCandidates.length} 个候选。`)
  const [saving, setSaving] = useState(false)

  async function loadCandidates(preferredId?: string) {
    const response = await fetch("/api/ai-painter/candidate-reviews", { cache: "no-store" })
    const payload = await response.json() as { candidates?: Candidate[]; error?: string }
    if (!response.ok || !payload.candidates) throw new Error(payload.error ?? "候选读取失败")
    setCandidates(payload.candidates)
    const nextId = preferredId && payload.candidates.some((item) => item.assetId === preferredId)
      ? preferredId
      : payload.candidates.find((item) => !item.review)?.assetId ?? payload.candidates[0]?.assetId ?? ""
    setSelectedId(nextId)
    setMessage(`已读取 ${payload.candidates.length} 个候选。`)
  }

  const selected = candidates.find((item) => item.assetId === selectedId) ?? null
  const summary = useMemo(() => ({
    pending: candidates.filter((item) => !item.review).length,
    acceptable: candidates.filter((item) => item.review?.decision === "acceptable").length,
    unacceptable: candidates.filter((item) => item.review?.decision === "unacceptable").length,
    redraw: candidates.filter((item) => item.review?.decision === "redraw").length,
  }), [candidates])

  async function submit(decision: Decision) {
    if (!selected || selected.review || saving) return
    setSaving(true)
    setMessage("正在保存审核记录……")
    try {
      const response = await fetch("/api/ai-painter/candidate-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selected.assetId, decision, reasonZh: reason.trim() }),
      })
      const payload = await response.json() as { error?: string }
      if (!response.ok) throw new Error(payload.error ?? "审核保存失败")
      setReason("")
      await loadCandidates()
      setMessage(decision === "redraw" ? "已退回重画，未进入质量样本。" : "审核已保存并登记 VJ-B2 质量样本。")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div><small>VJ-B2 MANUAL REVIEW</small><h2>树木候选视觉审核</h2></div>
        <p>技术指标通过不代表画面合格。审核结论绑定当前图片哈希，且不会自动把候选转成正式训练资产。</p>
      </div>

      <div className={styles.reviewSummary}>
        <span>待审核 <strong>{summary.pending}</strong></span>
        <span>合格 <strong>{summary.acceptable}</strong></span>
        <span>不合格 <strong>{summary.unacceptable}</strong></span>
        <span>退回重画 <strong>{summary.redraw}</strong></span>
      </div>

      <div className={styles.reviewWorkspace}>
        <aside className={styles.reviewQueue}>
          {candidates.map((candidate) => (
            <button
              type="button"
              key={candidate.assetId}
              className={candidate.assetId === selectedId ? styles.reviewQueueActive : ""}
              onClick={() => { setSelectedId(candidate.assetId); setReason("") }}
            >
              <span>{candidate.assetId}</span>
              <small>{decisionLabel(candidate.review?.decision)}</small>
            </button>
          ))}
        </aside>

        <div className={styles.reviewDetail}>
          {!selected ? <p>当前没有可审核候选。</p> : (
            <>
              <h3>{selected.assetId}</h3>
              <p>VJ-A / VJ-B1：{selected.technicalPassed ? "已通过" : "未通过，禁止审核"}</p>
              <div className={styles.reviewImages}>
                <ReviewImage assetId={selected.assetId} view="sprite" label="候选精灵图" />
                <ReviewImage assetId={selected.assetId} view="mask-tree_trunk" label="树干 Mask" />
                <ReviewImage assetId={selected.assetId} view="mask-tree_crown" label="树冠 Mask" />
                <ReviewImage assetId={selected.assetId} view="mask-object_alpha" label="整体 Alpha" />
              </div>

              {selected.drawingProfile && (
                <div className={styles.profilePanel}>
                  <h4>同源绘制档案</h4>
                  <div className={styles.profileGrid}>
                    <ProfileValue label="主体占比" value={formatPercent(selected.drawingProfile.silhouette.coverageRatio)} />
                    <ProfileValue label="轮廓宽高比" value={selected.drawingProfile.silhouette.widthHeightRatio.toFixed(2)} />
                    <ProfileValue label="左右平衡" value={formatPercent(selected.drawingProfile.silhouette.horizontalSymmetry)} />
                    <ProfileValue label="树干占比" value={formatPercent(selected.drawingProfile.trunk.areaRatio)} />
                    <ProfileValue label="树冠占比" value={formatPercent(selected.drawingProfile.crown.areaRatio)} />
                    <ProfileValue label="有效颜色" value={`${selected.drawingProfile.colorAndLight.paletteColorCount} 种`} />
                    <ProfileValue label="明暗跨度" value={selected.drawingProfile.colorAndLight.luminanceRange.toFixed(0)} />
                    <ProfileValue label="干冠连接" value={selected.drawingProfile.structure.trunkCrownConnected ? "正常" : "异常"} />
                  </div>
                  <details>
                    <summary>查看完整绘制参数</summary>
                    <pre>{JSON.stringify(selected.drawingProfile.sourceParameters, null, 2)}</pre>
                  </details>
                </div>
              )}

              {selected.referenceComparison && (
                <div className={styles.comparisonPanel}>
                  <h4>标准树参考比对</h4>
                  <p>
                    合格参考 {selected.referenceComparison.referenceCount} 张，相似度 {formatPercent(selected.referenceComparison.similarityScore)}；
                    不合格边界 {selected.referenceComparison.rejectedReferenceCount} 张，相似度 {formatPercent(selected.referenceComparison.rejectionSimilarityScore)}；
                    质量差值 {formatSignedPercent(selected.referenceComparison.qualityMargin)}；建议：{recommendationLabel(selected.referenceComparison.recommendation)}
                  </p>
                  {selected.referenceComparison.warningsZh.length > 0 && <ul>{selected.referenceComparison.warningsZh.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
                  <div className={styles.referenceList}>
                    {selected.referenceComparison.nearestReferences.slice(0, 3).map((reference) => (
                      <span key={reference.assetId}>{reference.assetId}：{formatPercent(reference.similarityScore)}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.review ? (
                <div className={styles.reviewExisting}>
                  <strong>审核结论：{decisionLabel(selected.review.decision)}</strong>
                  <p>{selected.review.reasonZh}</p>
                  <small>{new Date(selected.review.reviewedAt).toLocaleString("zh-CN")}</small>
                </div>
              ) : (
                <div className={styles.reviewForm}>
                  <label htmlFor="candidate-review-reason">中文审核依据（可选）</label>
                  <textarea
                    id="candidate-review-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="留空时系统会根据你的结论和标准树比对结果自动记录依据。"
                  />
                  <div className={styles.reviewActions}>
                    <button type="button" disabled={saving || !selected.technicalPassed} onClick={() => void submit("acceptable")}>视觉合格</button>
                    <button type="button" disabled={saving || !selected.technicalPassed} onClick={() => void submit("unacceptable")}>视觉不合格</button>
                    <button type="button" disabled={saving || !selected.technicalPassed} onClick={() => void submit("redraw")}>退回重画</button>
                  </div>
                </div>
              )}
              <p className={styles.reviewMessage}>{message}</p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function ProfileValue({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatSignedPercent(value: number) {
  const percent = Math.round(value * 100)
  return `${percent > 0 ? "+" : ""}${percent}%`
}

function recommendationLabel(value: "reference_match" | "reference_mismatch" | "uncertain") {
  if (value === "reference_match") return "接近标准"
  if (value === "reference_mismatch") return "偏离标准"
  return "需要确认"
}

function ReviewImage({ assetId, view, label }: { assetId: string; view: string; label: string }) {
  return (
    <figure>
      <img src={`/api/ai-painter/assets/${encodeURIComponent(assetId)}/${view}`} alt={`${assetId} ${label}`} />
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function decisionLabel(decision?: Decision) {
  if (decision === "acceptable") return "视觉合格"
  if (decision === "unacceptable") return "视觉不合格"
  if (decision === "redraw") return "退回重画"
  return "待审核"
}
