"use client"

/**
 * 当前文件负责：展示管家 Profile、Bias、Tuning 与架构边界。
 */

import { useMemo } from "react"

import {
  buildButlerProfileTaskTuning,
} from "@/systems/butler/butler-gateway"

import type { ButlerProfile } from "@/ai/gateway"

import { formatDebugValue } from "./butlerDebugFormatters"

import styles from "@/styles/world-styles/debug/runtime-debug-panel.module.css"

type Props = {
  profile: ButlerProfile | null
}

export default function ButlerProfileDebugPanel({ profile }: Props) {
  const profileTuning = useMemo(() => {
    return buildButlerProfileTaskTuning(profile)
  }, [profile])

  return (
    <>
      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          当前 Profile / Current Profile
        </h3>

        {!profile && (
          <p className={styles.empty}>
            当前尚未注入 ButlerProfile。
          </p>
        )}

        {profile && (
          <>
            <div className={styles.row}>
              <span>名称</span>
              <span>{profile.identity.displayName}</span>
            </div>

            <div className={styles.row}>
              <span>映射模式</span>
              <span>{profile.identity.mappingMode}</span>
            </div>

            <div className={styles.row}>
              <span>出生时间模式</span>
              <span>{profile.identity.birthTimeMode}</span>
            </div>

            <div className={styles.row}>
              <span>照护风格</span>
              <span>{profile.careStyle}</span>
            </div>

            <div className={styles.row}>
              <span>建设风格</span>
              <span>{profile.buildStyle}</span>
            </div>

            <div className={styles.row}>
              <span>边界风格</span>
              <span>{profile.boundaryStyle}</span>
            </div>

            <div className={styles.row}>
              <span>机会方式</span>
              <span>{profile.opportunityStyle}</span>
            </div>

            <div className={styles.row}>
              <span>摘要</span>
              <span className={styles.multiline}>
                {profile.publicSummary}
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Profile Bias
        </h3>

        {!profile && (
          <p className={styles.empty}>
            注入后会显示 bias。
          </p>
        )}

        {profile && (
          <>
            <div className={styles.row}>
              <span>carePriority</span>
              <span>{formatDebugValue(profile.bias.carePriority)}</span>
            </div>

            <div className={styles.row}>
              <span>constructionDrive</span>
              <span>{formatDebugValue(profile.bias.constructionDrive)}</span>
            </div>

            <div className={styles.row}>
              <span>observationPatience</span>
              <span>{formatDebugValue(profile.bias.observationPatience)}</span>
            </div>

            <div className={styles.row}>
              <span>boundarySensitivity</span>
              <span>{formatDebugValue(profile.bias.boundarySensitivity)}</span>
            </div>

            <div className={styles.row}>
              <span>opportunityInitiative</span>
              <span>{formatDebugValue(profile.bias.opportunityInitiative)}</span>
            </div>
          </>
        )}
      </div>

      <div className={styles.block}>
        <h3 className={styles.blockTitle}>
          Profile Tuning / Task Influence
        </h3>

        {!profile && (
          <p className={styles.empty}>
            注入后会显示 Profile 对任务倾向的调参。
          </p>
        )}

        {profile && (
          <>
            <div className={styles.row}>
              <span>carePriorityOffset</span>
              <span>{formatDebugValue(profileTuning.carePriorityOffset)}</span>
            </div>

            <div className={styles.row}>
              <span>constructionDriveOffset</span>
              <span>{formatDebugValue(profileTuning.constructionDriveOffset)}</span>
            </div>

            <div className={styles.row}>
              <span>foodSensitivityOffset</span>
              <span>{formatDebugValue(profileTuning.foodSensitivityOffset)}</span>
            </div>

            <div className={styles.row}>
              <span>restSensitivityOffset</span>
              <span>{formatDebugValue(profileTuning.restSensitivityOffset)}</span>
            </div>

            <div className={styles.row}>
              <span>approachSensitivityOffset</span>
              <span>{formatDebugValue(profileTuning.approachSensitivityOffset)}</span>
            </div>

            <div className={styles.row}>
              <span>observationBiasOffset</span>
              <span>{formatDebugValue(profileTuning.observationBiasOffset)}</span>
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
    </>
  )
}