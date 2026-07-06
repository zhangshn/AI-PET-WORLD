"use client"

import { useEffect, useRef, useState } from "react"

import type { ZiweiViewShareSummaryItem } from "../_lib/ziwei-view-share-summary"
import styles from "../_styles/ziwei-page.module.css"

type CopyStatus = "idle" | "copied" | "selected"

export function ViewSharePanel(props: {
  summaryItems: ZiweiViewShareSummaryItem[]
}) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle")
  const [manualUrl, setManualUrl] = useState("")
  const manualUrlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (copyStatus === "selected") {
      manualUrlRef.current?.select()
    }
  }, [copyStatus, manualUrl])

  async function copyCurrentViewUrl() {
    const url = window.location.href

    try {
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url)
        } catch {
          copyWithTextarea(url)
        }
      } else {
        copyWithTextarea(url)
      }

      setCopyStatus("copied")
      setManualUrl("")
    } catch {
      setManualUrl(url)
      setCopyStatus("selected")
    }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>当前视图</h2>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={copyCurrentViewUrl}
        >
          {copyStatus === "copied"
            ? "已复制"
            : copyStatus === "selected"
              ? "链接已选中"
              : "复制链接"}
        </button>
      </div>
      <div className={styles.panelBody}>
        <dl className={styles.viewShareSummary}>
          {props.summaryItems.map((item) => (
            <div key={item.key}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
        {manualUrl ? (
          <input
            ref={manualUrlRef}
            className={styles.viewShareManualUrl}
            readOnly
            value={manualUrl}
            onFocus={(event) => event.currentTarget.select()}
          />
        ) : null}
      </div>
    </section>
  )
}

function copyWithTextarea(value: string) {
  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "true")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.append(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  textarea.remove()

  if (!copied) {
    throw new Error("copy failed")
  }
}
