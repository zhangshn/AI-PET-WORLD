"use client"

/**
 * 当前文件负责：新版世界页面入口；旧前端界面已停止使用。
 */

import NewWorldMvpPage from "./NewWorldMvpPage"
import { useWorldEngineState } from "./hooks/useWorldEngineState"

export default function WorldPage() {
  useWorldEngineState()

  return <NewWorldMvpPage />
}
