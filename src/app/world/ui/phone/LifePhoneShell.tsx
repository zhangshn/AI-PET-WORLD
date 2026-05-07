"use client"

/**
 * 当前文件负责：展示 /world 正式 Life Phone 外壳。
 */

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../../utils/worldHudMappers"

import LifePhoneHome from "./LifePhoneHome"

import styles from "@/styles/world-styles/phone/life-phone-shell.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
  onClose: () => void
}

export default function LifePhoneShell({ world, hud, onClose }: Props) {
  return (
    <aside className={styles.phoneShell} aria-label="Life Phone">
      <div className={styles.deviceFrame}>
        <div className={styles.deviceTop}>
          <span className={styles.signal}>AI-PET</span>
          <span className={styles.cameraSlot} />
          <button
            className={styles.closeButton}
            type="button"
            aria-label="关闭 Life Phone"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.screen}>
          <LifePhoneHome world={world} hud={hud} />
        </div>

        <div className={styles.homeIndicator} />
      </div>
    </aside>
  )
}