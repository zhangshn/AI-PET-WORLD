/**
 * 当前文件负责：组装八字大运、流年、流月、流日、流时动态面板。
 */

import { InfoCard } from "../common/InfoCard"

import { BaziDaYunTable } from "./BaziDaYunTable"
import { BaziFlowTable } from "./BaziFlowTable"
import { BaziRuntimeDebugTable } from "./BaziRuntimeDebugTable"
import { BaziRuntimeEnergyTable } from "./BaziRuntimeEnergyTable"
import { BaziRuntimeModifierTable } from "./BaziRuntimeModifierTable"

import type { BaziRuntimeProfileView } from "./bazi-runtime-panel-types"

export function BaziRuntimePanel({
  runtimeProfile
}: {
  runtimeProfile: BaziRuntimeProfileView
}) {
  return (
    <InfoCard title="☯ 八字动态运势">
      <BaziDaYunTable runtimeProfile={runtimeProfile} />
      <BaziFlowTable runtimeProfile={runtimeProfile} />
      <BaziRuntimeEnergyTable runtimeProfile={runtimeProfile} />
      <BaziRuntimeModifierTable runtimeProfile={runtimeProfile} />
      <BaziRuntimeDebugTable runtimeProfile={runtimeProfile} />
    </InfoCard>
  )
}