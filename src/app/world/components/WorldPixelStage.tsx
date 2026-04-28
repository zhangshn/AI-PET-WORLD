"use client"

/**
 * 当前文件负责：初始化 Pixi 世界舞台，管理图层、摄像机与各舞台渲染器调度。
 */

import { useCallback, useEffect, useRef } from "react"
import { Application, Container, Graphics, Ticker } from "pixi.js"

import type { WorldStimulus } from "@/ai/gateway"
import type { TimeState } from "@/engine/timeSystem"
import type { ButlerState } from "@/types/butler"
import type { IncubatorState } from "@/types/incubator"
import type { PetState } from "@/types/pet"
import type { WorldEcologyState } from "@/world/ecology/ecology-engine"
import type { WorldRuntimeState } from "@/world/runtime/world-runtime"

import {
  animateStimulusVisuals,
  clearCoreActorVisuals,
  clearRuntimeEntityVisuals,
  clearStimulusVisuals,
  createCoreActorVisualRegistry,
  createCoreActorVisuals,
  createRuntimeEntityVisualRegistry,
  createStimulusVisualRegistry,
  drawStaticWorld,
  getStaticWorldRenderKey,
  syncCoreActorVisuals,
  syncRuntimeEntityVisuals,
  syncStimulusVisuals,
  syncWorldZoneVisuals,
  type ActorMotionState,
} from "./stage-renderers/gateway/stage-renderer-gateway"

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

type CameraState = {
  x: number
  y: number
  dragging: boolean
  lastPointerX: number
  lastPointerY: number
}

const STAGE_WIDTH = 1280
const STAGE_HEIGHT = 720

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getOverlayAlpha(period?: string): number {
  if (period === "Morning") return 0.025
  if (period === "Daytime") return 0
  if (period === "Evening") return 0.06
  if (period === "Night") return 0.16

  return 0.02
}

export default function WorldPixelStage(props: Props) {
  const latestRef = useRef<Props>(props)

  const mountRef = useRef<HTMLDivElement | null>(null)
  const appRef = useRef<Application | null>(null)
  const tickerRef = useRef<Ticker | null>(null)

  const worldLayerRef = useRef<Container | null>(null)
  const backgroundLayerRef = useRef<Container | null>(null)
  const landLayerRef = useRef<Container | null>(null)
  const structureLayerRef = useRef<Container | null>(null)
  const natureLayerRef = useRef<Container | null>(null)
  const zoneLayerRef = useRef<Container | null>(null)
  const stimulusLayerRef = useRef<Container | null>(null)
  const entityLayerRef = useRef<Container | null>(null)
  const foregroundLayerRef = useRef<Container | null>(null)
  const overlayRef = useRef<Graphics | null>(null)

  const runtimeEntityVisualsRef = useRef(createRuntimeEntityVisualRegistry())
  const stimulusVisualsRef = useRef(createStimulusVisualRegistry())
  const actorVisualsRef = useRef(createCoreActorVisualRegistry())

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

  const cameraRef = useRef<CameraState>({
    x: 0,
    y: 0,
    dragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
  })

  const phaseRef = useRef(0)
  const lastStaticWorldKeyRef = useRef<string | null>(null)

  useEffect(() => {
    latestRef.current = props
  }, [props])

  const clampCamera = useCallback(() => {
    const runtime = latestRef.current.worldRuntime
    const map = runtime?.map

    const mapWidth = map ? map.size.width * map.tileSize : STAGE_WIDTH
    const mapHeight = map ? map.size.height * map.tileSize : STAGE_HEIGHT

    const minX = Math.min(0, STAGE_WIDTH - mapWidth)
    const minY = Math.min(0, STAGE_HEIGHT - mapHeight)

    cameraRef.current.x = clamp(cameraRef.current.x, minX, 0)
    cameraRef.current.y = clamp(cameraRef.current.y, minY, 0)
  }, [])

  const applyCamera = useCallback(() => {
    const worldLayer = worldLayerRef.current

    if (!worldLayer) return

    clampCamera()

    worldLayer.x = cameraRef.current.x
    worldLayer.y = cameraRef.current.y
  }, [clampCamera])

  const redrawStaticWorldIfNeeded = useCallback(() => {
    const runtime = latestRef.current.worldRuntime
    const renderKey = getStaticWorldRenderKey(runtime)

    if (lastStaticWorldKeyRef.current === renderKey) return

    lastStaticWorldKeyRef.current = renderKey

    drawStaticWorld({
      layers: {
        backgroundLayer: backgroundLayerRef.current,
        terrainLayer: landLayerRef.current,
        structureLayer: structureLayerRef.current,
        natureLayer: natureLayerRef.current,
        foregroundLayer: foregroundLayerRef.current,
      },
      runtime,
      fallbackWidth: STAGE_WIDTH,
      fallbackHeight: STAGE_HEIGHT,
    })
  }, [])

  const syncDynamicWorld = useCallback(() => {
    const runtime = latestRef.current.worldRuntime
    const natureLayer = natureLayerRef.current
    const zoneLayer = zoneLayerRef.current
    const entityLayer = entityLayerRef.current
    const stimulusLayer = stimulusLayerRef.current

    if (natureLayer) {
      syncRuntimeEntityVisuals({
        layer: natureLayer,
        runtime,
        visuals: runtimeEntityVisualsRef.current,
      })
    }

    if (zoneLayer) {
      syncWorldZoneVisuals({
        layer: zoneLayer,
        ecology: latestRef.current.ecology,
      })
    }

    if (entityLayer) {
      createCoreActorVisuals({
        layer: entityLayer,
        registry: actorVisualsRef.current,
      })

      syncCoreActorVisuals({
        registry: actorVisualsRef.current,
        pet: latestRef.current.pet,
        butler: latestRef.current.butler,
        incubator: latestRef.current.incubator,
        ecology: latestRef.current.ecology,
        tick: latestRef.current.tick,
        phase: phaseRef.current,
        petMotion: petMotionRef.current,
        butlerMotion: butlerMotionRef.current,
      })
    }

    if (stimulusLayer) {
      syncStimulusVisuals({
        layer: stimulusLayer,
        stimuli: latestRef.current.stimuli,
        visuals: stimulusVisualsRef.current,
        tick: latestRef.current.tick,
      })
    }
  }, [])

  const syncOverlay = useCallback(() => {
    const overlay = overlayRef.current

    if (!overlay) return

    overlay.clear()
    overlay.rect(0, 0, STAGE_WIDTH, STAGE_HEIGHT).fill({
      color: 0x020617,
      alpha: getOverlayAlpha(latestRef.current.time?.period),
    })
  }, [])

  const tickStage = useCallback(
    (ticker: Ticker) => {
      const deltaScale = ticker.deltaTime

      phaseRef.current += 0.035 * deltaScale

      redrawStaticWorldIfNeeded()
      syncDynamicWorld()
      animateStimulusVisuals({
        visuals: stimulusVisualsRef.current,
        phase: phaseRef.current,
      })
      syncOverlay()
      applyCamera()
    },
    [applyCamera, redrawStaticWorldIfNeeded, syncDynamicWorld, syncOverlay]
  )

    useEffect(() => {
    const mount = mountRef.current

    if (!mount || appRef.current) return

    const app = new Application()
    const runtimeEntityVisuals = runtimeEntityVisualsRef.current
    const stimulusVisuals = stimulusVisualsRef.current
    const actorVisuals = actorVisualsRef.current
    let disposed = false

    async function setupPixiApp() {
      await app.init({
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
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

      const worldLayer = new Container()
      const backgroundLayer = new Container()
      const landLayer = new Container()
      const natureLayer = new Container()
      const structureLayer = new Container()
      const zoneLayer = new Container()
      const entityLayer = new Container()
      const stimulusLayer = new Container()
      const foregroundLayer = new Container()
      const overlay = new Graphics()

      worldLayer.addChild(backgroundLayer)
      worldLayer.addChild(landLayer)
      worldLayer.addChild(natureLayer)
      worldLayer.addChild(structureLayer)
      worldLayer.addChild(zoneLayer)
      worldLayer.addChild(entityLayer)
      worldLayer.addChild(stimulusLayer)
      worldLayer.addChild(foregroundLayer)

      app.stage.addChild(worldLayer)
      app.stage.addChild(overlay)

      worldLayerRef.current = worldLayer
      backgroundLayerRef.current = backgroundLayer
      landLayerRef.current = landLayer
      natureLayerRef.current = natureLayer
      structureLayerRef.current = structureLayer
      zoneLayerRef.current = zoneLayer
      entityLayerRef.current = entityLayer
      stimulusLayerRef.current = stimulusLayer
      foregroundLayerRef.current = foregroundLayer
      overlayRef.current = overlay

      app.stage.eventMode = "static"
      app.stage.hitArea = app.screen

      app.stage.on("pointerdown", (event) => {
        cameraRef.current.dragging = true
        cameraRef.current.lastPointerX = event.global.x
        cameraRef.current.lastPointerY = event.global.y
      })

      app.stage.on("pointermove", (event) => {
        if (!cameraRef.current.dragging) return

        const dx = event.global.x - cameraRef.current.lastPointerX
        const dy = event.global.y - cameraRef.current.lastPointerY

        cameraRef.current.x += dx
        cameraRef.current.y += dy
        cameraRef.current.lastPointerX = event.global.x
        cameraRef.current.lastPointerY = event.global.y

        applyCamera()
      })

      app.stage.on("pointerup", () => {
        cameraRef.current.dragging = false
      })

      app.stage.on("pointerupoutside", () => {
        cameraRef.current.dragging = false
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

      if (appRef.current) {
        appRef.current.destroy(true, {
          children: true,
          texture: true,
        })
        appRef.current = null
      }

      worldLayerRef.current = null
      backgroundLayerRef.current = null
      landLayerRef.current = null
      structureLayerRef.current = null
      natureLayerRef.current = null
      zoneLayerRef.current = null
      stimulusLayerRef.current = null
      entityLayerRef.current = null
      foregroundLayerRef.current = null
      overlayRef.current = null
      lastStaticWorldKeyRef.current = null
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