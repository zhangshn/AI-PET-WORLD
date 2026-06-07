"use client"

import { useState } from "react"

type VisualAction = {
  id: string
  title: string
  method: "GET" | "POST"
  path: string
}

type ActionResult = {
  ok: boolean
  httpStatus: number
  receivedAt: string
  body: unknown
}

const ACTIONS: VisualAction[] = [
  { id: "provider", title: "Provider 状态", method: "GET", path: "/api/world/visual/provider" },
  { id: "provider-health", title: "本地模型 Health", method: "GET", path: "/api