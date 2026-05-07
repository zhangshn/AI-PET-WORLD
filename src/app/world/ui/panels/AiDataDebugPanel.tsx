"use client"

/**
 * 当前文件负责：展示 AI Data Core 的开发观察面板。
 */

import { useMemo, useState } from "react"

import type {
  AiDataRecord,
  AiDataRecordKind,
  AiDecisionRecord,
  AiMessageRecord,
  AiUserFeedbackRecord,
  AiWorldEventRecord,
} from "@/ai/data-core/ai-data-types"

import {
  getAiDataRecordCount,
  getAiDataRecords,
} from "@/ai/data-core/ai-data-gateway"

import styles from "@/styles/world-styles/layout/ai-data-debug-panel.module.css"

type AiDataFilterKind = "all" | AiDataRecordKind

type FilterOption = {
  id: AiDataFilterKind
  label: string
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    id: "all",
    label: "全部",
  },
  {
    id: "decision",
    label: "决策",
  },
  {
    id: "world_event",
    label: "世界事件",
  },
  {
    id: "message",
    label: "消息",
  },
  {
    id: "user_feedback",
    label: "用户反馈",
  },
]

function formatRecordKind(kind: AiDataRecord["kind"]): string {
  if (kind === "decision") return "决策"
  if (kind === "world_event") return "世界事件"
  if (kind === "message") return "消息"
  if (kind === "state_snapshot") return "状态快照"
  if (kind === "user_feedback") return "用户反馈"

  return kind
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-"
  if (typeof value === "string") return value
  if (typeof value === "number") return String(Math.round(value * 100) / 100)
  if (typeof value === "boolean") return value ? "true" : "false"

  return JSON.stringify(value)
}

function getDecisionDetails(record: AiDecisionRecord) {
  return [
    {
      label: "drive",
      value: record.afterState?.values.dominantDrive,
    },
    {
      label: "final",
      value: record.afterState?.values.finalAction,
    },
    {
      label: "goal",
      value: record.afterState?.values.goalType,
    },
    {
      label: "energy",
      value: record.beforeState.values.energy,
    },
    {
      label: "hunger",
      value: record.beforeState.values.hunger,
    },
    {
      label: "reason",
      value: record.reason.mainReason,
    },
  ]
}

function getWorldEventDetails(record: AiWorldEventRecord) {
  return [
    {
      label: "type",
      value: record.eventType,
    },
    {
      label: "visibility",
      value: record.visibility,
    },
    {
      label: "day",
      value: record.payload.day,
    },
    {
      label: "hour",
      value: record.payload.hour,
    },
    {
      label: "pet",
      value: record.payload.petName,
    },
  ]
}

function getMessageDetails(record: AiMessageRecord) {
  return [
    {
      label: "channel",
      value: record.messageChannel,
    },
    {
      label: "trigger",
      value: record.triggerReason,
    },
    {
      label: "read",
      value: record.wasReadByUser ?? false,
    },
    {
      label: "source",
      value: record.sourceEventId,
    },
  ]
}

function getUserFeedbackDetails(record: AiUserFeedbackRecord) {
  return [
    {
      label: "type",
      value: record.feedbackType,
    },
    {
      label: "target",
      value: record.targetId,
    },
    {
      label: "value",
      value: record.feedbackValue,
    },
  ]
}

function getRecordDetails(record: AiDataRecord) {
  if (record.kind === "decision") {
    return getDecisionDetails(record)
  }

  if (record.kind === "world_event") {
    return getWorldEventDetails(record)
  }

  if (record.kind === "message") {
    return getMessageDetails(record)
  }

  if (record.kind === "user_feedback") {
    return getUserFeedbackDetails(record)
  }

  if (record.kind === "state_snapshot") {
    return [
      {
        label: "snapshot",
        value: record.snapshot.label,
      },
    ]
  }

  return []
}

function getRecordClassName(record: AiDataRecord): string {
  const classNames = [styles.recordItem]

  if (record.kind === "decision") {
    classNames.push(styles.decisionRecord)
  }

  if (record.kind === "world_event") {
    classNames.push(styles.worldEventRecord)
  }

  if (record.kind === "message") {
    classNames.push(styles.messageRecord)
  }

  if (record.kind === "user_feedback") {
    classNames.push(styles.feedbackRecord)
  }

  return classNames.join(" ")
}

function getFilteredRecords(filterKind: AiDataFilterKind): AiDataRecord[] {
  if (filterKind === "all") {
    return getAiDataRecords({
      limit: 16,
    })
  }

  return getAiDataRecords({
    kind: filterKind,
    limit: 16,
  })
}

function getFilterCount(filterKind: AiDataFilterKind): number {
  if (filterKind === "all") {
    return getAiDataRecordCount()
  }

  return getAiDataRecordCount({
    kind: filterKind,
  })
}

export default function AiDataDebugPanel() {
  const [activeFilter, setActiveFilter] = useState<AiDataFilterKind>("all")

  const records = useMemo(() => {
    return getFilteredRecords(activeFilter)
  }, [activeFilter])

  const totalCount = getAiDataRecordCount()
  const messageCount = getAiDataRecordCount({ kind: "message" })
  const feedbackCount = getAiDataRecordCount({ kind: "user_feedback" })
  const decisionCount = getAiDataRecordCount({ kind: "decision" })
  const worldEventCount = getAiDataRecordCount({ kind: "world_event" })

  return (
    <article className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>AI DATA CORE</p>
          <h3>自有 AI 数据记录</h3>
        </div>

        <strong>{totalCount}</strong>
      </header>

      <div className={styles.statsGrid}>
        <span>
          <small>消息</small>
          <strong>{messageCount}</strong>
        </span>

        <span>
          <small>用户反馈</small>
          <strong>{feedbackCount}</strong>
        </span>

        <span>
          <small>决策</small>
          <strong>{decisionCount}</strong>
        </span>

        <span>
          <small>世界事件</small>
          <strong>{worldEventCount}</strong>
        </span>
      </div>

      <div className={styles.filterBar} aria-label="AI 数据记录过滤">
        {FILTER_OPTIONS.map((option) => {
          const isActive = activeFilter === option.id

          return (
            <button
              className={isActive ? styles.activeFilter : ""}
              key={option.id}
              type="button"
              onClick={() => setActiveFilter(option.id)}
            >
              <span>{option.label}</span>
              <strong>{getFilterCount(option.id)}</strong>
            </button>
          )
        })}
      </div>

      <div className={styles.recordList}>
        {records.length === 0 && (
          <section className={styles.emptyState}>
            当前分类暂无 AI 数据记录。打开 P-Phone、读取短信或触发世界运行后，这里会出现记录。
          </section>
        )}

        {records.map((record) => {
          const details = getRecordDetails(record)

          return (
            <section className={getRecordClassName(record)} key={record.id}>
              <div className={styles.recordTop}>
                <strong>{formatRecordKind(record.kind)}</strong>
                <small>{record.source}</small>
              </div>

              <p>{record.summary}</p>

              {details.length > 0 && (
                <div className={styles.detailGrid}>
                  {details.map((detail) => (
                    <span key={`${record.id}-${detail.label}`}>
                      <small>{detail.label}</small>
                      <strong>{formatValue(detail.value)}</strong>
                    </span>
                  ))}
                </div>
              )}

              <div className={styles.recordMeta}>
                <span>{record.entityType}</span>
                <span>{record.importance}</span>
                <span>{record.userVisibleChannel}</span>
              </div>
            </section>
          )
        })}
      </div>
    </article>
  )
}