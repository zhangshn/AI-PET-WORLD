"use client"

import { useMemo, useState } from "react"

type VisualAction = {
  id: string
  title: string
  description: string
  method: "GET" | "POST"
  path: string
  group: "准备" | "生成" | "审核" | "展示"
}

type ActionResult = {
  ok: boolean
  httpStatus: number
  receivedAt: string
  body: unknown
}

const ACTIONS: VisualAction[] = [
  {
    id: "provider",
    title: "Provider 状态",
    description: "查看图像