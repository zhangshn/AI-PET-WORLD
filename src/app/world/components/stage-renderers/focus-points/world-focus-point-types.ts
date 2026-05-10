/**
 * 当前文件负责：定义世界舞台焦点点位类型。
 */

export type WorldFocusPointKind =
  | "shelter_entrance"
  | "shelter_exit"
  | "incubator"
  | "garden_observe"
  | "home_build"
  | "boundary_observe"
  | "pet"
  | "butler"

export type WorldFocusPointPurpose =
  | "enter"
  | "exit"
  | "observe"
  | "work"
  | "care"
  | "move_target"
  | "feedback"

export type WorldFocusPoint = {
  id: string
  kind: WorldFocusPointKind
  purpose: WorldFocusPointPurpose[]
  x: number
  y: number
  radius: number
  enabled: boolean
  priority: number
  tags: string[]
}
