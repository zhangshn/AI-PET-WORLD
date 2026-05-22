"use client"

/**
 * 当前文件职责：提供创建世界的玩家输入入口。
 */

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  CREATE_WORLD_STORAGE_KEY,
  serializeCreateWorldInput,
  type CreateWorldInput,
  type CreateWorldPerspective,
} from "@/world/creation/world-creation-runtime"

import styles from "./create-world-route-page.styles.module.css"

export default function CreateWorldRoutePage() {
  const router = useRouter()
  const [year, setYear] = useState("1998")
  const [month, setMonth] = useState("1")
  const [day, setDay] = useState("1")
  const [time, setTime] = useState("08:00")
  const [perspective, setPerspective] =
    useState<CreateWorldPerspective>("unspecified")

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const createWorldInput = buildCreateWorldInput({
      year,
      month,
      day,
      time,
      perspective,
    })

    if (!createWorldInput) return

    window.localStorage.setItem(
      CREATE_WORLD_STORAGE_KEY,
      serializeCreateWorldInput(createWorldInput)
    )
    router.push("/world")
  }

  return (
    <main className={styles.createWorldPage}>
      <form className={styles.createPanel} onSubmit={handleSubmit}>
        <div className={styles.brand}>AI-PET-WORLD</div>
        <h1 className={styles.title}>创建你的第一片家园</h1>
        <p className={styles.description}>
          输入出生信息后，系统会生成管家人格、世界种子和第一片家园。
          宠物不会默认出现；世界会先围绕管家、资源、住所和自主建设运行。
        </p>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>出生信息</legend>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>出生年</span>
              <input
                className={styles.input}
                inputMode="numeric"
                max="2100"
                min="1900"
                onChange={(event) => setYear(event.target.value)}
                required
                type="number"
                value={year}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>出生月</span>
              <input
                className={styles.input}
                inputMode="numeric"
                max="12"
                min="1"
                onChange={(event) => setMonth(event.target.value)}
                required
                type="number"
                value={month}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>出生日</span>
              <input
                className={styles.input}
                inputMode="numeric"
                max="31"
                min="1"
                onChange={(event) => setDay(event.target.value)}
                required
                type="number"
                value={day}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>出生时间</span>
              <input
                className={styles.input}
                onChange={(event) => setTime(event.target.value)}
                required
                type="time"
                value={time}
              />
            </label>

            <label className={styles.fieldWide}>
              <span className={styles.label}>视角</span>
              <select
                className={styles.select}
                onChange={(event) =>
                  setPerspective(event.target.value as CreateWorldPerspective)
                }
                value={perspective}
              >
                <option value="unspecified">不指定</option>
                <option value="female">女性视角</option>
                <option value="male">男性视角</option>
              </select>
            </label>
          </div>
        </fieldset>

        <button className={styles.enterButton} type="submit">
          进入世界
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
  perspective: CreateWorldPerspective
}): CreateWorldInput | null {
  const yearValue = Number(input.year)
  const monthValue = Number(input.month)
  const dayValue = Number(input.day)

  if (!Number.isInteger(yearValue) || yearValue < 1900 || yearValue > 2100) {
    return null
  }

  if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
    return null
  }

  if (!Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) {
    return null
  }

  if (!/^\d{2}:\d{2}$/.test(input.time)) {
    return null
  }

  return {
    year: yearValue,
    month: monthValue,
    day: dayValue,
    time: input.time,
    perspective: input.perspective,
    createdAt: buildStableCreateWorldCreatedAt({
      year: yearValue,
      month: monthValue,
      day: dayValue,
      time: input.time,
      perspective: input.perspective,
    }),
  }
}

function buildStableCreateWorldCreatedAt(input: {
  year: number
  month: number
  day: number
  time: string
  perspective: CreateWorldPerspective
}): number {
  const [hourText, minuteText] = input.time.split(":")
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const perspectiveOffset =
    input.perspective === "female" ? 2 : input.perspective === "male" ? 1 : 0

  return (
    input.year * 10_000_000 +
    input.month * 100_000 +
    input.day * 1_000 +
    hour * 10 +
    Math.floor(minute / 10) +
    perspectiveOffset
  )
}
