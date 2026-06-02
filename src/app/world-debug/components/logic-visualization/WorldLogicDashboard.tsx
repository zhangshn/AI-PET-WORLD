/**
 * 当前文件负责组合世界逻辑可视化仪表盘。
 */

import type { WorldVisualizationModel } from "@/world/visualization/world-visualization-schema"

import { ButlerTaskFlow } from "./ButlerTaskFlow"
import { ConstructionTimeline } from "./ConstructionTimeline"
import { LogicVisualizationControls } from "./LogicVisualizationControls"
import { LOGIC_VISUALIZATION_STYLES as styles } from "./logic-visualization-styles"
import { MapDiffEventLog } from "./MapDiffEventLog"
import { PetNeedPanel } from "./PetNeedPanel"
import { WorldStateDashboard } from "./WorldStateDashboard"
import { ZoneGraphView } from "./ZoneGraphView"

type WorldLogicDashboardProps = {
  model: WorldVisualizationModel
  onManualAdvanceConstruction: () => void
  onResetLocalHomeMap: () => void
}

export function WorldLogicDashboard({
  model,
  onManualAdvanceConstruction,
  onResetLocalHomeMap,
}: WorldLogicDashboardProps) {
  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>AI-PET-WORLD MVP｜自主家园运行中</h1>
          <p style={styles.subtitle}>
            当前 /world 已切换为逻辑驱动可视化界面。它展示世界运行、管家判断、
            建设计划、宠物需求和 MapDiff 变化，而不是像素地图展示图。
          </p>
        </div>
        <div style={styles.statusPill}>HomeMapState / ConstructionPlan / MapDiff</div>
      </header>

      <div style={styles.grid}>
        <div style={styles.column}>
          <WorldStateDashboard world={model.world} />
          <PetNeedPanel pet={model.pet} />
        </div>
        <div style={styles.column}>
          <ConstructionTimeline construction={model.construction} />
          <ZoneGraphView zones={model.zones} />
        </div>
        <div style={styles.column}>
          <ButlerTaskFlow butler={model.butler} />
          <MapDiffEventLog mapDiffs={model.mapDiffs} />
          <LogicVisualizationControls
            onManualAdvanceConstruction={onManualAdvanceConstruction}
            onResetLocalHomeMap={onResetLocalHomeMap}
          />
        </div>
      </div>
    </main>
  )
}
