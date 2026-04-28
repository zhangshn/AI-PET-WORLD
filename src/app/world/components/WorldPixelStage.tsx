"use client"

/**
 * 当前文件负责：初始化 Pixi 世界舞台，管理摄像机与渲染调度生命周期。
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
  clearCoreActorVisuals,
  clearRuntimeEntityVisuals,
  clearStimulusVisuals,
  createCoreActorVisualRegistry,
  createRuntimeEntityVisualRegistry,
  createStimulusVisualRegistry,
  type ActorMotionState,
} from "./stage-renderers/gateway/stage-renderer-gateway"
import {
  advanceGraphicsStagePhase,
  createGraphicsStageRenderState,
  resetGraphicsStageRenderState,
  syncGraphicsStage,
} from "./stage-renderers/orchestrator/graphics-stage-orchestrator"
import {
  applyStageCamera,
  beginStageCameraDrag,
  createStageCameraState,
  endStageCameraDrag,
  moveStageCameraDrag,
  resetStageCamera,
} from "./stage-renderers/orchestrator/stage-camera-controller"
import {
  attachWorldStageLayers,
  createEmptyWorldStageLayers,
  createWorldStageLayers,
} from "./stage-renderers/orchestrator/stage-layer-factory"

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
}

export default function WorldPixelStage(props: Props) {
  const latestRef = useRef<Props>(props)

  const mountRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const tickerRef = useRef<Ticker | null>(null)

  const layersRef = useRef(createEmptyWorldStageLayers())

  const runtimeEntityVisualsRef = useRef(createRuntimeEntityVisualRegistry())
  const stimulusVisualsRef = useRef(createStimulusVisualRegistry())
  const actorVisualsRef = useRef(createCoreActorVisualRegistry())
  const renderStateRef = useRef(createGraphicsStageRenderState())
  const cameraRef = useRef(createStageCameraState())

  const petMotionRef = useRef<ActorMotionState>({
    x: 620,
    y: 420,
    targetX: 620,
    targetY: 420,
    speed: 1.1,
  })

  const butlerMotionRef = useRef<ActorMotionState>({
    x: 340,
    y: 340,
    targetX: 340,
    targetY: 340,
    speed: 0.95,
  })

  useEffect(() => {
    latestRef.current = props
  }, [props])

  const applyCamera = useCallback(() => {
    applyStageCamera({
      camera: cameraRef.current,
      worldLayer: layersRef.current.worldLayer,
      runtime: latestRef.current.worldRuntime,
      stageWidth: WORLD_STAGE_SIZE.width,
      stageHeight: WORLD_STAGE_SIZE.height,
    })
  }, [])

  const tickStage = useCallback(
    (ticker: Ticker) => {
      const deltaScale = ticker.deltaTime
      const latest = latestRef.current

      advanceGraphicsStagePhase({
        renderState: renderStateRef.current,
        deltaScale,
      })

      syncGraphicsStage({
        layers: layersRef.current,
        runtimeEntityVisuals: runtimeEntityVisualsRef.current,
        stimulusVisuals: stimulusVisualsRef.current,
        actorVisuals: actorVisualsRef.current,
        petMotion: petMotionRef.current,
        butlerMotion: butlerMotionRef.current,
        renderState: renderStateRef.current,
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
    const mount = mountRef.current

    if (!mount || appRef.current) return

    const app = new Application()
    const runtimeEntityVisuals = runtimeEntityVisualsRef.current
    const stimulusVisuals = stimulusVisualsRef.current
    const actorVisuals = actorVisualsRef.current
    const renderState = renderStateRef.current
    const camera = cameraRef.current
    let disposed = false

    async function setupPixiApp() {
      await app.init({
        width: WORLD_STAGE_SIZE.width,
        height: WORLD_STAGE_SIZE.height,
        backgroundAlpha: 0,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      })

      if (disposed || !mountRef.current) {
        app.destroy(true)
        return
      }

      appRef.current = app
      mountRef.current.appendChild(app.canvas)

      const layers = createWorldStageLayers()

      attachWorldStageLayers({
        appStage: app.stage,
        layers,
      })

      layersRef.current = layers

      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen

      app.stage.on("pointerdown", (event) => {
        beginStageCameraDrag({
          camera: cameraRef.current,
          pointerX: event.global.x,
          pointerY: event.global.y,
        })
      })

      app.stage.on("pointermove", (event) => {
        moveStageCameraDrag({
          camera: cameraRef.current,
          pointerX: event.global.x,
          pointerY: event.global.y,
        })

        applyCamera()
      })

      app.stage.on("pointerup", () => {
        endStageCameraDrag(cameraRef.current)
      })

      app.stage.on("pointerupoutside", () => {
        endStageCameraDrag(cameraRef.current)
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

      clearRuntimeEntityVisuals(runtimeEntityVisuals)
      clearStimulusVisuals(stimulusVisuals)
      clearCoreActorVisuals(actorVisuals)
      resetGraphicsStageRenderState(renderState)
      resetStageCamera(camera)

      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true,
          texture: true,
        })
        appRef.current = null
      }

      layersRef.current = createEmptyWorldStageLayers()
    }
  }, [applyCamera, tickStage])

  return (
    <div className={styles.stageShell}>
      <div ref={mountRef} className={styles.stageCanvas} />
      <div className={styles.stageHint}>
        拖拽观察世界 · F3 打开开发面板
      </div>
    </div>
  )
}