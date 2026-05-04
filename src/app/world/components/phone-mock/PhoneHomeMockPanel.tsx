"use client"

/**
 * 当前文件负责：组装未来手机主页、模块入口与详情预览。
 */

import { useMemo, useState } from "react"

import type { WorldEngineViewState } from "../../hooks/useWorldEngineState"
import type { PhoneDetailPageData } from "../../utils/phoneDetailMappers"

import { buildWorldHudBundle } from "../../utils/worldHudMappers"
import { buildPhoneHomeScreenModuleData } from "../../utils/phoneModuleMappers"
import { buildPhoneDetailBundle } from "../../utils/phoneDetailMappers"

import PhoneModuleGrid from "./PhoneModuleGrid"
import PhoneModuleDetail from "./PhoneModuleDetail"
import PhoneObservationList from "./PhoneObservationList"
import type { PhoneMockModuleId } from "./PhoneMockTypes"

import styles from "@/styles/world-styles/phone-home-mock-panel.module.css"

type Props = {
  world: WorldEngineViewState
}

function getDetailByModule(
  activeModule: PhoneMockModuleId,
  details: {
    pet: PhoneDetailPageData
    butler: PhoneDetailPageData
    home: PhoneDetailPageData
  }
): PhoneDetailPageData | null {
  if (activeModule === "pet") return details.pet
  if (activeModule === "butler") return details.butler
  if (activeModule === "home") return details.home

  return null
}

export default function PhoneHomeMockPanel({ world }: Props) {
  const [activeModule, setActiveModule] =
    useState<PhoneMockModuleId>("observation")

  const { phoneData, detailBundle } = useMemo(() => {
    const hud = buildWorldHudBundle({
      time: world.time,
      pet: world.pet,
      butler: world.butler,
      home: world.home,
      stimuli: world.stimuli,
      ecology: world.ecology,
    })

    return {
      phoneData: buildPhoneHomeScreenModuleData({
        hud,
        events: world.events,
      }),
      detailBundle: buildPhoneDetailBundle(hud),
    }
  }, [
    world.time,
    world.pet,
    world.butler,
    world.home,
    world.stimuli,
    world.ecology,
    world.events,
  ])

  const selectedModule =
    phoneData.modules.find((module) => module.id === activeModule) ??
    phoneData.modules[0]

  const selectedDetail = getDetailByModule(activeModule, detailBundle)
  const observationModule = phoneData.modules[3]

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PHONE HOME MOCK</p>
          <h2 className={styles.title}>手机主页模块预览</h2>
        </div>

        <span className={styles.badge}>{phoneData.modules.length}</span>
      </div>

      <div className={styles.phone}>
        <div className={styles.phoneTopBar}>
          <span>AI-PET-WORLD</span>
          <strong>世界终端</strong>
        </div>

        <div className={styles.screenHeader}>
          <div>
            <p className={styles.screenEyebrow}>WORLD DEVICE</p>
            <h3>{phoneData.screenTitle}</h3>
          </div>

          <span className={styles.screenBadge}>Alpha</span>
        </div>

        <p className={styles.screenSubtitle}>
          {phoneData.screenSubtitle}
        </p>

        <PhoneModuleGrid
          modules={phoneData.modules}
          activeModule={activeModule}
          onSelectModule={setActiveModule}
        />

        <PhoneModuleDetail
          module={selectedModule}
          detail={selectedDetail}
        />

        {activeModule === "observation" && (
          <PhoneObservationList observationModule={observationModule} />
        )}
      </div>
    </section>
  )
}