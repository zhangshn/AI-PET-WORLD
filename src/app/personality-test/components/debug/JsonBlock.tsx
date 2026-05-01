/**
 * 当前文件负责：展示格式化 JSON 调试内容。
 */

export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        background: "#f7f7f7",
        padding: 12,
        borderRadius: 8,
        overflowX: "auto",
        fontSize: 12
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}