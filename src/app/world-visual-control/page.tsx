"use client"

import { useMemo, useState } from "react"

type VisualAction = {
  id: string
  title: string
  description: string
  method: "GET" | "POST"
  path: string
  group: "准备" | "生成" | "审核" | "展示"
}

type ActionResult = {
  ok: boolean
  httpStatus: number
  receivedAt: string
  body: unknown
}

const ACTIONS: VisualAction[] = [
  {
    id: "provider",
    title: "Provider 状态",
    description: "查看当前图像生成入口、本地模型 endpoint 与接入契约。",
    method: "GET",
    path: "/api/world/visual/provider",
    group: "准备",
  },
  {
    id: "provider-health",
    title: "本地模型 Health",
    description: "检查本地图像模型服务是否可访问、是否声明基础能力。",
    method: "GET",
    path: "/api/world/visual/provider-health",
    group: "准备",
  },
  {
    id: "provider-dry-run",
    title: "本地模型 Dry-run",
    description: "发送真实 AiImageGenerationRequest.body，确认模型理解契约。",
    method: "GET",
    path: "/api/world/visual/provider-dry-run",
    group: "准备",
  },
  {
    id: "status",
    title: "视觉链路状态",
    description: "查看 candidate、fixPlan、ApprovedFrame、Runtime Render gate 和下一步。",
    method: "GET",
    path: "/api/world/visual/status",
    group: "准备",
  },
  {
    id: "integrity",
    title: "完整性自检",
    description: "检查有没有绕过 VisualJudge、ApprovedFrame、responseContract 等硬闸门。",
    method: "GET",
    path: "/api/world/visual/integrity",
    group: "准备",
  },
  {
    id: "generate",
    title: "生成隐藏 Candidate",
    description: "调用本地图像模型或授权导入，保存隐藏 AiImageCandidate。",
    method: "POST",
    path: "/api/world/visual/generate",
    group: "生成",
  },
  {
    id: "candidate",
    title: "读取 Candidate",
    description: "查看隐藏候选图、来源链、URL 审计、生成请求与 VisualFixHints。",
    method: "GET",
    path: "/api/world/visual/candidate",
    group: "生成",
  },
  {
    id: "judge",
    title: "执行 VisualJudge",
    description: "审核隐藏候选图，失败则生成 VisualFixPlan，通过则生成 ApprovedFrame。",
    method: "POST",
    path: "/api/world/visual/judge",
    group: "审核",
  },
  {
    id: "fix-plan",
    title: "读取 VisualFixPlan",
    description: "查看失败原因与下一次生成需要回流的修复提示。",
    method: "GET",
    path: "/api/world/visual/fix-plan",
    group: "审核",
  },
  {
    id: "approved",
    title: "读取 ApprovedFrame",
    description: "查看最终可展示帧、来源链、图片 sha256 与 URL 审计。",
    method: "GET",
    path: "/api/world/visual/approved",
    group: "展示",
  },
]

export default function WorldVisualControlPage() {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, ActionResult>>({})
  const [selectedResultId, setSelectedResultId] = useState<string>("status")

  const groupedActions = useMemo(() => {
    return ACTIONS.reduce<Record<VisualAction["group"], VisualAction[]>>(
      (groups, action) => {
        groups[action.group].push(action)
        return groups
      },
      {
        准备: [],
        生成: [],
        审核: [],
        展示: [],
      }
    )
  }, [])

  const selectedResult = results[selectedResultId] ?? null

  async function runAction(action: VisualAction) {
    setLoadingId(action.id)
    setSelectedResultId(action.id)

    try {
      const response = await fetch(action.path, {
        method: action.method,
        headers: {
          accept: "application/json",
        },
        cache: "no-store",
      })
      const contentType = response.headers.get("content-type")
      const body = contentType?.includes("application/json")
        ? await response.json()
        : await response.text()

      setResults((current) => ({
        ...current,
        [action.id]: {
          ok: response.ok,
          httpStatus: response.status,
          receivedAt: new Date().toISOString(),
          body,
        },
      }))
    } catch (error) {
      setResults((current) => ({
        ...current,
        [action.id]: {
          ok: false,
          httpStatus: 0,
          receivedAt: new Date().toISOString(),
          body: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
      }))
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div style={styles.brand}>AI-PET-WORLD</div>
        <h1 style={styles.title}>World Visual Control</h1>
        <p style={styles.subtitle}>
          开发侧视觉链路控制台。这里不会展示 Candidate 作为正式世界画面；玩家正式入口仍然只读 ApprovedFrame。
        </p>
        <div style={styles.links}>
          <a href="/world" style={styles.link}>
            打开 /world
          </a>
          <a href="/create-world" style={styles.linkSecondary}>
            创建世界
          </a>
        </div>
      </section>

      <section style={styles.grid}>
        <div style={styles.actionsPanel}>
          {Object.entries(groupedActions).map(([groupName, actions]) => (
            <section key={groupName} style={styles.group}>
              <h2 style={styles.groupTitle}>{groupName}</h2>
              <div style={styles.actionList}>
                {actions.map((action) => {
                  const result = results[action.id]
                  const isLoading = loadingId === action.id

                  return (
                    <button
                      key={action.id}
                      disabled={Boolean(loadingId)}
                      onClick={() => runAction(action)}
                      style={{
                        ...styles.actionButton,
                        ...(selectedResultId === action.id
                          ? styles.actionButtonSelected
                          : null),
                      }}
                      type="button"
                    >
                      <span style={styles.actionTop}>
                        <span>{action.title}</span>
                        <span style={styles.method}>{action.method}</span>
                      </span>
                      <span style={styles.actionPath}>{action.path}</span>
                      <span style={styles.actionDescription}>
                        {action.description}
                      </span>
                      <span style={styles.actionStatus}>
                        {isLoading
                          ? "运行中..."
                          : result
                            ? result.ok
                              ? `OK ${result.httpStatus}`
                              : `失败 ${result.httpStatus}`
                            : "未运行"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <section style={styles.resultPanel}>
          <div style={styles.resultHeader}>
            <div>
              <h2 style={styles.resultTitle}>结果</h2>
              <p style={styles.resultMeta}>
                {selectedResult
                  ? `${selectedResultId} · HTTP ${selectedResult.httpStatus} · ${selectedResult.receivedAt}`
                  : "选择左侧动作后显示响应。"}
              </p>
            </div>
            <button
              disabled={!selectedResult}
              onClick={() => {
                if (!selectedResult) return
                void navigator.clipboard.writeText(
                  JSON.stringify(selectedResult.body, null, 2)
                )
              }}
              style={styles.copyButton}
              type="button"
            >
              复制 JSON
            </button>
          </div>

          <pre style={styles.pre}>
            {selectedResult
              ? JSON.stringify(selectedResult.body, null, 2)
              : "暂无结果"}
          </pre>
        </section>
      </section>
    </main>
  )
}

const styles = {
  page: {
    background:
      "radial-gradient(circle at 50% 0%, #1f3a2d 0, #0b1512 52%, #040807 100%)",
    color: "#dcefdc",
    minHeight: "100vh",
    padding: 24,
  },
  header: {
    border: "1px solid rgba(220, 239, 220, 0.12)",
    background: "rgba(5, 12, 10, 0.72)",
    margin: "0 auto 18px",
    maxWidth: 1280,
    padding: 22,
  },
  brand: {
    color: "rgba(220, 239, 220, 0.62)",
    fontSize: 12,
    letterSpacing: "0.16em",
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 1.1,
    margin: "0 0 10px",
  },
  subtitle: {
    color: "rgba(220, 239, 220, 0.72)",
    lineHeight: 1.7,
    margin: 0,
    maxWidth: 860,
  },
  links: {
    display: "flex",
    gap: 10,
    marginTop: 18,
  },
  link: {
    background: "#c8df8f",
    color: "#101a12",
    fontWeight: 700,
    padding: "10px 14px",
    textDecoration: "none",
  },
  linkSecondary: {
    border: "1px solid rgba(220, 239, 220, 0.22)",
    color: "#dcefdc",
    fontWeight: 700,
    padding: "10px 14px",
    textDecoration: "none",
  },
  grid: {
    display: "grid",
    gap: 18,
    gridTemplateColumns: "minmax(340px, 430px) minmax(0, 1fr)",
    margin: "0 auto",
    maxWidth: 1280,
  },
  actionsPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  group: {
    background: "rgba(5, 12, 10, 0.72)",
    border: "1px solid rgba(220, 239, 220, 0.12)",
    padding: 14,
  },
  groupTitle: {
    color: "rgba(220, 239, 220, 0.68)",
    fontSize: 13,
    letterSpacing: "0.12em",
    margin: "0 0 10px",
  },
  actionList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  actionButton: {
    background: "rgba(255, 255, 255, 0.045)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#dcefdc",
    cursor: "pointer",
    padding: 12,
    textAlign: "left",
  },
  actionButtonSelected: {
    border: "1px solid rgba(200, 223, 143, 0.72)",
  },
  actionTop: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  method: {
    color: "#c8df8f",
    fontSize: 11,
    fontWeight: 700,
  },
  actionPath: {
    color: "rgba(220, 239, 220, 0.48)",
    display: "block",
    fontSize: 11,
    marginBottom: 8,
  },
  actionDescription: {
    color: "rgba(220, 239, 220, 0.72)",
    display: "block",
    fontSize: 13,
    lineHeight: 1.5,
  },
  actionStatus: {
    color: "rgba(200, 223, 143, 0.88)",
    display: "block",
    fontSize: 12,
    marginTop: 8,
  },
  resultPanel: {
    background: "rgba(5, 12, 10, 0.72)",
    border: "1px solid rgba(220, 239, 220, 0.12)",
    minWidth: 0,
    padding: 16,
  },
  resultHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 18,
    margin: "0 0 4px",
  },
  resultMeta: {
    color: "rgba(220, 239, 220, 0.54)",
    fontSize: 12,
    margin: 0,
  },
  copyButton: {
    background: "transparent",
    border: "1px solid rgba(220, 239, 220, 0.22)",
    color: "#dcefdc",
    cursor: "pointer",
    padding: "8px 10px",
  },
  pre: {
    background: "rgba(0, 0, 0, 0.36)",
    color: "#dcefdc",
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
    maxHeight: "calc(100vh - 240px)",
    overflow: "auto",
    padding: 14,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
} as const