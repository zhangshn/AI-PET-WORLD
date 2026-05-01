/**
 * 当前文件负责：提供 personality-test 第一屏主内容的左右布局。
 */

export function PersonalityTestMainGrid({
  left,
  right
}: {
  left: React.ReactNode
  right: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.65fr)",
        gap: 20,
        alignItems: "start"
      }}
    >
      {left}
      {right}
    </div>
  )
}