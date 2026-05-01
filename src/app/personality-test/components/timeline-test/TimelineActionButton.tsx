/**
 * 当前文件负责：展示 Timeline 测试面板中的操作按钮。
 */

export function TimelineActionButton({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid #ccc",
        background: "#fff",
        cursor: "pointer"
      }}
    >
      {label}
    </button>
  )
}