"use client"

/**
 * 当前文件负责：提供测试页可输入也可下拉选择的输入组件。
 */

import { useEffect, useRef, useState } from "react"

export function ComboInput({
  label,
  value,
  options,
  placeholder,
  width,
  onChange
}: {
  label: string
  value: string
  options: string[]
  placeholder?: string
  width?: number
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) {
        return
      }

      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {label}：
      <div ref={wrapperRef} style={{ position: "relative", width: width ?? 100 }}>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
          }}
          style={{
            width: "100%",
            padding: "6px 28px 6px 8px",
            border: "1px solid #ccc",
            borderRadius: 6
          }}
        />

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          style={{
            position: "absolute",
            right: 4,
            top: 4,
            width: 22,
            height: 22,
            border: "none",
            background: "transparent",
            cursor: "pointer"
          }}
        >
          ▼
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: 34,
              left: 0,
              width: "100%",
              maxHeight: 240,
              overflowY: "auto",
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: 8,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
              zIndex: 9999
            }}
          >
            {options.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onChange(item)
                  setOpen(false)
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  textAlign: "left",
                  border: "none",
                  background: item === value ? "#f0f5ff" : "#fff",
                  cursor: "pointer"
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  )
}