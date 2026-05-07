"use client"

/**
 * 当前文件负责：管理 P-Phone 当前页面路由。
 */

import { useCallback, useMemo, useState } from "react"

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { WorldHudBundle } from "../../utils/worldHudMappers"
import type {
  PPhoneAppId,
  PPhoneAppShortcut,
  PPhoneContactId,
  PPhoneMessageThreadId,
  PPhoneRoute,
} from "./PPhoneTypes"

import { buildPhoneDetailBundle } from "../../utils/phoneDetailMappers"
import { createPPhoneHomeRoute } from "./PPhoneTypes"

import PPhoneHomeScreen from "./home/PPhoneHomeScreen"

import PPhoneMessagesApp from "./messages/PPhoneMessagesApp"
import PPhoneMessageThread from "./messages/PPhoneMessageThread"
import {
  buildPPhoneMessageThreads,
  getPPhoneTotalUnreadCount,
} from "./messages/pPhoneMessageMappers"

import PPhoneContactsApp from "./contacts/PPhoneContactsApp"
import PPhoneContactDetail from "./contacts/PPhoneContactDetail"
import { buildPPhoneContacts } from "./contacts/pPhoneContactMappers"

import PPhoneCallPlaceholder from "./call/PPhoneCallPlaceholder"

import PPhonePetApp from "./pet/PPhonePetApp"
import PPhoneProfileApp from "./profile/PPhoneProfileApp"
import PPhoneHomeApp from "./home-app/PPhoneHomeApp"
import PPhoneSettingsApp from "./settings/PPhoneSettingsApp"
import PPhoneWeatherApp from "./weather/PPhoneWeatherApp"
import PPhoneCalendarApp from "./calendar/PPhoneCalendarApp"

type Props = {
  world: WorldEngineViewState
  hud: WorldHudBundle
  readMessageIds: ReadonlySet<string>
  onMarkMessagesRead: (messageIds: string[]) => void
}

function buildAppShortcuts(input: {
  hud: WorldHudBundle
  messageUnreadCount: number
}): PPhoneAppShortcut[] {
  return [
    {
      id: "messages",
      title: "短信",
      subtitle:
        input.messageUnreadCount > 0
          ? `${input.messageUnreadCount} 条未读`
          : "没有未读短信",
      icon: "messages",
      badgeCount:
        input.messageUnreadCount > 0 ? input.messageUnreadCount : undefined,
    },
    {
      id: "contacts",
      title: "联系人",
      subtitle: "管家 / 世界通知",
      icon: "contacts",
    },
    {
      id: "pet",
      title: "宠物",
      subtitle: input.hud.pet.available
        ? input.hud.pet.actionLabel
        : "等待诞生",
      icon: "pet",
    },
    {
      id: "profile",
      title: "档案",
      subtitle: input.hud.butler.available
        ? input.hud.butler.name
        : "管家档案",
      icon: "profile",
    },
    {
      id: "homeApp",
      title: "家园",
      subtitle: input.hud.home.available
        ? input.hud.home.statusLabel
        : "未生成",
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

function toAppRoute(appId: PPhoneAppId): PPhoneRoute {
  if (appId === "messages") {
    return {
      screen: "messages",
    }
  }

  if (appId === "contacts") {
    return {
      screen: "contacts",
    }
  }

  if (appId === "pet") {
    return {
      screen: "pet",
    }
  }

  if (appId === "profile") {
    return {
      screen: "profile",
    }
  }

  if (appId === "homeApp") {
    return {
      screen: "homeApp",
    }
  }

  if (appId === "weather") {
    return {
      screen: "weather",
    }
  }

  if (appId === "calendar") {
    return {
      screen: "calendar",
    }
  }

  return {
    screen: "settings",
  }
}

function findThreadOrFallback(
  threadId: PPhoneMessageThreadId,
  threads: ReturnType<typeof buildPPhoneMessageThreads>
) {
  return threads.find((thread) => thread.id === threadId) ?? threads[0]
}

function findContactOrFallback(
  contactId: PPhoneContactId,
  contacts: ReturnType<typeof buildPPhoneContacts>
) {
  return contacts.find((contact) => contact.id === contactId) ?? contacts[0]
}

export default function PPhoneRouter({
  world,
  hud,
  readMessageIds,
  onMarkMessagesRead,
}: Props) {
  const [route, setRoute] = useState<PPhoneRoute>(() => createPPhoneHomeRoute())

  const detailBundle = useMemo(() => {
    return buildPhoneDetailBundle(hud)
  }, [hud])

  const messageThreads = useMemo(() => {
    return buildPPhoneMessageThreads({
      events: world.events,
      hud,
      readMessageIds,
    })
  }, [world.events, hud, readMessageIds])

  const messageUnreadCount = useMemo(() => {
    return getPPhoneTotalUnreadCount(messageThreads)
  }, [messageThreads])

  const shortcuts = useMemo(() => {
    return buildAppShortcuts({
      hud,
      messageUnreadCount,
    })
  }, [hud, messageUnreadCount])

  const contacts = useMemo(() => {
    return buildPPhoneContacts(hud)
  }, [hud])

  const goHome = () => {
    setRoute(createPPhoneHomeRoute())
  }

  const openApp = (appId: PPhoneAppId) => {
    setRoute(toAppRoute(appId))
  }

  const openThread = (threadId: PPhoneMessageThreadId) => {
    setRoute({
      screen: "messageThread",
      threadId,
    })
  }

  const markThreadRead = useCallback(
    (messageIds: string[]) => {
      onMarkMessagesRead(messageIds)
    },
    [onMarkMessagesRead]
  )

  const openContact = (contactId: PPhoneContactId) => {
    setRoute({
      screen: "contactDetail",
      contactId,
    })
  }

  const openCall = (contactId: PPhoneContactId) => {
    setRoute({
      screen: "call",
      contactId,
    })
  }

  if (route.screen === "home") {
    return (
      <PPhoneHomeScreen
        timeLabel={hud.world.timeLabel}
        periodLabel={hud.world.periodLabel}
        weatherLabel={hud.world.weatherLabel}
        shortcuts={shortcuts}
        onOpenApp={openApp}
      />
    )
  }

  if (route.screen === "weather") {
    return (
      <PPhoneWeatherApp
        weatherLabel={hud.world.weatherLabel}
        periodLabel={hud.world.periodLabel}
        worldTimeLabel={hud.world.timeLabel}
        onBack={goHome}
      />
    )
  }

  if (route.screen === "calendar") {
    return <PPhoneCalendarApp onBack={goHome} />
  }

  if (route.screen === "messages") {
    return (
      <PPhoneMessagesApp
        threads={messageThreads}
        onBack={goHome}
        onOpenThread={openThread}
      />
    )
  }

  if (route.screen === "messageThread") {
    return (
      <PPhoneMessageThread
        thread={findThreadOrFallback(route.threadId, messageThreads)}
        onBack={() =>
          setRoute({
            screen: "messages",
          })
        }
        onMarkRead={markThreadRead}
      />
    )
  }

  if (route.screen === "contacts") {
    return (
      <PPhoneContactsApp
        contacts={contacts}
        onBack={goHome}
        onOpenContact={openContact}
      />
    )
  }

  if (route.screen === "contactDetail") {
    return (
      <PPhoneContactDetail
        contact={findContactOrFallback(route.contactId, contacts)}
        onBack={() =>
          setRoute({
            screen: "contacts",
          })
        }
        onOpenMessage={openThread}
        onOpenCall={openCall}
      />
    )
  }

  if (route.screen === "call") {
    return (
      <PPhoneCallPlaceholder
        contact={findContactOrFallback(route.contactId, contacts)}
        onBack={() =>
          setRoute({
            screen: "contactDetail",
            contactId: route.contactId,
          })
        }
      />
    )
  }

  if (route.screen === "pet") {
    return <PPhonePetApp detail={detailBundle.pet} onBack={goHome} />
  }

  if (route.screen === "profile") {
    return <PPhoneProfileApp detail={detailBundle.butler} onBack={goHome} />
  }

  if (route.screen === "homeApp") {
    return <PPhoneHomeApp detail={detailBundle.home} onBack={goHome} />
  }

  return <PPhoneSettingsApp onBack={goHome} />
}
