"use client"

/**
 * 当前文件负责：展示 Life Phone 桌面、应用入口与应用页面。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { PhoneDetailPageData } from "../../utils/phoneDetailMappers"
import type {
  PhoneObservationEntryModuleData,
} from "../../utils/phoneModuleMappers"
import type { WorldHudBundle } from "../../utils/worldHudMappers"

import { buildPhoneDetailBundle } from "../../utils/phoneDetailMappers"
import { buildPhoneHomeScreenModuleData } from "../../utils/phoneModuleMappers"

import styles from "@/styles/world-styles/phone/life-phone-home.module.css"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
}

type LifePhoneAppId =
  | "messages"
  | "contacts"
  | "butlerChat"
  | "logs"
  | "pet"
  | "butler"
  | "home"
  | "settings"

type LifePhoneApp = {
  id: LifePhoneAppId
  title: string
  subtitle: string
  icon: string
  badge?: number
}

function getObservationModule(
  phoneData: ReturnType<typeof buildPhoneHomeScreenModuleData>
): PhoneObservationEntryModuleData {
  return phoneData.modules[3]
}

function getLatestEventText(world: WorldEngineViewState): string {
  const latest = world.events[0]

  if (!latest) return "世界暂时安静，没有新的生命记录。"

  return latest.message
}

function getAppList(input: {
  world: WorldEngineViewState
  hud: WorldHudBundle
}): LifePhoneApp[] {
  return [
    {
      id: "messages",
      title: "消息",
      subtitle: "管家与系统通知",
      icon: "✉",
      badge: input.world.events.length,
    },
    {
      id: "contacts",
      title: "联系人",
      subtitle: "管家 / 世界系统",
      icon: "☏",
    },
    {
      id: "butlerChat",
      title: "管家",
      subtitle: input.hud.butler.available
        ? input.hud.butler.taskLabel
        : "管家未就位",
      icon: "♟",
      badge: input.hud.butler.opportunityCount,
    },
    {
      id: "logs",
      title: "日志",
      subtitle: "世界观察记录",
      icon: "▤",
      badge: input.world.events.length,
    },
    {
      id: "pet",
      title: "宠物",
      subtitle: input.hud.pet.available
        ? input.hud.pet.actionLabel
        : "等待诞生",
      icon: "●",
    },
    {
      id: "butler",
      title: "档案",
      subtitle: input.hud.butler.available
        ? input.hud.butler.name
        : "管家档案",
      icon: "◇",
    },
    {
      id: "home",
      title: "家园",
      subtitle: input.hud.home.available
        ? input.hud.home.statusLabel
        : "家园未生成",
      icon: "⌂",
    },
    {
      id: "settings",
      title: "设置",
      subtitle: "声音 / 显示",
      icon: "⚙",
    },
  ]
}

function AppHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle: string
  onBack: () => void
}) {
  return (
    <header className={styles.appHeader}>
      <button className={styles.backButton} type="button" onClick={onBack}>
        ‹
      </button>

      <div>
        <p>{subtitle}</p>
        <h2>{title}</h2>
      </div>
    </header>
  )
}

function PhoneDesktop({
  world,
  hud,
  onOpenApp,
}: {
  world: WorldEngineViewState
  hud: WorldHudBundle
  onOpenApp: (appId: LifePhoneAppId) => void
}) {
  const apps = getAppList({ world, hud })

  return (
    <div className={styles.desktop}>
      <section className={styles.desktopHero}>
        <div>
          <p className={styles.eyebrow}>LIFE PHONE</p>
          <h1>{hud.world.timeLabel}</h1>
          <span>
            {hud.world.dayLabel} · {hud.world.periodLabel} ·{" "}
            {hud.world.weatherLabel}
          </span>
        </div>
      </section>

      <div className={styles.appGrid}>
        {apps.map((app) => (
          <button
            className={styles.appIconButton}
            key={app.id}
            type="button"
            onClick={() => onOpenApp(app.id)}
          >
            <span className={styles.appIcon}>
              {app.icon}
              {Boolean(app.badge) && (
                <strong className={styles.appBadge}>
                  {Math.min(99, app.badge ?? 0)}
                </strong>
              )}
            </span>

            <strong>{app.title}</strong>
            <small>{app.subtitle}</small>
          </button>
        ))}
      </div>

      <section className={styles.todayCard}>
        <p>今日简报</p>
        <strong>{getLatestEventText(world)}</strong>
      </section>
    </div>
  )
}

function MessagesApp({
  world,
  hud,
  onBack,
}: {
  world: WorldEngineViewState
  hud: WorldHudBundle
  onBack: () => void
}) {
  const latestEvents = world.events.slice(0, 8)

  return (
    <div className={styles.appPage}>
      <AppHeader title="消息" subtitle="Messages" onBack={onBack} />

      <div className={styles.messageList}>
        <article className={styles.messageBubble}>
          <span>{hud.butler.name}</span>
          <p>
            我会继续维护环境和机会，但不会替宠物决定。它现在的状态是：
            {hud.pet.actionLabel}。
          </p>
        </article>

        {latestEvents.map((event) => (
          <article className={styles.messageBubble} key={event.id}>
            <span>Life System</span>
            <p>{event.message}</p>
          </article>
        ))}

        {latestEvents.length === 0 && (
          <article className={styles.emptyState}>
            暂时没有新消息。世界还在安静运行。
          </article>
        )}
      </div>
    </div>
  )
}

function ContactsApp({
  hud,
  onBack,
  onOpenChat,
}: {
  hud: WorldHudBundle
  onBack: () => void
  onOpenChat: () => void
}) {
  return (
    <div className={styles.appPage}>
      <AppHeader title="联系人" subtitle="Contacts" onBack={onBack} />

      <div className={styles.contactList}>
        <button className={styles.contactItem} type="button" onClick={onOpenChat}>
          <span className={styles.contactAvatar}>♟</span>
          <div>
            <strong>{hud.butler.name}</strong>
            <p>{hud.butler.taskLabel}</p>
          </div>
        </button>

        <article className={styles.contactItem}>
          <span className={styles.contactAvatar}>◎</span>
          <div>
            <strong>Life System</strong>
            <p>出生报告、离线报告、世界通知</p>
          </div>
        </article>

        <article className={styles.contactItem}>
          <span className={styles.contactAvatar}>▤</span>
          <div>
            <strong>World Notice</strong>
            <p>生态、天气、事件摘要</p>
          </div>
        </article>
      </div>
    </div>
  )
}

function ButlerChatApp({
  hud,
  onBack,
}: {
  hud: WorldHudBundle
  onBack: () => void
}) {
  return (
    <div className={styles.appPage}>
      <AppHeader title={hud.butler.name} subtitle="Butler Chat" onBack={onBack} />

      <div className={styles.chatArea}>
        <article className={styles.chatBubbleButler}>
          <span>{hud.butler.name}</span>
          <p>
            我现在的任务是「{hud.butler.taskLabel}」。我可以维护环境、观察状态、
            提供机会，但我不会替宠物做决定。
          </p>
        </article>

        <article className={styles.chatBubbleUser}>
          <p>我想知道宠物现在怎么样。</p>
        </article>

        <article className={styles.chatBubbleButler}>
          <span>{hud.butler.name}</span>
          <p>
            它现在表现为「{hud.pet.actionLabel}」，情绪是「{hud.pet.moodLabel}」。
            我会继续保持环境稳定，让它自己选择下一步。
          </p>
        </article>

        <div className={styles.presetQuestions}>
          <button type="button">查看宠物状态</button>
          <button type="button">查看当前机会</button>
          <button type="button">查看家园状态</button>
        </div>
      </div>
    </div>
  )
}

function LogsApp({
  observationModule,
  onBack,
}: {
  observationModule: PhoneObservationEntryModuleData
  onBack: () => void
}) {
  const observation = observationModule.observation

  return (
    <div className={styles.appPage}>
      <AppHeader title="观察日志" subtitle="World Logs" onBack={onBack} />

      <div className={styles.logList}>
        {observation.groups.length === 0 && (
          <article className={styles.emptyState}>暂无观察记录。</article>
        )}

        {observation.groups.map((group) => (
          <section className={styles.logGroup} key={group.groupLabel}>
            <h3>{group.groupLabel}</h3>

            {group.items.map((item) => (
              <article className={styles.logItem} key={item.id}>
                <div>
                  <span>{item.category}</span>
                  <strong>{item.timeLabel}</strong>
                </div>

                <h4>{item.title}</h4>
                <p>{item.summary}</p>
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function DetailApp({
  title,
  subtitle,
  detail,
  onBack,
}: {
  title: string
  subtitle: string
  detail: PhoneDetailPageData
  onBack: () => void
}) {
  return (
    <div className={styles.appPage}>
      <AppHeader title={title} subtitle={subtitle} onBack={onBack} />

      <section className={styles.profileCard}>
        <div className={styles.profileTop}>
          <div>
            <p>{detail.statusLabel}</p>
            <h2>{detail.subtitle}</h2>
          </div>
        </div>

        <p className={styles.profileSummary}>{detail.summary}</p>

        {detail.tags.length > 0 && (
          <div className={styles.tagList}>
            {detail.tags.slice(0, 8).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        )}
      </section>

      <div className={styles.sectionList}>
        {detail.sections.map((section) => (
          <section className={styles.infoSection} key={section.title}>
            <h3>{section.title}</h3>

            {section.description && <p>{section.description}</p>}

            {section.rows.map((row) => (
              <article className={styles.infoRow} key={`${section.title}-${row.label}`}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>

                {row.meter && (
                  <div className={styles.meterTrack}>
                    <div
                      className={styles.meterFill}
                      style={{
                        width: `${Math.min(100, Math.max(0, row.meter.value))}%`,
                      }}
                    />
                  </div>
                )}
              </article>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}

function SettingsApp({ onBack }: { onBack: () => void }) {
  return (
    <div className={styles.appPage}>
      <AppHeader title="设置" subtitle="Settings" onBack={onBack} />

      <div className={styles.settingList}>
        <article>
          <span>BGM</span>
          <strong>占位：后续接入</strong>
        </article>

        <article>
          <span>SFX</span>
          <strong>占位：后续接入</strong>
        </article>

        <article>
          <span>开发审计</span>
          <strong>按 F3 打开</strong>
        </article>
      </div>
    </div>
  )
}

export default function LifePhoneHome({ world, hud }: Props) {
  const [activeApp, setActiveApp] = useState<LifePhoneAppId | null>(null)

  const { phoneData, detailBundle } = useMemo(() => {
    return {
      phoneData: buildPhoneHomeScreenModuleData({
        hud,
        events: world.events,
      }),
      detailBundle: buildPhoneDetailBundle(hud),
    }
  }, [hud, world.events])

  const observationModule = getObservationModule(phoneData)
  const goHome = () => setActiveApp(null)

  if (!activeApp) {
    return (
      <PhoneDesktop
        world={world}
        hud={hud}
        onOpenApp={(appId) => setActiveApp(appId)}
      />
    )
  }

  if (activeApp === "messages") {
    return <MessagesApp world={world} hud={hud} onBack={goHome} />
  }

  if (activeApp === "contacts") {
    return (
      <ContactsApp
        hud={hud}
        onBack={goHome}
        onOpenChat={() => setActiveApp("butlerChat")}
      />
    )
  }

  if (activeApp === "butlerChat") {
    return <ButlerChatApp hud={hud} onBack={goHome} />
  }

  if (activeApp === "logs") {
    return <LogsApp observationModule={observationModule} onBack={goHome} />
  }

  if (activeApp === "pet") {
    return (
      <DetailApp
        title="宠物档案"
        subtitle="Pet"
        detail={detailBundle.pet}
        onBack={goHome}
      />
    )
  }

  if (activeApp === "butler") {
    return (
      <DetailApp
        title="管家档案"
        subtitle="Butler"
        detail={detailBundle.butler}
        onBack={goHome}
      />
    )
  }

  if (activeApp === "home") {
    return (
      <DetailApp
        title="家园"
        subtitle="Home"
        detail={detailBundle.home}
        onBack={goHome}
      />
    )
  }

  return <SettingsApp onBack={goHome} />
}