/**
 * 当前文件负责：定义像素 UI 组件分层的最小类型。
 */

import type { ReactNode } from "react"

export type PixelUiLayerId =
  | "ground"
  | "grass"
  | "tree_nature"
  | "path"
  | "building_base"
  | "building_body"
  | "building_detail"
  | "facility"
  | "actor_shadow"
  | "actor_body"
  | "actor_detail"
  | "actor_motion"
  | "effect"
  | "interaction"
  | "atmosphere"

export type PixelUiLayerProps = {
  children?: ReactNode
  visible?: boolean
  debug?: boolean
}

export type PixelUiRootProps = {
  children?: ReactNode
  debug?: boolean
}

export type PixelLayerStackProps = {
  children?: ReactNode
  debug?: boolean
}
