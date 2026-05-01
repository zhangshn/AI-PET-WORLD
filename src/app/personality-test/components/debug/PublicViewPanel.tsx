/**
 * 当前文件负责：展示人格测试页公开视图调试面板。
 */

import { InfoCard } from "../common/InfoCard"
import { JsonBlock } from "./JsonBlock"

export function PublicViewPanel({
  publicView
}: {
  publicView: unknown
}) {
  return (
    <InfoCard title="🪟 公开展示视图">
      <JsonBlock value={publicView} />
    </InfoCard>
  )
}