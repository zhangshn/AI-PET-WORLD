"use client"

/**
 * 当前文件负责：承载 Pixi 世界舞台并协调渲染生命周期。
 */

import { useCallback, useEffect, useRef } from "react"
import { Application, Ticker } from "pixi.js"

import type { WorldStimulus } from "@/ai/gateway"
import type { TimeState } from "@/engine/timeSystem"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import { WORLD_STAGE_SIZE } from "./stage-renderers/config/stage-size-config"
import {
  advanceGraphicsStagePhase,
  syncGraphicsStage,
} from "./stage-renderers/orchestrator/graphics-stage-orchestrator"
import { applyStageCamera } from "./stage-renderers/orchestrator/stage-camera-controller"
import {
  attachWorldStageLayers,
  createEmptyWorldStageLayers,
  createWorldStageLayers,
} from "./stage-renderers/orchestrator/stage-layer-factory"
import {
  attachWorldPixiCanvas,
  createWorldPixiApplication,
  destroyWorldPixiApplication,
} from "./stage-renderers/orchestrator/stage-pixi-app"
import { bindWorldStagePointerEvents } from "./stage-renderers/orchestrator/stage-pointer-events"
import {
  cleanupWorldStageRuntimeState,
  createWorldStageRuntimeState,
} from "./stage-renderers/orchestrator/stage-runtime-state"
import type { WorldStageSceneMode } from "./stage-renderers/orchestrator/stage-scene-mode"

import styles from "@/styles/world-styles/world-pixel-stage.module.css"

type Props = {
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  incubator: IncubatorState | null
  stimuli: WorldStimulus[]
  ecology: WorldEcologyState | null
  worldRuntime: WorldRuntimeState | null
  tick: number
  sceneMode?: WorldStageSceneMode
  onEnterShelter?: () => void
}

export default function WorldPixelStage(props: Props) {
  const latestRef = useRef<Props>(props)

  const mountRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const tickerRef = useRef<Ticker | null>(null)

  const layersRef = useRef(createEmptyWorldStageLayers())
  const stageRuntimeRef = useRef(createWorldStageRuntimeState())

  useEffect(() => {
    latestRef.current = props
  }, [props])

  useEffect(() => {
    stageRuntimeRef.current.renderState.lastStaticWorldKey = null
  }, [props.sceneMode])

  const applyCamera = useCallback(() => {
    const stageRuntime = stageRuntimeRef.current
    const latest = latestRef.current
    const sceneMode = latest.sceneMode ?? "exterior"

    if (sceneMode === "shelterInterior") {
      if (layersRef.current.worldLayer) {
        layersRef.current.worldLayer.x = 0
        layersRef.current.worldLayer.y = 0
        layersRef.current.worldLayer.scale.set(1)
      }
      return
    }

    applyStageCamera({
      camera: stageRuntime.camera,
      worldLayer: layersRef.current.worldLayer,
      runtime: latest.worldRuntime,
      stageWidth: WORLD_STAGE_SIZE.width,
      stageHeight: WORLD_STAGE_SIZE.height,
    })
  }, [])

  const tickStage = useCallback(
    (ticker: Ticker) => {
      const deltaScale = ticker.deltaTime
      const latest = latestRef.current
      const stageRuntime = stageRuntimeRef.current

      advanceGraphicsStagePhase({
        renderState: stageRuntime.renderState,
        deltaScale,
      })

      syncGraphicsStage({
        layers: layersRef.current,
        runtimeEntityVisuals: stageRuntime.runtimeEntityVisuals,
        stimulusVisuals: stageRuntime.stimulusVisuals,
        actorVisuals: stageRuntime.actorVisuals,
        petMotion: stageRuntime.petMotion,
        butlerMotion: stageRuntime.butlerMotion,
        renderState: stageRuntime.renderState,
        sceneMode: latest.sceneMode ?? "exterior",
        time: latest.time,
        pet: latest.pet,
        butler: latest.butler,
        incubator: latest.incubator,
        stimuli: latest.stimuli,
        ecology: latest.ecology,
        runtime: latest.worldRuntime,
        tick: latest.tick,
        width: WORLD_STAGE_SIZE.width,
        height: WORLD_STAGE_SIZE.height,
      })

      applyCamera()
    },
    [applyCamera]
  )

  useEffect(() => {
    const currentMount = mountRef.current

    if (!currentMount || appRef.current) return

    const mountElement: HTMLDivElement = currentMount
    const stageRuntime = stageRuntimeRef.current
    let disposed = false

    async function setupPixiApp() {
      const app = await createWorldPixiApplication()

      if (disposed || !mountRef.current) {
        destroyWorldPixiApplication(app)
        return
      }

      appRef.current = app

      attachWorldPixiCanvas({
        mount: mountElement,
        app,
      })

      const layers = createWorldStageLayers()

      attachWorldStageLayers({
        appStage: app.stage,
        layers,
      })

      layersRef.current = layers

      bindWorldStagePointerEvents({
        app,
        camera: stageRuntime.camera,
        layers,
        getRuntime: () => latestRef.current.worldRuntime,
        getSceneMode: () => latestRef.current.sceneMode ?? "exterior",
        onEnterShelter: () => latestRef.current.onEnterShelter?.(),
      })

      const ticker = new Ticker()

      ticker.add(tickStage)
      ticker.start()

      tickerRef.current = ticker
    }

    setupPixiApp()

    return () => {
      disposed = true

      tickerRef.current?.stop()
      tickerRef.current?.destroy()
      tickerRef.current = null

      cleanupWorldStageRuntimeState(stageRuntime)

      destroyWorldPixiApplication(appRef.current)
      appRef.current = null

      layersRef.current = createEmptyWorldStageLayers()
    }
  }, [tickStage])

  return (
    <div className={styles.stageShell}>
      <div ref={mountRef} className={styles.stageCanvas} />
      <div className={styles.stageHint}>
        {(props.sceneMode ?? "exterior") === "shelterInterior"
          ? "住所内部 · 初始生命舱"
          : "点击住所进入室内 · 拖拽观察世界 · F3 打开开发面板"}
      </div>
    </div>
  )
}