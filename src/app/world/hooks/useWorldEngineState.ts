/**
 * 当前文件职责：保留旧 world 状态 Hook 的兼容导出占位。
 */

export type WorldEngineViewState = {
  time: null
  pet: null
  butler: null
  home: null
  adoptionState: null
  events: []
  stimuli: []
  tick: 0
  ecology: null
  worldRuntime: null
  worldProgression: null
  mvpCheckReport: null
  showDeveloperPanel: false
  toggleDeveloperPanel: () => void
  setButlerProfile: () => void
}

export function useWorldEngineState(): WorldEngineViewState {
  return {
    time: null,
    pet: null,
    butler: null,
    home: null,
    adoptionState: null,
    events: [],
    stimuli: [],
    tick: 0,
    ecology: null,
    worldRuntime: null,
    worldProgression: null,
    mvpCheckReport: null,
    showDeveloperPanel: false,
    toggleDeveloperPanel: () => undefined,
    setButlerProfile: () => undefined,
  }
}
