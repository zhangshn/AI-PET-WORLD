/**
 * 当前文件负责：展示紫微人格摘要列表。
 */

export function ZiweiSummaryList({
  summaries
}: {
  summaries: string[]
}) {
  return (
    <div style={{ marginTop: 10, lineHeight: 1.8 }}>
      {summaries.length > 0 ? (
        summaries.map((summary) => {
          return <div key={summary}>- {summary}</div>
        })
      ) : (
        <div style={{ color: "#999" }}>暂无摘要</div>
      )}
    </div>
  )
}