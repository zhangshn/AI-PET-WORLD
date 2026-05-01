/**
 * 当前文件负责：展示 Timeline 当前快照与本次变化。
 */

import type { PetTimelineSnapshot } from "../../../../ai/gateway"

import { ValueLine } from "../common/ValueLine"

import {
  BRANCH_LABEL_MAP,
  COGNITIVE_LABELS,
  DRIVE_LABELS,
  EMOTIONAL_LABELS,
  PHASE_LABELS,
  RELATIONAL_LABELS
} from "./timeline-labels"

import type { DiffItem } from "./timeline-types"

export function TimelineSnapshotView({
  timelineSnapshot,
  lastDiffs
}: {
  timelineSnapshot: PetTimelineSnapshot
  lastDiffs: DiffItem[]
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 18,
        lineHeight: 1.9
      }}
    >
      <div>
        <strong>当前快照</strong>
        <ValueLine
          label="阶段"
          value={
            PHASE_LABELS[timelineSnapshot.fortune.phaseTag] ??
            timelineSnapshot.fortune.phaseTag
          }
        />
        <ValueLine
          label="情绪"
          value={
            EMOTIONAL_LABELS[timelineSnapshot.state.emotional.label] ??
            timelineSnapshot.state.emotional.label
          }
        />
        <ValueLine
          label="能量"
          value={Math.round(timelineSnapshot.state.physical.energy)}
        />
        <ValueLine
          label="饥饿"
          value={Math.round(timelineSnapshot.state.physical.hunger)}
        />
        <ValueLine
          label="认知"
          value={
            COGNITIVE_LABELS[timelineSnapshot.state.cognitive.label] ??
            timelineSnapshot.state.cognitive.label
          }
        />
        <ValueLine
          label="关系"
          value={
            RELATIONAL_LABELS[timelineSnapshot.state.relational.label] ??
            timelineSnapshot.state.relational.label
          }
        />
        <ValueLine
          label="驱动"
          value={
            DRIVE_LABELS[timelineSnapshot.state.drive.primary] ??
            timelineSnapshot.state.drive.primary
          }
        />
        <ValueLine
          label="路径"
          value={
            BRANCH_LABEL_MAP[timelineSnapshot.trajectory.branchTag] ??
            timelineSnapshot.trajectory.branchTag
          }
        />
      </div>

      <div>
        <strong>本次变化</strong>
        <div style={{ marginTop: 10 }}>
          {lastDiffs.length > 0 ? (
            lastDiffs.map((item) => {
              return (
                <div key={`${item.label}-${item.before}-${item.after}`}>
                  {item.label}：{item.before} → {item.after}
                </div>
              )
            })
          ) : (
            <div style={{ color: "#999" }}>
              这次操作没有造成可见参数变化。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}