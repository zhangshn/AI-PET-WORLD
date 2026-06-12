"use client"

import { useState } from "react"
import styles from "./page.module.css"

export function TrainingControl() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState("批准新样本后，需要重新训练才能看到模型变化。")

  async function train() {
    setRunning(true)
    setMessage("正在使用当前已批准数据训练 100 epoch，请稍候...")
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
      <div><h3>重新训练当前模型</h3><p>{message}</p></div>
      <button type="button" disabled={running} onClick={train}>{running ? "正在训练..." : "重新训练并查看效果"}</button>
    </div>
  )
}
