/**
 * 当前文件负责：组装紫微动态层切换按钮组。
 */

import type { ActiveDynamicFlow } from "../../types"

import { ZiweiDynamicTabButton } from "./ZiweiDynamicTabButton"
import { ZIWEI_DYNAMIC_TAB_CONFIGS } from "./ziwei-dynamic-tabs-config"

export function ZiweiDynamicTabs({
  activeFlow,
  onChange
}: {
  activeFlow: ActiveDynamicFlow
  onChange: (flow: ActiveDynamicFlow) => void
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 14
      }}
    >
      {ZIWEI_DYNAMIC_TAB_CONFIGS.map((config) => {
        return (
          <ZiweiDynamicTabButton
            key={config.flow}
            flow={config.flow}
            label={config.label}
            description={config.description}
            active={activeFlow === config.flow}
            onClick={onChange}
          />
        )
      })}
    </div>
  )
}