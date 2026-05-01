/**
 * 当前文件负责：提供 personality-test 页面统一的区块间距。
 */

export function SectionSpacer({
  height = 20
}: {
  height?: number
}) {
  return <div style={{ height }} />
}