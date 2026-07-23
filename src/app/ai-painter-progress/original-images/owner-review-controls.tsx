"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import styles from "../page.module.css"

type OwnerReviewControlsProps = {
  categoryId: string
  recordId: string
  machineReviewStatus: string
  ownerReviewStatus: string
}

export function OwnerReviewControls({
  categoryId,
  recordId,
  machineReviewStatus,
  ownerReviewStatus,
}: OwnerReviewControlsProps) {
  const router = useRouter()
  const [comment, setComment] = useState("")
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null)
  const [message, setMessage] = useState("")

  if (
    machineReviewStatus !== "machine_contract_passed_waiting_owner_visual_review"
    || ownerReviewStatus !== "pending_review"
  ) return null

  async function submit(decision: "approved" | "rejected") {
    if (decision === "rejected" && !comment.trim()) {
      setMessage("拒绝时必须填写具体原因和下一轮修复目标。")
      return
    }
    const confirmed = window.confirm(
      decision === "approved"
        ? "确认通过这张完整地图训练原图？程序将写入不可变审核记录，并在适用时登记 V7 容量贡献。"
        : "确认拒绝这张完整地图训练原图？程序将保存失败图、原因和下一轮修复目标。",
    )
    if (!confirmed) return

    setPendingDecision(decision)
    setMessage("")
    try {
      const response = await fetch(
        `/api/ai-painter/original-images/${categoryId}/${recordId}/owner-review`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, comment }),
        },
      )
      const result = await response.json() as { error?: string; status?: string }
      if (!response.ok) throw new Error(result.error ?? "审核程序执行失败。")
      setMessage(decision === "approved" ? "审核已通过，程序证据已保存。" : "审核已拒绝，失败学习证据已保存。")
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核程序执行失败。")
    } finally {
      setPendingDecision(null)
    }
  }

  return (
    <div className={styles.ownerReviewControls}>
      <label className={styles.field}>
        <span>审核说明（拒绝时必须填写具体原因和下一轮修复目标）</span>
        <textarea
          disabled={pendingDecision !== null}
          maxLength={2000}
          onChange={(event) => setComment(event.target.value)}
          placeholder="填写你的审核意见"
          value={comment}
        />
      </label>
      <div className={styles.ownerReviewActions}>
        <button
          className={styles.approveButton}
          disabled={pendingDecision !== null}
          onClick={() => void submit("approved")}
          type="button"
        >
          {pendingDecision === "approved" ? "正在保存..." : "通过"}
        </button>
        <button
          className={styles.rejectButton}
          disabled={pendingDecision !== null}
          onClick={() => void submit("rejected")}
          type="button"
        >
          {pendingDecision === "rejected" ? "正在保存..." : "拒绝"}
        </button>
      </div>
      {message ? <p className={styles.reviewMessage}>{message}</p> : null}
    </div>
  )
}
