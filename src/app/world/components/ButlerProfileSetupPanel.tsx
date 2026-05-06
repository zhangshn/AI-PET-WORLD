"use client"

/**
 * 当前文件负责：在开发面板中生成并注入管家 ButlerProfile。
 */

import { useMemo, useState } from "react"

import {
  buildButlerProfile,
  type ButlerMappingMode,
  type ButlerProfile,
} from "@/ai/gateway"

import {
  buildButlerProfileTaskTuning,
} from "@/systems/butler/butler-gateway"

import type { WorldEngineViewState } from "../hooks/useWorldEngineState"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  world: WorldEngineViewState
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

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "-"
  }

  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `${value}`
      : value.toFixed(2)
  }

  if (typeof value === "string") {
    return value
  }

  if (typeof value === "boolean") {
    return value ? "是" : "否"
  }

  return JSON.stringify(value)
}

function formatGatePassed(value: boolean): string {
  return value ? "通过" : "未通过"
}

export default function ButlerProfileSetupPanel({ world }: Props) {
  const [form, setForm] = useState<BirthFormState>(DEFAULT_FORM)
  const [lastGeneratedProfile, setLastGeneratedProfile] =
    useState<ButlerProfile | null>(world.butler?.profile ?? null)
  const [error, setError] = useState<string | null>(null)

  const currentProfile = world.butler?.profile ?? lastGeneratedProfile
  const taskDecisionTrace =
    world.butler?.latestTaskDecisionTrace ?? null

  const profileTuning = useMemo(() => {
    return buildButlerProfileTaskTuning(currentProfile)
  }, [currentProfile])

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
    setLastGeneratedProfile(profile)
  }

  function handleClearProfile() {
    setError(null)
    world.setButlerProfile(null)
    setLastGeneratedProfile(null)
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          管家 Profile 注入 / Butler Profile Setup
        </h2>

        <span className={styles.tick}>
          Dev Only
        </span>
      </div>

      <div className={styles.grid}>
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

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            当前 Profile / Current Profile
          </h3>

          {!currentProfile && (
            <p className={styles.empty}>
              当前尚未注入 ButlerProfile。
            </p>
          )}

          {currentProfile && (
            <>
              <div className={styles.row}>
                <span>名称</span>
                <span>{currentProfile.identity.displayName}</span>
              </div>

              <div className={styles.row}>
                <span>映射模式</span>
                <span>{currentProfile.identity.mappingMode}</span>
              </div>

              <div className={styles.row}>
                <span>出生时间模式</span>
                <span>{currentProfile.identity.birthTimeMode}</span>
              </div>

              <div className={styles.row}>
                <span>照护风格</span>
                <span>{currentProfile.careStyle}</span>
              </div>

              <div className={styles.row}>
                <span>建设风格</span>
                <span>{currentProfile.buildStyle}</span>
              </div>

              <div className={styles.row}>
                <span>边界风格</span>
                <span>{currentProfile.boundaryStyle}</span>
              </div>

              <div className={styles.row}>
                <span>机会方式</span>
                <span>{currentProfile.opportunityStyle}</span>
              </div>

              <div className={styles.row}>
                <span>摘要</span>
                <span className={styles.multiline}>
                  {currentProfile.publicSummary}
                </span>
              </div>
            </>
          )}
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            Profile Bias
          </h3>

          {!currentProfile && (
            <p className={styles.empty}>
              注入后会显示 bias。
            </p>
          )}

          {currentProfile && (
            <>
              <div className={styles.row}>
                <span>carePriority</span>
                <span>{formatValue(currentProfile.bias.carePriority)}</span>
              </div>

              <div className={styles.row}>
                <span>constructionDrive</span>
                <span>{formatValue(currentProfile.bias.constructionDrive)}</span>
              </div>

              <div className={styles.row}>
                <span>observationPatience</span>
                <span>{formatValue(currentProfile.bias.observationPatience)}</span>
              </div>

              <div className={styles.row}>
                <span>boundarySensitivity</span>
                <span>{formatValue(currentProfile.bias.boundarySensitivity)}</span>
              </div>

              <div className={styles.row}>
                <span>opportunityInitiative</span>
                <span>{formatValue(currentProfile.bias.opportunityInitiative)}</span>
              </div>
            </>
          )}
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            Profile Tuning / Task Influence
          </h3>

          {!currentProfile && (
            <p className={styles.empty}>
              注入后会显示 Profile 对任务倾向的调参。
            </p>
          )}

          {currentProfile && (
            <>
              <div className={styles.row}>
                <span>carePriorityOffset</span>
                <span>{formatValue(profileTuning.carePriorityOffset)}</span>
              </div>

              <div className={styles.row}>
                <span>constructionDriveOffset</span>
                <span>{formatValue(profileTuning.constructionDriveOffset)}</span>
              </div>

              <div className={styles.row}>
                <span>foodSensitivityOffset</span>
                <span>{formatValue(profileTuning.foodSensitivityOffset)}</span>
              </div>

              <div className={styles.row}>
                <span>restSensitivityOffset</span>
                <span>{formatValue(profileTuning.restSensitivityOffset)}</span>
              </div>

              <div className={styles.row}>
                <span>approachSensitivityOffset</span>
                <span>{formatValue(profileTuning.approachSensitivityOffset)}</span>
              </div>

              <div className={styles.row}>
                <span>observationBiasOffset</span>
                <span>{formatValue(profileTuning.observationBiasOffset)}</span>
              </div>

              <div className={styles.row}>
                <span>说明</span>
                <span className={styles.multiline}>
                  Tuning 只影响管家任务倾向，不直接控制宠物行为。
                </span>
              </div>
            </>
          )}
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            Task Decision Trace / 任务选择审计
          </h3>

          {!taskDecisionTrace && (
            <p className={styles.empty}>
              当前还没有任务选择审计。等待下一次世界 Tick 后生成。
            </p>
          )}

          {taskDecisionTrace && (
            <>
              <div className={styles.row}>
                <span>selectedTask</span>
                <span>{taskDecisionTrace.selectedTask}</span>
              </div>

              <div className={styles.row}>
                <span>previousTask</span>
                <span>{taskDecisionTrace.previousTask}</span>
              </div>

              <div className={styles.row}>
                <span>reason</span>
                <span className={styles.multiline}>
                  {taskDecisionTrace.reason}
                </span>
              </div>

              <div className={styles.row}>
                <span>hasPet</span>
                <span>{formatValue(taskDecisionTrace.context.hasPet)}</span>
              </div>

              <div className={styles.row}>
                <span>hasTimeline</span>
                <span>
                  {formatValue(taskDecisionTrace.context.hasTimelineSnapshot)}
                </span>
              </div>

              <div className={styles.row}>
                <span>incubatorCompleted</span>
                <span>
                  {formatValue(taskDecisionTrace.context.incubatorCompleted)}
                </span>
              </div>

              <div className={styles.row}>
                <span>homeCompleted</span>
                <span>
                  {formatValue(taskDecisionTrace.context.homeCompleted)}
                </span>
              </div>

              <div className={styles.row}>
                <span>pendingOpportunity</span>
                <span>
                  {formatValue(taskDecisionTrace.context.pendingOpportunityCount)}
                </span>
              </div>

              <div className={styles.row}>
                <span>petEnergy</span>
                <span>{formatValue(taskDecisionTrace.context.petEnergy)}</span>
              </div>

              <div className={styles.row}>
                <span>petHunger</span>
                <span>{formatValue(taskDecisionTrace.context.petHunger)}</span>
              </div>

              <div className={styles.row}>
                <span>petEmotion</span>
                <span>{formatValue(taskDecisionTrace.context.petEmotion)}</span>
              </div>

              <div className={styles.row}>
                <span>petRelation</span>
                <span>{formatValue(taskDecisionTrace.context.petRelation)}</span>
              </div>

              <div className={styles.row}>
                <span>lifePhase</span>
                <span>{formatValue(taskDecisionTrace.context.petLifePhase)}</span>
              </div>

              <div className={styles.row}>
                <span>time</span>
                <span>
                  {formatValue(taskDecisionTrace.context.timeHour)}
                  {" / "}
                  {formatValue(taskDecisionTrace.context.timePeriod)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            Decision Gates / 条件门
          </h3>

          {!taskDecisionTrace && (
            <p className={styles.empty}>
              暂无 gates。
            </p>
          )}

          {taskDecisionTrace && taskDecisionTrace.gates.length === 0 && (
            <p className={styles.empty}>
              本轮没有记录 gate，可能是孵化器优先分支或待命分支。
            </p>
          )}

          {taskDecisionTrace &&
            taskDecisionTrace.gates.slice(0, 8).map((gate, index) => (
              <div className={styles.row} key={`${gate.key}-${index}`}>
                <span>
                  {gate.key} / {formatGatePassed(gate.passed)}
                </span>

                <span className={styles.multiline}>
                  {gate.reason}
                </span>
              </div>
            ))}
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            Decision Scores / 判断分数
          </h3>

          {!taskDecisionTrace && (
            <p className={styles.empty}>
              暂无 scores。
            </p>
          )}

          {taskDecisionTrace && taskDecisionTrace.scores.length === 0 && (
            <p className={styles.empty}>
              本轮没有记录 score，可能是孵化器优先分支或待命分支。
            </p>
          )}

          {taskDecisionTrace &&
            taskDecisionTrace.scores.slice(0, 8).map((score, index) => (
              <div className={styles.row} key={`${score.key}-${index}`}>
                <span>
                  {score.key}: {formatValue(score.value)}
                </span>

                <span className={styles.multiline}>
                  {score.reason}
                </span>
              </div>
            ))}
        </div>

        <div className={styles.block}>
          <h3 className={styles.blockTitle}>
            架构边界 / Boundary
          </h3>

          <div className={styles.row}>
            <span>是否控制宠物</span>
            <span>否</span>
          </div>

          <div className={styles.row}>
            <span>是否直接改宠物行为</span>
            <span>否</span>
          </div>

          <div className={styles.row}>
            <span>是否影响管家任务倾向</span>
            <span>是，轻量调参</span>
          </div>

          <div className={styles.row}>
            <span>当前用途</span>
            <span className={styles.multiline}>
              注入 ButlerState.profile，进入管家 AgentCycleTrace，并轻微影响管家任务选择倾向。
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}