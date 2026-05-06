"use client"

/**
 * 当前文件负责：组合管家 Profile、任务审计与记忆开发面板。
 */

import { useState } from "react"

import type { ButlerProfile } from "@/ai/gateway"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"

import ButlerMemoryDebugPanel from "./butler-debug/ButlerMemoryDebugPanel"
import ButlerProfileDebugPanel from "./butler-debug/ButlerProfileDebugPanel"
import ButlerProfileInputPanel from "./butler-debug/ButlerProfileInputPanel"
import ButlerTaskDecisionTracePanel from "./butler-debug/ButlerTaskDecisionTracePanel"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  world: WorldEngineViewState
}

export default function ButlerProfileSetupPanel({ world }: Props) {
  const [lastGeneratedProfile, setLastGeneratedProfile] =
    useState<ButlerProfile | null>(world.butler?.profile ?? null)

  const currentProfile = world.butler?.profile ?? lastGeneratedProfile
  const taskDecisionTrace =
    world.butler?.latestTaskDecisionTrace ?? null
  const memory = world.butler?.memory ?? null

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          管家 Profile / Agent Debug
        </h2>

        <span className={styles.tick}>
          Dev Only
        </span>
      </div>

      <div className={styles.grid}>
        <ButlerProfileInputPanel
          world={world}
          onProfileGenerated={setLastGeneratedProfile}
        />

        <ButlerProfileDebugPanel profile={currentProfile} />

        <ButlerTaskDecisionTracePanel trace={taskDecisionTrace} />

        <ButlerMemoryDebugPanel memory={memory} />
      </div>
    </section>
  )
}