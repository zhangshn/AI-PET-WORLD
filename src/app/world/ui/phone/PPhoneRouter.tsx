"use client"

/**
 * 当前文件负责：管理 P-Phone 当前页面路由。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../utils/worldHudMappers"
import type { PPhoneAppShortcut, PPhoneRoute } from "./PPhoneTypes"

import { createPPhoneHomeRoute } from "./PPhoneTypes"
import PPhoneIcon from "./PPhoneIcon"

import styles from "@/styles/world-styles/phone/p-phone-router.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
}

function buildAppShortcuts(input: {
  world: WorldEngineViewState
  hud: WorldHudBundle
}): PPhoneAppShortcut[] {
  return [
    {
      id: "messages",
      title: "短信",
      subtitle: "管家与系统通知",
      icon: "messages",
      badgeCount: input.world.events.length,
    },
    {
      id: "contacts",
      title: "联系人",
      subtitle: "管家 / 系统",
      icon: "contacts",
    },
    {
      id: "pet",
      title: "宠物",
      subtitle: input.hud.pet.available ? input.hud.pet.actionLabel : "等待诞生",
      icon: "pet",
    },
    {
      id: "profile",
      title: "档案",
      subtitle: input.hud.butler.available ? input.hud.butler.name : "管家档案",
      icon: "profile",
    },
    {
      id: "homeApp",
      title: "家园",
      subtitle: input.hud.home.available ? input.hud.home.statusLabel : "未生成",
      icon: "home",
    },
    {
      id: "settings",
      title: "设置",
      subtitle: "游戏设置",
      icon: "settings",
    },
  ]
}

function getPlaceholderTitle(route: PPhoneRoute): string {
  if (route.screen === "messages") return "短信"
  if (route.screen === "messageThread") return "短信会话"
  if (route.screen === "contacts") return "联系人"
  if (route.screen === "contactDetail") return "联系人详情"
  if (route.screen === "call") return "电话"
  if (route.screen === "pet") return "宠物"
  if (route.screen === "profile") return "档案"
  if (route.screen === "homeApp") return "家园"
  if (route.screen === "settings") return "设置"

  return "P-Phone"
}

function getPlaceholderText(route: PPhoneRoute): string {
  if (route.screen === "messages") {
    return "下一批会接入短信会话列表：管家、P-System、World Notice。"
  }

  if (route.screen === "contacts") {
    return "下一批会接入联系人列表，点击管家后可选择短信或电话。"
  }

  if (route.screen === "pet") {
    return "下一批会接入宠物公开状态、行为与气质。"
  }

  if (route.screen === "profile") {
    return "下一批会接入管家档案与世界档案入口。"
  }

  if (route.screen === "homeApp") {
    return "下一批会接入家园等级、建设进度与稳定状态。"
  }

  if (route.screen === "settings") {
    return "下一批会接入游戏总设置入口。"
  }

  return "该页面将在下一批 P-Phone App 代码中接入。"
}

export default function PPhoneRouter({ world, hud }: Props) {
  const [route, setRoute] = useState<PPhoneRoute>(() => createPPhoneHomeRoute())

  const shortcuts = useMemo(() => {
    return buildAppShortcuts({ world, hud })
  }, [world, hud])

  if (route.screen !== "home") {
    return (
      <div className={styles.appPage}>
        <header className={styles.appHeader}>
          <button
            className={styles.backButton}
            type="button"
            aria-label="返回 P-Phone 桌面"
            onClick={() => setRoute(createPPhoneHomeRoute())}
          >
            ‹
          </button>

          <div>
            <p>P-Phone</p>
            <h2>{getPlaceholderTitle(route)}</h2>
          </div>
        </header>

        <section className={styles.placeholderCard}>
          <strong>{getPlaceholderTitle(route)}</strong>
          <p>{getPlaceholderText(route)}</p>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.homeScreen}>
      <section className={styles.hero}>
        <p>P-Phone</p>
        <h1>{hud.world.timeLabel}</h1>
        <span>
          今天 · {hud.world.periodLabel} · {hud.world.weatherLabel}
        </span>
      </section>

      <div className={styles.appGrid}>
        {shortcuts.map((shortcut) => (
          <button
            className={styles.appButton}
            key={shortcut.id}
            type="button"
            onClick={() => {
              if (shortcut.id === "homeApp") {
                setRoute({ screen: "homeApp" })
                return
              }

              setRoute({ screen: shortcut.id })
            }}
          >
            <span className={styles.iconWrap}>
              <PPhoneIcon kind={shortcut.icon} />

              {Boolean(shortcut.badgeCount) && (
                <strong className={styles.badge}>
                  {Math.min(99, shortcut.badgeCount ?? 0)}
                </strong>
              )}
            </span>

            <strong>{shortcut.title}</strong>
            <small>{shortcut.subtitle}</small>
          </button>
        ))}
      </div>
    </div>
  )
}