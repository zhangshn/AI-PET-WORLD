"use client"

import { useEffect, useState } from "react"
import { WorldEngine, WorldState } from "../engine/worldEngine"

/**
 * ======================================================
 * AI-PET-WORLD
 * Home Page
 *
 * 功能：
 * 1. 展示世界运行信息
 * 2. 展示管家状态
 * 3. 展示孵化器状态
 * 4. 展示家园状态
 * 5. 宠物出生后展示宠物信息与最终人格
 *
 * 正确业务逻辑：
 * - 胚胎阶段不显示任何人格信息
 * - 人格只在宠物出生后展示
 * ======================================================
 */

export default function HomePage() {
  const [worldState, setWorldState] = useState<WorldState | null>(null)

  useEffect(() => {
    const engine = new WorldEngine()

    engine.onUpdate = (newState: WorldState) => {
      setWorldState(newState)
    }

    engine.start()

    return () => {
      engine.stop()
    }
  }, [])

  if (!worldState) {
    return <div style={{ padding: 20 }}>世界加载中...</div>
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>🌍 AI PET WORLD</h1>

      <h2>世界信息</h2>
      <p>Tick：{worldState.tick}</p>
      <p>{worldState.time}</p>

      <h2>管家信息</h2>
      <p>名字：{worldState.butler.name}</p>
      <p>任务：{worldState.butler.task}</p>
      <p>心情：{worldState.butler.mood}</p>

      <h2>孵化器信息</h2>
      <p>是否存在胚胎：{worldState.incubator.hasEmbryo ? "是" : "否"}</p>
      <p>胚胎名字：{worldState.incubator.embryoName}</p>
      <p>孵化进度：{worldState.incubator.progress}%</p>
      <p>稳定度：{worldState.incubator.stability}</p>
      <p>孵化状态：{worldState.incubator.status}</p>

      <h2>家园信息</h2>
      <p>等级：{worldState.home.level}</p>
      <p>状态：{worldState.home.status}</p>
      <p>建造进度：{worldState.home.progress}%</p>

      <h2>宠物信息</h2>
      {worldState.pet ? (
        <>
          <p>名字：{worldState.pet.name}</p>
          <p>精力：{worldState.pet.energy}</p>
          <p>饥饿：{worldState.pet.hunger}</p>
          <p>心情：{worldState.pet.mood}</p>
          <p>行为：{worldState.pet.action}</p>

          <h3>最终人格结果</h3>
          <p>
            核心区域：{worldState.pet.personalityProfile.pattern.primarySector}
          </p>
          <p>
            出生键：{worldState.pet.personalityProfile.pattern.birthKey}
          </p>
          <p>
            联动区域：
            {worldState.pet.personalityProfile.pattern.supportSectors.join("、")}
          </p>
          <p>
            关键符号：
            {worldState.pet.personalityProfile.pattern.supportSymbols.join("、")}
          </p>

          <h3>人格摘要</h3>
          <ul style={{ paddingLeft: 20 }}>
            {worldState.pet.personalityProfile.summaries.map((summary, index) => (
              <li key={`${summary}-${index}`}>{summary}</li>
            ))}
          </ul>

          <h3>人格 Traits</h3>
          <p>行动倾向：{worldState.pet.personalityProfile.traits.activity}</p>
          <p>休息偏好：{worldState.pet.personalityProfile.traits.restPreference}</p>
          <p>食欲倾向：{worldState.pet.personalityProfile.traits.appetite}</p>
          <p>纪律性：{worldState.pet.personalityProfile.traits.discipline}</p>
          <p>好奇倾向：{worldState.pet.personalityProfile.traits.curiosity}</p>
          <p>
            情绪敏感度：
            {worldState.pet.personalityProfile.traits.emotionalSensitivity}
          </p>
          <p>稳定性：{worldState.pet.personalityProfile.traits.stability}</p>
          <p>照料倾向：{worldState.pet.personalityProfile.traits.caregiving}</p>
          <p>
            建设倾向：
            {worldState.pet.personalityProfile.traits.buildingPreference}
          </p>
        </>
      ) : (
        <p>当前还没有已出生宠物，宠物仍在孵化器中成长。</p>
      )}

      <h2>事件日志</h2>
      {worldState.events.length === 0 ? (
        <p>暂时还没有事件...</p>
      ) : (
        <ul style={{ paddingLeft: 20 }}>
          {worldState.events.map((event) => (
            <li key={event.id} style={{ marginBottom: 8 }}>
              <strong>
                [第 {event.day} 天 - {event.hour.toString().padStart(2, "0")}:00]
              </strong>{" "}
              {event.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}