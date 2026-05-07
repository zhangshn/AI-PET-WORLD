/**
 * 当前文件负责：提供 P-Phone 共享类型。
 */

export type PPhoneAppId =
  | "messages"
  | "contacts"
  | "pet"
  | "profile"
  | "homeApp"
  | "settings"
  | "weather"
  | "calendar"

export type PPhoneContactId = "butler" | "world-notice"

export type PPhoneMessageThreadId = "butler" | "world-notice"

export type PPhoneRoute =
  | {
      screen: "home"
    }
  | {
      screen: "messages"
    }
  | {
      screen: "messageThread"
      threadId: PPhoneMessageThreadId
    }
  | {
      screen: "contacts"
    }
  | {
      screen: "contactDetail"
      contactId: PPhoneContactId
    }
  | {
      screen: "call"
      contactId: PPhoneContactId
    }
  | {
      screen: "pet"
    }
  | {
      screen: "profile"
    }
  | {
      screen: "homeApp"
    }
  | {
      screen: "settings"
    }
  | {
      screen: "weather"
    }
  | {
      screen: "calendar"
    }

export type PPhoneIconKind =
  | "messages"
  | "contacts"
  | "pet"
  | "profile"
  | "home"
  | "settings"
  | "phone"
  | "system"
  | "world"
  | "weather"
  | "calendar"
  | "open"
  | "build"
  | "future"
  | "eco"
  | "community"
  | "park"
  | "clinic"
  | "town"
  | "board"

export type PPhoneAppShortcut = {
  id: PPhoneAppId
  title: string
  subtitle: string
  icon: PPhoneIconKind
  badgeCount?: number
}

export function createPPhoneHomeRoute(): PPhoneRoute {
  return {
    screen: "home",
  }
}