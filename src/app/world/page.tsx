"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import styles from "./page.module.css"

const CREATE_WORLD_STORAGE_KEY = "ai-pet-world:create-world-input"

export default function WorldPage() {
  const router = useRouter()

  useEffect(() => {
    const createWorldInput = window.localStorage.getItem(
      CREATE_WORLD_STORAGE_KEY,
    )

    if (!createWorldInput) {
      router.replace("/create-world")
    }
  }, [router])

  return <main className={styles.worldPage} aria-label="AI-PET-WORLD" />
}
