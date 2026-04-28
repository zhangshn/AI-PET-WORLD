"use client"

/**
 * 当前文件负责：世界观察页入口。
 */

import WorldObserveLayout from "./layouts/WorldObserveLayout"
import { useWorldEngineState } from "./hooks/useWorldEngineState"

export default function WorldPage() {
  const world = useWorldEngineState()

  return <WorldObserveLayout world={world} />
}