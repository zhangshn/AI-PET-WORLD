"use client"

import { useEffect, useState } from "react"
import styles from "./page.module.css"

type Draft = { sampleId: string; subtype: string; notes: string; imageUrl: string }

export function TrainingDraftReview() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [status, setStatus] = useState("正在读取待审核训练图...")
  const [busy, setBusy] = useState("")

  useEffect(() => { void loadDrafts() }, [])

  async function loadDrafts() {
    const response = await fetch("/api/ai-painter/dataset/review-queue", { cache: "no-store" })
    const result = await response.json() as { drafts?: Draft[] }
    setDrafts(result.drafts ?? [])
    setStatus(result.drafts?.length ? "请逐张确认画面、结构和训练用途。" : "当前没有待审核训练图。")
  }

  async function approve(sampleId: string) {
    setBusy(sampleId)
    setStatus(`正在批准并导入 ${sampleId}...`)
    const response = await fetch(`/api/ai-painter/dataset/review-queue/${sampleId}/approve`, { method: "POST" })
    const result = await response.json() as { ok: boolean; message: string }
    setStatus(result.message)
    setBusy("")
    if (result.ok) await loadDrafts()
  }

  return (
    <div>
      <p className={styles.draftStatus}>{status}</p>
      <div className={styles.draftGrid}>
        {drafts.map((draft) => (
          <article key={draft.sampleId}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.imageUrl} alt={`${draft.sampleId} 待审核训练图`} />
            <h3>{draft.sampleId}</h3><p>{draft.notes}</p>
            <button type="button" disabled={Boolean(busy)} onClick={() => approve(draft.sampleId)}>
              {busy === draft.sampleId ? "正在导入..." : "批准并导入训练集"}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}
