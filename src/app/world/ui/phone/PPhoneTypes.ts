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

export type PPhoneContactId = "butler" | "p-system" | "world-notice"

export type PPhoneMessageThreadId =
  | "butler"
  | "p-system"
  | "world-notice"

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