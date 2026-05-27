import type { WorldRuntimeSaveRecord } from "@/world/runtime/world-runtime-schema"

import styles from "../world-route-page.styles.module.css"

export function ButlerNaturalExplanation(input: {
  saveRecord: WorldRuntimeSaveRecord
}) {
  const sentence = buildButlerNaturalExplanation(input.saveRecord)

  return (
    <article className={styles.panel} aria-label="Butler natural explanation">
      <h2>管家观察</h2>
      <p>{sentence}</p>
    </article>
  )
}

function buildButlerNaturalExplanation(saveRecord: WorldRuntimeSaveRecord): string {
  const decision = saveRecord.lastButlerRuntimeDecision
  const traceContext = decision?.traceContext
  const resources = saveRecord.homeMapState.resources
  const selectedMotivation = decision?.selectedMotivation ?? "observe_world"
  const memorySeedCount = traceContext?.memorySeedCount ?? 0
  const memorySeedBias = traceContext?.memorySeedConsumeScore ?? 0
  const tracePressure = traceContext?.tracePressure ?? 0
  const lowMaterial = resources.materialReadiness < 10
  const lowCare = resources.careReadiness < 18
  const lowGround = resources.groundHealth < 35

  if (selectedMotivation === "wait_for_resources") {
    if (memorySeedCount > 0 && memorySeedBias > 0) {
      return "现在资源还不适合继续推进，我会先观察这些已经稳定下来的痕迹，等家园状态更稳一点再行动。"
    }

    return "现在资源还不够稳定，我会先等待，不急着给家园增加新的变化。"
  }

  if (selectedMotivation === "maintain_home") {
    if (lowCare || lowGround || tracePressure > 30) {
      return "我会先照看已有区域，让被反复使用的地方慢慢恢复稳定。"
    }

    return "家园目前比较平稳，我会做一些轻量维护，避免打扰世界自己的节奏。"
  }

  if (selectedMotivation === "continue_construction") {
    if (lowMaterial) {
      return "我看到了建设方向，但材料还需要积累，所以不会强行推进。"
    }

    return "当前条件允许继续建设，我会沿着已有计划谨慎推进。"
  }

  if (memorySeedCount > 0) {
    return "我会继续观察这些留下来的生活痕迹，它们还只是提示，不会直接决定下一步行动。"
  }

  return "我会先安静观察家园状态，等待更明确的变化出现。"
}
