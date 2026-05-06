"use client"

/**
 * 当前文件负责：在开发面板中输入出生信息并生成管家 ButlerProfile。
 */

import { useMemo, useState } from "react"

import {
  buildButlerProfile,
  type ButlerMappingMode,
  type ButlerProfile,
} from "@/ai/gateway"

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  world: WorldEngineViewState
  onProfileGenerated: (profile: ButlerProfile | null) => void
}

type BirthFormState = {
  displayName: string
  year: string
  month: string
  day: string
  hour: string
  minute: string
  useBirthTime: boolean
  mappingMode: ButlerMappingMode
}

const DEFAULT_FORM: BirthFormState = {
  displayName: "管家",
  year: "1995",
  month: "1",
  day: "1",
  hour: "12",
  minute: "0",
  useBirthTime: false,
  mappingMode: "self_projection",
}

function parseNumber(value: string): number | null {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function isValidDatePart(input: {
  year: number | null
  month: number | null
  day: number | null
}): boolean {
  if (input.year === null || input.month === null || input.day === null) {
    return false
  }

  if (input.year < 1900 || input.year > 2100) return false
  if (input.month < 1 || input.month > 12) return false
  if (input.day < 1 || input.day > 31) return false

  return true
}

function isValidTimePart(input: {
  hour: number | null
  minute: number | null
}): boolean {
  if (input.hour === null || input.minute === null) {
    return false
  }

  if (input.hour < 0 || input.hour > 23) return false
  if (input.minute < 0 || input.minute > 59) return false

  return true
}

export default function ButlerProfileInputPanel({
  world,
  onProfileGenerated,
}: Props) {
  const [form, setForm] = useState<BirthFormState>(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)

  const parsedBirth = useMemo(() => {
    const year = parseNumber(form.year)
    const month = parseNumber(form.month)
    const day = parseNumber(form.day)
    const hour = parseNumber(form.hour)
    const minute = parseNumber(form.minute)

    return {
      year,
      month,
      day,
      hour,
      minute,
    }
  }, [
    form.year,
    form.month,
    form.day,
    form.hour,
    form.minute,
  ])

  function updateForm<K extends keyof BirthFormState>(
    key: K,
    value: BirthFormState[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleBuildProfile() {
    setError(null)

    const hasValidDate = isValidDatePart({
      year: parsedBirth.year,
      month: parsedBirth.month,
      day: parsedBirth.day,
    })

    if (!hasValidDate) {
      setError("出生日期无效，请检查 year / month / day。")
      return
    }

    if (form.useBirthTime) {
      const hasValidTime = isValidTimePart({
        hour: parsedBirth.hour,
        minute: parsedBirth.minute,
      })

      if (!hasValidTime) {
        setError("出生时间无效，请检查 hour / minute。")
        return
      }
    }

    const profile = buildButlerProfile({
      displayName: form.displayName.trim() || "管家",
      mappingMode: form.mappingMode,
      birth: {
        year: parsedBirth.year ?? 1995,
        month: parsedBirth.month ?? 1,
        day: parsedBirth.day ?? 1,
        ...(form.useBirthTime
          ? {
              hour: parsedBirth.hour ?? 12,
              minute: parsedBirth.minute ?? 0,
            }
          : {}),
      },
    })

    world.setButlerProfile(profile)
    onProfileGenerated(profile)
  }

  function handleClearProfile() {
    setError(null)
    world.setButlerProfile(null)
    onProfileGenerated(null)
  }

  return (
    <>
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          出生信息 / Birth Input
        </h3>

        <div className={styles.traitsList}>
          <label className={styles.traitItem}>
            <span>名称</span>
            <input
              value={form.displayName}
              onChange={(event) =>
                updateForm("displayName", event.target.value)
              }
            />
          </label>

          <label className={styles.traitItem}>
            <span>年份</span>
            <input
              value={form.year}
              inputMode="numeric"
              onChange={(event) =>
                updateForm("year", event.target.value)
              }
            />
          </label>

          <label className={styles.traitItem}>
            <span>月份</span>
            <input
              value={form.month}
              inputMode="numeric"
              onChange={(event) =>
                updateForm("month", event.target.value)
              }
            />
          </label>

          <label className={styles.traitItem}>
            <span>日期</span>
            <input
              value={form.day}
              inputMode="numeric"
              onChange={(event) =>
                updateForm("day", event.target.value)
              }
            />
          </label>

          <label className={styles.traitItem}>
            <span>使用时辰</span>
            <input
              type="checkbox"
              checked={form.useBirthTime}
              onChange={(event) =>
                updateForm("useBirthTime", event.target.checked)
              }
            />
          </label>

          {form.useBirthTime && (
            <>
              <label className={styles.traitItem}>
                <span>小时</span>
                <input
                  value={form.hour}
                  inputMode="numeric"
                  onChange={(event) =>
                    updateForm("hour", event.target.value)
                  }
                />
              </label>

              <label className={styles.traitItem}>
                <span>分钟</span>
                <input
                  value={form.minute}
                  inputMode="numeric"
                  onChange={(event) =>
                    updateForm("minute", event.target.value)
                  }
                />
              </label>
            </>
          )}
        </div>
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          映射模式 / Mapping Mode
        </h3>

        <div className={styles.traitsList}>
          <label className={styles.traitItem}>
            <span>映射自己</span>
            <input
              type="radio"
              name="butlerMappingMode"
              checked={form.mappingMode === "self_projection"}
              onChange={() =>
                updateForm("mappingMode", "self_projection")
              }
            />
          </label>

          <label className={styles.traitItem}>
            <span>平行世界</span>
            <input
              type="radio"
              name="butlerMappingMode"
              checked={form.mappingMode === "parallel_self"}
              onChange={() =>
                updateForm("mappingMode", "parallel_self")
              }
            />
          </label>

          <div className={styles.row}>
            <span>当前模式</span>
            <span>{form.mappingMode}</span>
          </div>

          <div className={styles.row}>
            <span>时间模式</span>
            <span>
              {form.useBirthTime ? "full_datetime" : "date_only"}
            </span>
          </div>
        </div>

        <div className={styles.traitsList}>
          <button type="button" onClick={handleBuildProfile}>
            生成并注入 ButlerProfile
          </button>

          <button type="button" onClick={handleClearProfile}>
            清空 ButlerProfile
          </button>
        </div>

        {error && (
          <p className={styles.empty}>
            {error}
          </p>
        )}
      </div>
    </>
  )
}