"use client"

/**
 * 当前文件负责：展示 /world P-Phone 手机外壳。
 */

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../../utils/worldHudMappers"
import type { PPhoneAppId } from "./PPhoneTypes"

import PPhoneRouter from "./PPhoneRouter"

import styles from "@/styles/world-styles/phone/p-phone-shell.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
  readMessageIds: ReadonlySet<string>
  onMarkMessagesRead: (messageIds: string[]) => void
  onRecordAppOpen: (appId: PPhoneAppId) => void
}

export default function PPhoneShell({
  world,
  hud,
  readMessageIds,
  onMarkMessagesRead,
  onRecordAppOpen,
}: Props) {
  return (
    <aside className={styles.phoneShell} aria-label="P-Phone">
      <div className={styles.deviceFrame}>
        <div className={styles.deviceTop}>
          <span className={styles.brand}>P-Phone</span>
          <span className={styles.cameraSlot} />
          <span className={styles.statusLight} aria-hidden="true" />
        </div>

        <div className={styles.screen}>
          <PPhoneRouter
            world={world}
            hud={hud}
            readMessageIds={readMessageIds}
            onMarkMessagesRead={onMarkMessagesRead}
            onRecordAppOpen={onRecordAppOpen}
          />
        </div>

        <div className={styles.homeIndicator} />
      </div>
    </aside>
  )
}