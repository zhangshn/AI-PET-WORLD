"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  CREATE_WORLD_STORAGE_KEY,
  serializeCreateWorldInput,
  type CreateWorldInput,
  type CreateWorldPerspective,
} from "@/world/creation/world-creation-client-schema"

import styles from "./create-world-route-page.styles.module.css"

export default function CreateWorldRoutePage() {
  const router = useRouter()
  const [year, setYear] = useState("1998")
  const [month, setMonth] = useState("1")
  const [day, setDay] = useState("1")
  const [time, setTime] = useState("08:00")
  const [hasBirthHour, setHasBirthHour] = useState(true)
  const [perspective, setPerspective] =
    useState<CreateWorldPerspective>("unspecified")
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage("")

    const createWorldInput = buildCreateWorldInput({
      year,
      month,
      day,
      time,
      hasBirthHour,
      perspective,
    })

    if (!createWorldInput) {
      setErrorMessage("请检查出生日期是否真实有效。")
      return
    }

    setIsCreating(true)

    try {
      const sessionResponse = await fetch("/api/ai-console/control/session", {
        credentials: "same-origin",
        method: "GET",
      })
      const session = (await sessionResponse.json().catch(() => null)) as {
        ok?: boolean
        csrfToken?: string
      } | null
      if (!sessionResponse.ok || !session?.ok || !session.csrfToken) {
        setErrorMessage("本机操作会话未建立，暂时不能创建世界。")
        setIsCreating(false)
        return
      }
      const response = await fetch("/api/world/create", {
        body: serializeCreateWorldInput(createWorldInput),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Console-CSRF": session.csrfToken,
        },
        method: "POST",
      })
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
      } | null

      if (!response.ok || !result?.ok) {
        setErrorMessage(result?.message ?? "世界暂时没有创建成功，请稍后再试。")
        setIsCreating(false)
        return
      }

      window.localStorage.setItem(
        CREATE_WORLD_STORAGE_KEY,
        serializeCreateWorldInput(createWorldInput)
      )
      router.push("/world")
    } catch {
      setErrorMessage("世界暂时没有创建成功，请稍后再试。")
      setIsCreating(false)
    }
  }

  return (
    <main className={styles.createWorldPage}>
      <form className={styles.createPanel} onSubmit={handleSubmit}>
        <div className={styles.brand}>AI-PET-WORLD</div>
        <h1 className={styles.title}>创建你的第一片家园</h1>
        <p className={styles.description}>
          输入出生信息后，系统会生成管家人格、世界种子和第一片家园。宠物不会默认出现；
          这个世界会先围绕管家、资源和家园痕迹自主运行。
        </p>
        <p className={styles.notice}>
          进入世界后，你会先观察管家的判断和家园变化；你不是直接操控者，而是这个世界的源头。
        </p>

        <fieldset className={styles.fieldset} disabled={isCreating}>
          <legend className={styles.legend}>出生信息</legend>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>出生年</span>
              <input className={styles.input} inputMode="numeric" max="2100" min="1900" onChange={(event) => setYear(event.target.value)} required type="number" value={year} />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>出生月</span>
              <input className={styles.input} inputMode="numeric" max="12" min="1" onChange={(event) => setMonth(event.target.value)} required type="number" value={month} />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>出生日</span>
              <input className={styles.input} inputMode="numeric" max="31" min="1" onChange={(event) => setDay(event.target.value)} required type="number" value={day} />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>出生时间</span>
              <input className={styles.input} disabled={!hasBirthHour} onChange={(event) => setTime(event.target.value)} required={hasBirthHour} type="time" value={time} />
            </label>

            <label className={styles.checkboxField}>
              <input checked={!hasBirthHour} onChange={(event) => setHasBirthHour(!event.target.checked)} type="checkbox" />
              <span>我不知道出生时间，使用日期模式生成管家人格</span>
            </label>

            <label className={styles.fieldWide}>
              <span className={styles.label}>视角</span>
              <select className={styles.select} onChange={(event) => setPerspective(event.target.value as CreateWorldPerspective)} value={perspective}>
                <option value="unspecified">不指定</option>
                <option value="female">女性视角</option>
                <option value="male">男性视角</option>
              </select>
            </label>
          </div>
        </fieldset>

        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}

        <button className={styles.enterButton} disabled={isCreating} type="submit">
          {isCreating ? "正在创建世界" : "进入世界"}
        </button>
      </form>
    </main>
  )
}

function buildCreateWorldInput(input: {
  year: string
  month: string
  day: string
  time: string
  hasBirthHour: boolean
  perspective: CreateWorldPerspective
}): CreateWorldInput | null {
  const yearValue = Number(input.year)
  const monthValue = Number(input.month)
  const dayValue = Number(input.day)

  if (!isValidCalendarDate(yearValue, monthValue, dayValue)) return null
  if (input.hasBirthHour && !isValidTime(input.time)) return null

  const normalizedTime = input.hasBirthHour ? input.time : null

  return {
    year: yearValue,
    month: monthValue,
    day: dayValue,
    time: normalizedTime,
    hasBirthHour: input.hasBirthHour,
    perspective: input.perspective,
    createdAt: buildStableCreateWorldCreatedAt({
      year: yearValue,
      month: monthValue,
      day: dayValue,
      time: normalizedTime,
      perspective: input.perspective,
    }),
  }
}

function buildStableCreateWorldCreatedAt(input: {
  year: number
  month: number
  day: number
  time: string | null
  perspective: CreateWorldPerspective
}): number {
  const birthTime = input.time ? parseTime(input.time) : null
  const hour = birthTime?.hour ?? 0
  const minute = birthTime?.minute ?? 0
  const perspectiveOffset =
    input.perspective === "female" ? 1 : 0

  return (
    input.year * 10_000_000 +
    input.month * 100_000 +
    input.day * 1_000 +
    hour * 10 +
    Math.floor(minute / 10) +
    perspectiveOffset
  )
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) return false
  if (!Number.isInteger(month) || month < 1 || month > 12) return false
  if (!Number.isInteger(day) || day < 1 || day > 31) return false

  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isValidTime(value: string): boolean {
  return parseTime(value) !== null
}

function parseTime(value: string): { hour: number; minute: number } | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null

  const [hourText, minuteText] = value.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null

  return { hour, minute }
}
