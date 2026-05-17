"use client"

/**
 * 当前文件负责：正式世界入口守卫。
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import {
  CREATE_WORLD_STORAGE_KEY,
  parseCreateWorldInput,
} from "@/world/creation/world-creation-runtime"

import styles from "./page.module.css"

export default function WorldPage() {
  const router = useRouter()

  useEffect(() => {
    const rawCreateWorldInput = window.localStorage.getItem(CREATE_WORLD_STORAGE_KEY)
    const createWorldInput = parseCreateWorldInput(rawCreateWorldInput)

    if (!createWorldInput) {
      router.replace("/create-world")
    }
  }, [router])

  return <main className={styles.worldPage} aria-label="AI-PET-WORLD" />
}
