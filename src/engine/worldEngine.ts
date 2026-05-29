/**
 * 当前文件职责：保留旧 worldEngine 导出名的惰性兼容门面。
 *
 * 当前 M11 主链路不通过该文件推进 runtime tick。
 */

export type WorldState = {
  tick: number
  status: "legacy_inert"
}

type LegacySnapshotSource = string

const INERT_WORLD_STATE: WorldState = {
  tick: 0,
  status: "legacy_inert",
}

export class WorldEngine {
  onUpdate?: (state: WorldState) => void

  initialize(): void {
    this.emitUpdate()
  }

  start(): void {
    this.emitUpdate()
  }

  stop(): void {
    return
  }

  update(): void {
    this.emitUpdate()
  }

  createSaveSnapshot(source: LegacySnapshotSource) {
    return {
      version: "legacy_inert_world_engine",
      saveVersion: "legacy_inert_world_engine",
      savedAt: Date.now(),
      lastPlayedAt: Date.now(),
      tick: 0,
      source,
      tags: [source, "legacy_inert_world_engine"],
    }
  }

  restoreFromSnapshot(): void {
    this.emitUpdate()
  }

  addOfflineCatchupReport(): void {
    return
  }

  getTick(): number {
    return 0
  }

  getTime(): null {
    return null
  }

  getFormattedTime(): string {
    return "legacy-inert"
  }

  getPet(): null {
    return null
  }

  getButler(): null {
    return null
  }

  setButlerProfile(): void {
    this.emitUpdate()
  }

  getButlerProfile(): null {
    return null
  }

  getHome(): null {
    return null
  }

  getAdoptionState(): null {
    return null
  }

  getEvents(): [] {
    return []
  }

  getWorldStimuli(): [] {
    return []
  }

  getEcology(): null {
    return null
  }

  getWorldRuntime(): null {
    return null
  }

  getWorldProgression(): null {
    return null
  }

  reset(): void {
    this.emitUpdate()
  }

  private emitUpdate(): void {
    this.onUpdate?.(INERT_WORLD_STATE)
  }
}

export const worldEngine = new WorldEngine()
