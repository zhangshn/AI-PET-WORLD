import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { aiCapabilityDomains, aiConsoleFrameworks, aiConsoleModules } from "./ai-console-catalog"
import {
  getAiConsoleWorkspace,
  getAiConsoleWorkspaces,
  getAiConsoleModuleRelationContract,
  getAiConsoleWorkspaceNeighbors,
  validateAiConsoleWorkspaceCatalog,
} from "./ai-console-workspace-catalog"
import { AiConsoleFieldDictionary, AiConsoleWorkspaceWorkbench, type WorkspaceQueryPayload } from "./ai-console-workspace-interactions"
import { getAiConsoleCapabilityProjectionAvailability } from "@/server/ai-console/capability-projection"
import { getAiConsoleControlProjectionAvailability } from "@/server/ai-console/control-projection"
import { getAiConsoleDataProjectionAvailability } from "@/server/ai-console/data-projection"
import { getAiConsoleEvidenceProjectionAvailability } from "@/server/ai-console/evidence-projection"
import { getAiConsoleRuntimeProjectionAvailability } from "@/server/ai-console/runtime-projection"
import { getAiConsolePrimaryRegistryProjectionAvailability } from "@/server/ai-console/registry-projection"
import { getAiConsoleSystemProjectionAvailability } from "@/server/ai-console/system-projection"
import { getAiConsoleTaskProjectionAvailability } from "@/server/ai-console/task-projection"
import { queryAiConsoleWorkspaceProjection } from "@/server/ai-console/workspace-projection"
import styles from "./ai-console-workspace.module.css"
import themeStyles from "./ai-console-theme.module.css"
import { AiConsoleLiveStatus } from "./ai-console-live-status"
import { AiConsoleObservabilityPanel } from "./ai-console-observability-panel"

type AiConsoleWorkspacePageProps = {
  moduleSlug: string
  workspaceSlug?: string
}

const presentationLabels = {
  registry: "注册表视图",
  timeline: "时间线视图",
  topology: "拓扑视图",
  matrix: "矩阵视图",
  monitor: "监测视图",
  search: "检索视图",
  control_contract: "命令合同视图",
} as const

export function createAiConsoleWorkspaceMetadata(moduleSlug: string, workspaceSlug?: string): Metadata {
  const consoleModule = aiConsoleModules.find((candidate) => candidate.slug === moduleSlug)
  const selectedWorkspace = workspaceSlug ? getAiConsoleWorkspace(moduleSlug, workspaceSlug) : undefined
  const title = selectedWorkspace?.title ?? consoleModule?.title ?? "AI控制台"
  const description = selectedWorkspace?.summary ?? consoleModule?.summary ?? "AI-PET-WORLD本地自研AI平台工作页。"

  return {
    title: `${title} | AI控制台`,
    description,
  }
}

export async function AiConsoleWorkspacePage({ moduleSlug, workspaceSlug }: AiConsoleWorkspacePageProps) {
  const consoleModule = aiConsoleModules.find((candidate) => candidate.slug === moduleSlug)
  if (!consoleModule) notFound()

  const framework = aiConsoleFrameworks.find((candidate) => candidate.moduleSlugs.includes(moduleSlug))
  if (!framework) notFound()

  const workspaces = getAiConsoleWorkspaces(moduleSlug)
  const relationContract = getAiConsoleModuleRelationContract(moduleSlug)
  if (!relationContract) notFound()
  const selectedWorkspace = workspaceSlug ? getAiConsoleWorkspace(moduleSlug, workspaceSlug) : undefined
  if (workspaceSlug && !selectedWorkspace) notFound()
  const workspaceNeighbors = selectedWorkspace ? getAiConsoleWorkspaceNeighbors(moduleSlug, selectedWorkspace.slug) : undefined
  const catalogIntegrity = validateAiConsoleWorkspaceCatalog()

  const currentCapability = aiCapabilityDomains.find((domain) => domain.status === "current")
  const pageTitle = selectedWorkspace?.title ?? consoleModule.title
  const pageSummary = selectedWorkspace?.summary ?? consoleModule.summary
  const configuredProjectionAvailability = selectedWorkspace?.moduleSlug === "system"
    ? getAiConsoleSystemProjectionAvailability(selectedWorkspace.slug)
    : selectedWorkspace?.moduleSlug === "capabilities"
      ? getAiConsoleCapabilityProjectionAvailability(selectedWorkspace.slug)
    : selectedWorkspace?.moduleSlug === "data"
      ? getAiConsoleDataProjectionAvailability(selectedWorkspace.slug)
    : selectedWorkspace?.moduleSlug === "tasks"
      ? getAiConsoleTaskProjectionAvailability(selectedWorkspace.slug)
    : selectedWorkspace?.moduleSlug === "runtime"
      ? getAiConsoleRuntimeProjectionAvailability(selectedWorkspace.slug)
    : selectedWorkspace?.moduleSlug === "evidence"
      ? getAiConsoleEvidenceProjectionAvailability(selectedWorkspace.slug)
    : selectedWorkspace && ["training", "reviews", "archive"].includes(selectedWorkspace.moduleSlug)
      ? getAiConsolePrimaryRegistryProjectionAvailability(selectedWorkspace.moduleSlug)
    : selectedWorkspace?.moduleSlug === "control"
      ? getAiConsoleControlProjectionAvailability(selectedWorkspace.slug)
    : "not_connected"
  const initialProjectionResult = selectedWorkspace
    ? await queryAiConsoleWorkspaceProjection(selectedWorkspace, selectedWorkspace.workAreas[0] ?? "default")
    : null
  const projectionAvailability = initialProjectionResult?.dataStatus ?? configuredProjectionAvailability
  const projectionLabel = projectionAvailability === "connected"
    ? "已连接"
    : projectionAvailability === "partial"
      ? "部分连接"
      : projectionAvailability === "unknown_or_stale"
        ? "未知或失效"
        : "未接入"
  const projectionMachineLabel = projectionAvailability === "connected"
    ? "CONNECTED"
    : projectionAvailability === "partial"
      ? "PARTIAL"
      : projectionAvailability === "unknown_or_stale"
        ? "UNKNOWN / STALE"
        : "NOT CONNECTED"
  const boundedControlWorkspaces = ["tasks", "capabilities", "training", "reviews", "world"]
  const writeCapabilityLabel = selectedWorkspace?.moduleSlug === "control"
    ? boundedControlWorkspaces.includes(selectedWorkspace.slug) ? "BOUNDED" : "DISABLED"
    : "NOT APPLICABLE"
  const initialProjection: WorkspaceQueryPayload | undefined = selectedWorkspace && initialProjectionResult
    ? {
        contractStatus: "ready",
        dataStatus: initialProjectionResult.dataStatus,
        sourceIdentity: initialProjectionResult.sourceIdentity,
        selectedView: selectedWorkspace.workAreas[0] ?? undefined,
        result: initialProjectionResult,
      }
    : undefined

  return (
    <div className={`${styles.page} ${themeStyles.theme}`} data-framework={framework.id} data-module={consoleModule.slug}>
      <a className={styles.skipLink} href="#ai-console-workspace-main">跳到主工作区</a>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link className={styles.brand} href="/ai-console">
            <span>APW</span>
            <div>
              <small>LOCAL AI PLATFORM</small>
              <strong>AI控制台</strong>
            </div>
          </Link>
          <div className={styles.topContext} role="group" aria-label="当前页面运行上下文">
            <div><span>运行模式</span><strong><i />本地自主闭环</strong></div>
            <div><span>能力域</span><strong>{currentCapability?.name}</strong></div>
            <div><span>页面层级</span><strong>{selectedWorkspace ? "二级工作页" : "一级模块总览"}</strong></div>
          </div>
          <Link className={styles.consoleHome} href="/ai-console">返回平台总览 <span>↗</span></Link>
        </header>

        <div className={styles.body}>
          <aside className={styles.primaryNavigation}>
            <div className={styles.navHeading}>
              <span>PRIMARY MODULES</span>
              <strong>一级模块</strong>
            </div>
            <nav aria-label="AI控制台一级模块">
              {aiConsoleFrameworks.map((navFramework) => (
                <section data-framework={navFramework.id} key={navFramework.id}>
                  <p>{navFramework.id} · {navFramework.title}</p>
                  {navFramework.moduleSlugs.map((slug) => {
                    const navModule = aiConsoleModules.find((candidate) => candidate.slug === slug)
                    if (!navModule) return null
                    return (
                      <Link
                        className={slug === moduleSlug ? styles.primaryLinkActive : styles.primaryLink}
                        data-module={navModule.slug}
                        href={navModule.route}
                        key={navModule.id}
                        aria-current={slug === moduleSlug ? "page" : undefined}
                      >
                        <span>{navModule.id}</span>
                        <strong>{navModule.title}</strong>
                        <i>›</i>
                      </Link>
                    )
                  })}
                </section>
              ))}
            </nav>
            <div className={styles.readonlyNotice}>
              <span>页面边界</span>
              <strong>{consoleModule.plane === "control" ? "控制合同展示" : "只读观察投影"}</strong>
              <p>{consoleModule.plane === "control" ? "仅已登记的有界执行器提供控件。" : "只读显示受信来源，不改变运行状态。"}</p>
            </div>
          </aside>

          <main className={styles.workspace} id="ai-console-workspace-main" tabIndex={-1}>
            <nav className={styles.breadcrumbs} aria-label="面包屑">
              <Link href="/ai-console">AI控制台</Link><i>/</i>
              <Link href={consoleModule.route}>{consoleModule.title}</Link>
              {selectedWorkspace ? <><i>/</i><strong>{selectedWorkspace.title}</strong></> : null}
            </nav>

            <header className={consoleModule.plane === "control" ? styles.heroControl : styles.hero}>
              <div className={styles.heroCode}>{consoleModule.id}</div>
              <div>
                <p>{selectedWorkspace?.englishTitle ?? consoleModule.englishTitle}</p>
                <h1>{pageTitle}</h1>
                <span>{pageSummary}</span>
              </div>
              <div className={styles.heroState}>
                <span>{consoleModule.plane === "control" ? "CONTROL PLANE" : "OBSERVATION PLANE"}</span>
                <strong>{selectedWorkspace ? "结构内容已接入" : `${workspaces.length} 个二级工作页`}</strong>
                <small>权威数据：{projectionLabel}</small>
              </div>
            </header>

            <nav className={styles.secondaryNavigation} aria-label={`${consoleModule.title}二级目录`}>
              <Link className={!selectedWorkspace ? styles.secondaryLinkActive : styles.secondaryLink} href={consoleModule.route}>模块总览</Link>
              {workspaces.map((workspaceDefinition) => (
                <Link
                  className={workspaceDefinition.slug === workspaceSlug ? styles.secondaryLinkActive : styles.secondaryLink}
                  href={workspaceDefinition.route}
                  key={workspaceDefinition.slug}
                  aria-current={workspaceDefinition.slug === workspaceSlug ? "page" : undefined}
                >
                  {workspaceDefinition.title}
                </Link>
              ))}
            </nav>

            {selectedWorkspace ? (
              <div className={styles.contentWorkspace}>
                <nav className={styles.sectionNavigator} aria-label="当前工作页内容导航">
                  <a href="#workspace-projection">业务投影</a><a href="#record-contract">记录合同</a><a href="#field-dictionary">字段字典</a><a href="#integration-status">接入状态</a>
                </nav>
                <section className={styles.operatingPanel} id="workspace-projection">
                  <div className={styles.sectionHeading}><span>01</span><div><p>BUSINESS PROJECTION WORKSPACE</p><h2>业务投影工作区</h2></div><small>READ-ONLY CONTRACT</small></div>
                  <div className={styles.queryContract} aria-label="查询合同摘要">
                    {selectedWorkspace.fields.slice(0, 3).map((field) => (
                      <div key={field.canonicalName}>
                        <span>{field.displayName}</span>
                        <code>{field.canonicalName}</code>
                        <small>{field.dataType}</small>
                      </div>
                    ))}
                    <div className={styles.queryState}><span>数据投影</span><strong>{projectionLabel}</strong><small>{projectionAvailability === "not_connected" ? "不显示模拟记录" : projectionAvailability === "unknown_or_stale" ? "记录校验失败关闭" : "只读受信投影"}</small></div>
                  </div>
                  {selectedWorkspace.moduleSlug === "system" && selectedWorkspace.slug === "resources" ? <AiConsoleObservabilityPanel mode="resources" /> : null}
                  {selectedWorkspace.moduleSlug === "system" && selectedWorkspace.slug === "telemetry" ? <AiConsoleObservabilityPanel mode="telemetry" /> : null}
                  {selectedWorkspace.moduleSlug === "training" && selectedWorkspace.slug === "overview" ? <AiConsoleObservabilityPanel mode="training" /> : null}
                  <AiConsoleWorkspaceWorkbench initialProjection={initialProjection} workspace={selectedWorkspace} />
                </section>

                <div className={styles.contractDeck} id="record-contract">
                  <section className={styles.definitionPanel}>
                    <div className={styles.sectionHeading}><span>02</span><div><p>RECORD DEFINITION</p><h2>记录与详情结构</h2></div></div>
                    <dl className={styles.definitionList}>
                      <div><dt>主要实体</dt><dd><code>{selectedWorkspace.primaryEntity}</code></dd></div>
                      <div><dt>权威来源</dt><dd>{selectedWorkspace.sourceOfTruth}</dd></div>
                      <div><dt>更新语义</dt><dd><code>{selectedWorkspace.updateSemantics}</code></dd></div>
                      <div><dt>稳定路由</dt><dd><code>{selectedWorkspace.route}</code></dd></div>
                    </dl>
                  </section>

                  <section className={styles.statePanel}>
                    <div className={styles.sectionHeading}><span>03</span><div><p>STATE & TRUTH CONTRACT</p><h2>状态与事实裁决</h2></div></div>
                    <div className={styles.stateFlow} aria-label="状态事实链">
                      <div><span>01</span><strong>权威登记</strong></div><i>→</i>
                      <div><span>02</span><strong>查询投影</strong></div><i>→</i>
                      <div><span>03</span><strong>工作页</strong></div>
                    </div>
                    <dl className={styles.stateContract}>
                      <div><dt>状态机</dt><dd><code>{selectedWorkspace.stateContract.stateMachine}</code></dd></div>
                      <div><dt>状态字段</dt><dd><code>{selectedWorkspace.stateContract.canonicalField}</code></dd></div>
                      <div><dt>裁决规则</dt><dd>{selectedWorkspace.stateContract.truthRule}</dd></div>
                    </dl>
                  </section>
                </div>

                <section className={styles.fieldPanel} id="field-dictionary">
                  <div className={styles.sectionHeading}><span>04</span><div><p>UNIFIED DATA DICTIONARY</p><h2>字段与详情面板合同</h2></div><small>{selectedWorkspace.fields.length} FIELDS</small></div>
                  <AiConsoleFieldDictionary fields={selectedWorkspace.fields} />
                </section>

                <section className={styles.assurancePanel} id="integration-status">
                  <div className={styles.boundaryBox}><span>STRICT BOUNDARY</span><p>{selectedWorkspace.boundary}</p></div>
                  <div className={styles.integrationPanel}>
                    <div><span>页面与视图结构</span><strong>READY</strong></div>
                    <div><span>统一字段合同</span><strong>READY</strong></div>
                    <div><span>页面查询合同</span><strong>READY</strong></div>
                    <div><span>权威数据投影</span><strong>{projectionMachineLabel}</strong></div>
                    <div><span>写入能力</span><strong>{writeCapabilityLabel}</strong></div>
                  </div>
                </section>
              </div>
            ) : (
              <section className={styles.moduleOverview}>
                <div className={styles.sectionHeading}><span>01</span><div><p>MODULE OPERATING CONTRACT</p><h2>模块运行合同与二级目录</h2></div><small>{workspaces.length} WORKSPACES</small></div>
                <div className={styles.moduleRelationFlow} aria-label="模块上下游业务链">
                  <div><span>UPSTREAM</span><strong>{relationContract.upstream}</strong></div>
                  <i>→</i>
                  <div className={styles.moduleRelationCurrent}><span>{consoleModule.id}</span><strong>{consoleModule.title}</strong></div>
                  <i>→</i>
                  <div><span>DOWNSTREAM</span><strong>{relationContract.downstream}</strong></div>
                </div>
                <div className={styles.moduleContractGrid}>
                  <div><span>平台平面</span><strong>{consoleModule.plane === "control" ? "人工控制平面" : "只读观察平面"}</strong></div>
                  <div><span>证据绑定</span><strong>{relationContract.evidenceBinding}</strong></div>
                  <div><span>运行规则</span><strong>{relationContract.operatingRule}</strong></div>
                  <div><span>目录完整性</span><strong>{catalogIntegrity.ok ? `52 / 52 · VERIFIED` : "CONTRACT ERROR"}</strong></div>
                </div>
                <div className={styles.overviewDirectoryHeader}><span>#</span><span>工作页与业务职责</span><span>专业呈现</span><span>主要实体</span><span>更新语义</span><span /></div>
                <div className={styles.overviewDirectory}>
                  {workspaces.map((workspaceDefinition, index) => (
                    <Link href={workspaceDefinition.route} key={workspaceDefinition.slug}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{workspaceDefinition.title}</strong><p>{workspaceDefinition.summary}</p></div>
                      <small>{presentationLabels[workspaceDefinition.presentation]}</small>
                      <code>{workspaceDefinition.primaryEntity}</code>
                      <em>{workspaceDefinition.updateSemantics}</em>
                      <i>→</i>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </main>

          <aside className={styles.contextRail} aria-label="当前模块上下文">
            <section>
              <div className={styles.railHeading}><span>MODULE CONTEXT</span><strong>当前模块</strong></div>
              <div className={styles.moduleContext}>
                <span>{consoleModule.id}</span><h2>{consoleModule.title}</h2><p>{consoleModule.summary}</p>
                <code>{consoleModule.route}</code>
              </div>
            </section>
            <section>
              <div className={styles.railHeading}><span>SIBLING WORKSPACES</span><strong>同级目录</strong></div>
              <div className={styles.siblingList}>
                {workspaces.map((workspaceDefinition) => (
                  <Link className={workspaceDefinition.slug === workspaceSlug ? styles.siblingActive : undefined} href={workspaceDefinition.route} key={workspaceDefinition.slug}>
                    <span>{workspaceDefinition.title}</span><i>›</i>
                  </Link>
                ))}
              </div>
            </section>
            {selectedWorkspace && workspaceNeighbors ? (
              <section>
                <div className={styles.railHeading}><span>WORKSPACE FLOW</span><strong>页面上下游</strong></div>
                <div className={styles.workspaceFlowRail}>
                  <div><span>上游页面</span>{workspaceNeighbors.previous ? <Link href={workspaceNeighbors.previous.route}>{workspaceNeighbors.previous.title}<i>↗</i></Link> : <strong>{relationContract.upstream}</strong>}</div>
                  <div className={styles.workspaceFlowCurrent}><span>当前页面</span><strong>{selectedWorkspace.title}</strong></div>
                  <div><span>下游页面</span>{workspaceNeighbors.next ? <Link href={workspaceNeighbors.next.route}>{workspaceNeighbors.next.title}<i>↗</i></Link> : <strong>{relationContract.downstream}</strong>}</div>
                  <p><span>证据绑定</span>{relationContract.evidenceBinding}</p>
                </div>
              </section>
            ) : null}
            <section className={styles.localBoundary}>
              <span>LOCAL INDEPENDENCE</span><strong>本地独立运行</strong>
              <p>页面关闭不影响本地任务、训练、验证、审核、发布与证据保存。</p>
            </section>
          </aside>
        </div>

        <AiConsoleLiveStatus />
        <footer className={styles.statusbar}>
          <span><i />二级内容层已接入</span><span>权威数据：{projectionLabel}</span><span>控制副作用：无</span><code>{selectedWorkspace?.route ?? consoleModule.route}</code>
        </footer>
      </div>
    </div>
  )
}
