"use client"

import { useState } from "react"
import styles from "./page.module.css"

export function TrainingControl() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("训练入口受 readiness 与当前模块范围双重阻断；这里只检查状态，不启动训练进程。")

  async function train() {
    setRunning(true)
    setMessage("正在检查训练数据 readiness，不会启动训练...")
    try {
      const response = await fetch("/api/ai-painter/train", { method: "POST" })
      const result = await response.json() as { ok: boolean; message: string; readiness?: { readinessStatus?: string } }
      setMessage(result.readiness?.readinessStatus ? `${result.message}｜readiness=${result.readiness.readinessStatus}` : result.message)
    } catch {
      setMessage("训练前检查请求失败，请检查本地开发服务。")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={styles.trainingControl}>
      <div><h3>训练前阻断检查</h3><p>{message}</p></div>
      <button type="button" disabled={running} onClick={train}>{running ? "正在检查..." : "只检查 readiness，不启动训练"}</button>
    </div>
  )
}
