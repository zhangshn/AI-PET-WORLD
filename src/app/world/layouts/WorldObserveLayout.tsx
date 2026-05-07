"use client"

/**
 * 当前文件负责：组织 /world 桌面游戏主界面布局。
 */

import { useCallback, useMemo, useState } from "react"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"
import type { WorldStageSceneMode } from "../components/stage-renderers/orchestrator/stage-scene-mode"
import type { PPhoneAppId } from "../ui/phone/PPhoneTypes"

import { recordAiUserFeedback } from "@/ai/data-core/ai-data-gateway"

import { buildWorldHudBundle } from "../utils/worldHudMappers"
import {
  buildPPhoneMessageThreads,
  getPPhoneTotalUnreadCount,
} from "../ui/phone/messages/pPhoneMessageMappers"

import WorldPixelStage from "../components/WorldPixelStage"
import DeveloperDock from "../ui/panels/DeveloperDock"
import WorldMiniMap from "../ui/minimap/WorldMiniMap"
import PPhoneLauncher from "../ui/phone/PPhoneLauncher"
import PPhoneShell from "../ui/phone/PPhoneShell"

import styles from "@/styles/world-styles/layout/world-observe-layout.module.css"

type Props = {
  world: WorldEngineViewState
}

function recordMessageReadFeedback(messageIds: string[]): void {
  messageIds.forEach((messageId) => {
    recordAiUserFeedback({
      source: "p_phone",
      entityType: "user",
      entityId: "current-user",
      importance: "low",
      userVisibleChannel: "hidden",
      summary: "用户读取了 P-Phone 短信",
      tags: ["p-phone", "message-read", "user-feedback"],
      feedbackType: "read_message",
      targetId: messageId,
      feedbackValue: true,
    })
  })
}

function recordAppOpenFeedback(appId: PPhoneAppId): void {
  recordAiUserFeedback({
    source: "p_phone",
    entityType: "user",
    entityId: "current-user",
    importance: "low",
    userVisibleChannel: "hidden",
    summary: `用户打开了 P-Phone 应用：${appId}`,
    tags: ["p-phone", "app-open", "user-feedback", appId],
    feedbackType: "open_app",
    targetId: appId,
    feedbackValue: appId,
  })
}

export default function WorldObserveLayout({ world }: Props) {
  const [sceneMode, setSceneMode] = useState<WorldStageSceneMode>("exterior")
  const [isPPhoneOpen, setIsPPhoneOpen] = useState(false)
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(
    () => new Set()
  )

  const hud = useMemo(() => {
    return buildWorldHudBundle({
      time: world.time,
      pet: world.pet,
      butler: world.butler,
      home: world.home,
      stimuli: world.stimuli,
      ecology: world.ecology,
    })
  }, [
    world.time,
    world.pet,
    world.butler,
    world.home,
    world.stimuli,
    world.ecology,
  ])

  const messageThreads = useMemo(() => {
    return buildPPhoneMessageThreads({
      events: world.events,
      hud,
      readMessageIds,
    })
  }, [world.events, hud, readMessageIds])

  const unreadMessageCount = useMemo(() => {
    return getPPhoneTotalUnreadCount(messageThreads)
  }, [messageThreads])

  const markMessagesRead = useCallback((messageIds: string[]) => {
    if (messageIds.length === 0) return

    setReadMessageIds((current) => {
      const unreadMessageIds = messageIds.filter(
        (messageId) => !current.has(messageId)
      )

      if (unreadMessageIds.length === 0) {
        return current
      }

      recordMessageReadFeedback(unreadMessageIds)

      const next = new Set(current)

      unreadMessageIds.forEach((messageId) => {
        next.add(messageId)
      })

      return next
    })
  }, [])

  const recordPPhoneAppOpen = useCallback((appId: PPhoneAppId) => {
    recordAppOpenFeedback(appId)
  }, [])

  return (
    <main className={styles.page}>
      <section className={styles.gameShell}>
        <div className={styles.stageLayer}>
          <WorldPixelStage
            time={world.time}
            pet={world.pet}
            butler={world.butler}
            incubator={world.incubator}
            stimuli={world.stimuli}
            ecology={world.ecology}
            worldRuntime={world.worldRuntime}
            tick={world.tick}
            sceneMode={sceneMode}
            onEnterShelter={() => setSceneMode("shelterInterior")}
            onExitShelter={() => setSceneMode("exterior")}
          />
        </div>

        <div className={styles.vignetteLayer} />

        <div className={styles.topHint}>
          <span>AI-PET-WORLD Desktop MVP</span>
          <strong>F3 开发审计</strong>
        </div>

        <WorldMiniMap world={world} hud={hud} />

        {isPPhoneOpen && (
          <PPhoneShell
            world={world}
            hud={hud}
            readMessageIds={readMessageIds}
            onMarkMessagesRead={markMessagesRead}
            onRecordAppOpen={recordPPhoneAppOpen}
          />
        )}

        <PPhoneLauncher
          isOpen={isPPhoneOpen}
          unreadCount={unreadMessageCount}
          onToggle={() => setIsPPhoneOpen((value) => !value)}
        />
      </section>

      {world.showDeveloperPanel && <DeveloperDock world={world} />}
    </main>
  )
}