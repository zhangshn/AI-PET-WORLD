"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export function OriginalImageLibraryLiveRefresh() {
  const router = useRouter()

  useEffect(() => {
    const stream = new EventSource("/api/ai-painter/original-images/stream")
    stream.addEventListener("library_changed", () => router.refresh())
    return () => stream.close()
  }, [router])

  return null
}
