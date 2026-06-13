"use client"

import { useState } from "react"
import styles from "./page.module.css"

export function TrainingControl() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("训练入口受 readiness 阻断；未达到正式训练条件不会启动训练进程。")

  async function train() {
    setRunning(true)
    setMessage("正在检查训练数据 readiness...")
    try {
      const response = await fetch("/api/ai-painter/train", { method: "POST" })
      const result = await response.json() as { ok: boolean; message: string; meanMae?: number; meanPsnr?: number }
      if (result.ok) {
        setMessage(`${result.message} MAE ${result.meanMae?.toFixed(4)}，PSNR ${result.meanPsnr?.toFixed(2)} dB。`)
        window.location.reload()
      } else {
        setMessage(result.message)
      }
    } catch {
      setMessage("训练请求失败，请检查本地开发服务。")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={styles.trainingControl}>
      <div><h3>训练前阻断检查</h3><p>{message}</p></div>
      <button type="button" disabled={running} onClick={train}>{running ? "正在检查..." : "检查 readiness 并阻断未就绪训练"}</button>
    </div>
  )
}
