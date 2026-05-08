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
  resetAiDataRecords,
} from "@/ai/data-core/ai-data-gateway"

import styles from "@/styles/world-styles/layout/ai-data-debug-panel.module.css"

type AiDataFilterKind = "all" | AiDataRecordKind

type AiWorldEventVisibilityFilter =
  | "all"
  | "debug_log"
  | "message_candidate"
  | "world_notice"
  | "timeline"

type RecordLimit = 16 | 32 | 64

type FilterOption = {
  id: AiDataFilterKind
  label: string
}

type VisibilityOption = {
  id: AiWorldEventVisibilityFilter
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

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    id: "all",
    label: "全部事件",
  },
  {
    id: "timeline",
    label: "时间线",
  },
  {
    id: "debug_log",
    label: "调试日志",
  },
  {
    id: "world_notice",
    label: "世界公告",
  },
  {
    id: "message_candidate",
    label: "消息候选",
  },
]

const RECORD_LIMIT_OPTIONS: RecordLimit[] = [16, 32, 64]

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

function isMatchingVisibility(
  record: AiDataRecord,
  visibilityFilter: AiWorldEventVisibilityFilter
): boolean {
  if (visibilityFilter === "all") return true
  if (record.kind !== "world_event") return true

  return record.visibility === visibilityFilter
}

function getFilteredRecords(input: {
  filterKind: AiDataFilterKind
  visibilityFilter: AiWorldEventVisibilityFilter
  limit: RecordLimit
}): AiDataRecord[] {
  const records =
    input.filterKind === "all"
      ? getAiDataRecords({
          limit: input.limit,
        })
      : getAiDataRecords({
          kind: input.filterKind,
          limit: input.limit,
        })

  return records.filter((record) =>
    isMatchingVisibility(record, input.visibilityFilter)
  )
}

function getFilterCount(filterKind: AiDataFilterKind): number {
  if (filterKind === "all") {
    return getAiDataRecordCount()
  }

  return getAiDataRecordCount({
    kind: filterKind,
  })
}

function formatJson(record: AiDataRecord): string {
  return JSON.stringify(record, null, 2)
}

export default function AiDataDebugPanel() {
  const [activeFilter, setActiveFilter] = useState<AiDataFilterKind>("all")
  const [visibilityFilter, setVisibilityFilter] =
    useState<AiWorldEventVisibilityFilter>("all")
  const [recordLimit, setRecordLimit] = useState<RecordLimit>(16)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const records = useMemo(() => {
    void refreshKey

    return getFilteredRecords({
      filterKind: activeFilter,
      visibilityFilter,
      limit: recordLimit,
    })
  }, [activeFilter, visibilityFilter, recordLimit, refreshKey])

  const totalCount = getAiDataRecordCount()
  const messageCount = getAiDataRecordCount({ kind: "message" })
  const feedbackCount = getAiDataRecordCount({ kind: "user_feedback" })
  const decisionCount = getAiDataRecordCount({ kind: "decision" })
  const worldEventCount = getAiDataRecordCount({ kind: "world_event" })

  const handleReset = () => {
    resetAiDataRecords()
    setExpandedRecordId(null)
    setRefreshKey((value) => value + 1)
  }

  const handleRefresh = () => {
    setRefreshKey((value) => value + 1)
  }

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

      <div className={styles.toolbar}>
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

        <div className={styles.actionBar}>
          <button type="button" onClick={handleRefresh}>
            刷新
          </button>

          <button className={styles.dangerButton} type="button" onClick={handleReset}>
            清空
          </button>
        </div>
      </div>

      {(activeFilter === "all" || activeFilter === "world_event") && (
        <div className={styles.visibilityBar} aria-label="世界事件可见性过滤">
          {VISIBILITY_OPTIONS.map((option) => {
            const isActive = visibilityFilter === option.id

            return (
              <button
                className={isActive ? styles.activeFilter : ""}
                key={option.id}
                type="button"
                onClick={() => setVisibilityFilter(option.id)}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.limitBar} aria-label="AI 数据记录数量">
        <span>显示数量</span>

        {RECORD_LIMIT_OPTIONS.map((limit) => (
          <button
            className={recordLimit === limit ? styles.activeFilter : ""}
            key={limit}
            type="button"
            onClick={() => setRecordLimit(limit)}
          >
            {limit}
          </button>
        ))}
      </div>

      <div className={styles.recordList}>
        {records.length === 0 && (
          <section className={styles.emptyState}>
            当前分类暂无 AI 数据记录。打开 P-Phone、读取短信或触发世界运行后，这里会出现记录。
          </section>
        )}

        {records.map((record) => {
          const details = getRecordDetails(record)
          const isExpanded = expandedRecordId === record.id

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

              <button
                className={styles.expandButton}
                type="button"
                onClick={() =>
                  setExpandedRecordId((currentId) =>
                    currentId === record.id ? null : record.id
                  )
                }
              >
                {isExpanded ? "收起 JSON" : "查看 JSON"}
              </button>

              {isExpanded && (
                <pre className={styles.jsonBlock}>{formatJson(record)}</pre>
              )}
            </section>
          )
        })}
      </div>
    </article>
  )
}