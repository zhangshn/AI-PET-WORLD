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
  createStageCameraState,
  resetStageCamera,
} from "./stage-renderers/orchestrator/stage-camera-controller"
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
    const currentMount = mountRef.current

    if (!currentMount || appRef.current) return

    const mountElement: HTMLDivElement = currentMount
    const runtimeEntityVisuals = runtimeEntityVisualsRef.current
    const stimulusVisuals = stimulusVisualsRef.current
    const actorVisuals = actorVisualsRef.current
    const renderState = renderStateRef.current
    const camera = cameraRef.current
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
        camera,
        layers,
        getRuntime: () => latestRef.current.worldRuntime,
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

      destroyWorldPixiApplication(appRef.current)
      appRef.current = null

      layersRef.current = createEmptyWorldStageLayers()
    }
  }, [tickStage])

  return (
    <div className={styles.stageShell}>
      <div ref={mountRef} className={styles.stageCanvas} />
      <div className={styles.stageHint}>
        拖拽观察世界 · F3 打开开发面板
      </div>
    </div>
  )
}