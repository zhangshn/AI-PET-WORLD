"use client"

/**
 * 当前文件负责：展示管家长期记忆调试信息。
 */

import type { ButlerMemoryState } from "@/systems/butler/butler-gateway"

import { formatDebugValue } from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  memory: ButlerMemoryState | null
}

export default function ButlerMemoryDebugPanel({ memory }: Props) {
  const latestEntry = memory?.latestEntry ?? null
  const entries = memory?.entries ?? []

  return (
    <>
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Butler Memory / 管家记忆
        </h3>

        {!memory && (
          <p className={styles.empty}>
            当前还没有读取到管家记忆状态。
          </p>
        )}

        {memory && (
          <>
            <div className={styles.row}>
              <span>totalCount</span>
              <span>{formatDebugValue(memory.totalCount)}</span>
            </div>

            <div className={styles.row}>
              <span>entries</span>
              <span>{formatDebugValue(memory.entries.length)}</span>
            </div>

            <div className={styles.row}>
              <span>latestEntry</span>
              <span>
                {latestEntry ? latestEntry.id : "-"}
              </span>
            </div>

            <div className={styles.row}>
              <span>说明</span>
              <span className={styles.multiline}>
                当前记忆只做沉淀和展示，不参与管家任务选择。
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Latest Memory / 最新记忆
        </h3>

        {!latestEntry && (
          <p className={styles.empty}>
            当前还没有最新记忆。等待下一次世界 Tick 后生成。
          </p>
        )}

        {latestEntry && (
          <>
            <div className={styles.row}>
              <span>id</span>
              <span className={styles.multiline}>
                {latestEntry.id}
              </span>
            </div>

            <div className={styles.row}>
              <span>tick</span>
              <span>{formatDebugValue(latestEntry.tick)}</span>
            </div>

            <div className={styles.row}>
              <span>type</span>
              <span>{latestEntry.type}</span>
            </div>

            <div className={styles.row}>
              <span>sourceTask</span>
              <span>{latestEntry.sourceTask}</span>
            </div>

            <div className={styles.row}>
              <span>importance</span>
              <span>{formatDebugValue(latestEntry.importance)}</span>
            </div>

            <div className={styles.row}>
              <span>emotionalWeight</span>
              <span>{formatDebugValue(latestEntry.emotionalWeight)}</span>
            </div>

            <div className={styles.row}>
              <span>summary</span>
              <span className={styles.multiline}>
                {latestEntry.summary}
              </span>
            </div>

            <div className={styles.row}>
              <span>tags</span>
              <span className={styles.multiline}>
                {latestEntry.tags.join(" / ")}
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Recent Memories / 最近记忆
        </h3>

        {entries.length === 0 && (
          <p className={styles.empty}>
            暂无记忆条目。
          </p>
        )}

        {entries.slice(0, 6).map((entry) => (
          <div className={styles.row} key={entry.id}>
            <span>
              #{entry.tick} / {entry.type}
            </span>

            <span className={styles.multiline}>
              {entry.summary}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}