"use client"

// ======================================================
// AI-PET-WORLD
// 世界页面 (World Page)
//
// 作用：
// 这是玩家进入游戏后看到的世界。
// 页面会启动 WorldEngine。
//
// 当前版本功能：
// - 显示世界 Tick
// - 世界自动运行
//
// 后续这里会加入：
// - PixiJS 世界
// - 宠物
// - 管家
// - 事件系统
// ======================================================

import { useEffect, useState } from "react"
import { WorldEngine, WorldState } from "../../engine/worldEngine"


export default function WorldPage() {

  // 世界状态
  const [world, setWorld] = useState<WorldState>({
    tick: 0
  })


  useEffect(() => {

    // 创建世界引擎
    const engine = new WorldEngine({

      // 每次世界更新
      onUpdate: (state) => {

        setWorld(state)

      }

    })

    // 启动世界
    engine.start()

    // 页面关闭时停止
    return () => engine.stop()

  }, [])


  return (

    <div style={{
      padding: "40px",
      fontFamily: "monospace"
    }}>

      <h1>🌍 AI PET WORLD</h1>

      <h2>World Tick: {world.tick}</h2>

      <p>
        世界正在自动运行...
      </p>

    </div>

  )

}