"use client"

import { useMemo, useState } from "react"
import type { SceneBlueprintV1, SceneDatasetItem } from "./scene-annotation-types"
import styles from "./page.module.css"

type ReviewDecision = "approved" | "rejected" | "needs_correction" | ""
type Props = { scene: SceneDatasetItem; blueprint: SceneBlueprintV1; onReviewed: () => Promise<void> }

export function SceneReviewPanelV1({ scene, blueprint, onReviewed }: Props) {
  const pending = useMemo(() => blueprint.structures.filter((item) => item.requiresManualReview), [blueprint])
  const [reviewer, setReviewer] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({})
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const unfinished = pending.filter((item) => !decisions[item.id])
  const blocked = pending.filter((item) => decisions[item.id] === "rejected" || decisions[item.id] === "needs_correction")
  const hashReady = Boolean(scene.blueprintV1Hash && scene.targetImageHash)
  const canSubmit = pending.length > 0 && unfinished.length === 0 && blocked.length === 0 && reviewer.trim() && hashReady

  async function submitReview() {
    if (!canSubmit) return
    setSaving(true)
    setStatus("正在提交逐项人工复核...")
    const body = {
      sampleId: scene.sampleId,
      reviewer: reviewer.trim(),
      blueprintHash: scene.blueprintV1Hash,
      targetImageHash: scene.targetImageHash,
      overallDecision: "approved",
      overallConfirmation: true,
      decisions: pending.map((item) => ({
        structureId: item.id,
        type: item.type,
        decision: decisions[item.id],
        reviewerNote: notes[item.id] ?? "",
      })),
    }
    try {
      const response = await fetch(`/api/ai-painter/dataset/scenes/${scene.sampleId}/review-v1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { ok: boolean; message: string }
      setStatus(result.message)
      if (result.ok) await onReviewed()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.annotationSummary}>
      <h3>v1 逐项人工复核</h3>
      <p>Blueprint：{shortHash(scene.blueprintV1Hash)}</p>
      <p>target.png：{shortHash(scene.targetImageHash)}</p>
      <label>审核人<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="reviewer" /></label>
      <p>未完成：{unfinished.length} / 待复核：{pending.length}</p>
      {pending.length === 0 && <p>当前没有待复核结构。</p>}
      {pending.map((item) => (
        <div key={item.id} className={styles.annotationSummary}>
          <strong>{item.id}</strong>
          <p>通道：{item.type}</p>
          <p>原因：{item.manualReviewReasons.join("；") || "未记录原因"}</p>
          <label>决定<select value={decisions[item.id] ?? ""} onChange={(event) => setDecisions({ ...decisions, [item.id]: event.target.value as ReviewDecision })}>
            <option value="">请选择</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="needs_correction">needs_correction</option>
          </select></label>
          <label>备注<textarea value={notes[item.id] ?? ""} onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })} /></label>
        </div>
      ))}
      {blocked.length > 0 && <p>存在退回或需要修正项目，不能生成复核记录。</p>}
      {!hashReady && <p>缺少 Blueprint 或 target 哈希，不能提交。</p>}
      <button type="button" disabled={saving || !canSubmit} onClick={submitReview}>{saving ? "正在提交" : "提交逐项复核"}</button>
      {status && <p>{status}</p>}
    </section>
  )
}

function shortHash(value?: string | null) {
  return value ? value.slice(0, 12) : "未生成"
}
