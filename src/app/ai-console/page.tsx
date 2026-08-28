import type { Metadata } from "next"
import Link from "next/link"
import {
  aiCapabilityDomains,
  aiConsoleFrameworks,
  aiConsoleModules,
  type AiConsoleModule,
} from "./ai-console-catalog"
import styles from "./page.module.css"

export const metadata: Metadata = {
  title: "AI控制台 | AI-PET-WORLD",
  description: "AI-PET-WORLD本地自研AI平台的统一任务、能力、训练、审核、运行与安全控制入口。",
}

const dictionaryFoundations = [
  ["IDENTITY", "身份体系", "任务、能力、执行、模型、数据、审核、证据与发布身份分离"],
  ["SCHEMA", "字段标准", "名称、类型、空值、来源、写入器与版本统一定义"],
  ["STATE", "状态体系", "能力、执行、训练、审核、Runtime与命令状态分层"],
  ["EVIDENCE", "证据体系", "不可变文件、事件账本与SQLite事务共同证明事实"],
] as const

const operatingLoop = ["任务", "能力", "训练", "验证与审核", "发布与运行", "证据与回退"] as const

function ModuleFrame({ consoleModule }: { consoleModule: AiConsoleModule }) {
  const titleId = `module-frame-${consoleModule.slug}-title`

  return (
    <article
      aria-labelledby={titleId}
      className={consoleModule.plane === "control" ? styles.moduleFrameControl : styles.moduleFrame}
    >
      <header className={styles.moduleFrameHeader}>
        <span>{consoleModule.id}</span>
        <div><strong id={titleId}>{consoleModule.title}</strong><small>{consoleModule.englishTitle}</small></div>
        <em>{consoleModule.plane === "control" ? "CONTROL" : "OBSERVE"}</em>
      </header>
      <p>{consoleModule.summary}</p>
      <nav className={styles.moduleFrameDirectory} aria-label={`${consoleModule.title}二级目录`}>
        {consoleModule.secondaryModules.map((workspace) => (
          <Link href={workspace.route ?? `${consoleModule.route}/${workspace.slug}`} key={workspace.slug}>{workspace.title}</Link>
        ))}
      </nav>
      <footer className={styles.moduleFrameFooter}>
        <code>{consoleModule.route}</code>
        <Link href={consoleModule.route}>进入模块总览 <span>→</span></Link>
      </footer>
    </article>
  )
}

export default function AiConsolePage() {
  const currentCapability = aiCapabilityDomains.find((domain) => domain.status === "current")

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#ai-console-main">跳到主工作区</a>
      <div className={styles.applicationShell}>
        <header className={styles.topbar}>
          <div className={styles.brandBlock}>
            <div className={styles.brandMark} aria-hidden="true"><span>APW</span><i /></div>
            <div><p>AI-PET-WORLD / LOCAL INTELLIGENCE</p><h1>AI控制台</h1></div>
          </div>
          <div className={styles.topbarContext} role="group" aria-label="平台运行上下文">
            <div><span>运行模式</span><strong><i className={styles.liveDot} />本地自主闭环</strong></div>
            <div><span>当前能力域</span><strong>{currentCapability?.name}</strong></div>
            <div><span>平台目录</span><strong>4 Frame / 10 模块</strong></div>
            <div><span>权威数据</span><strong className={styles.mutedValue}>等待受信投影</strong></div>
          </div>
        </header>

        <div className={styles.workspace}>
          <aside className={styles.navigation}>
            <div className={styles.navigationHeader}>
              <span>PLATFORM DIRECTORY</span><strong>平台一级目录</strong><p>四个业务Frame组织十个专业模块。</p>
            </div>
            <nav aria-label="AI控制台一级导航">
              {aiConsoleFrameworks.map((framework) => (
                <section className={framework.plane === "control" ? styles.navGroupControl : styles.navGroup} key={framework.id}>
                  <div className={styles.navGroupHeading}><span>{framework.id.replace("FRAME-", "F")}</span><strong>{framework.title}</strong></div>
                  {framework.moduleSlugs.map((slug) => {
                    const consoleModule = aiConsoleModules.find((candidate) => candidate.slug === slug)
                    if (!consoleModule) return null
                    return (
                      <Link className={consoleModule.plane === "control" ? styles.navItemControl : styles.navItem} href={consoleModule.route} key={consoleModule.id}>
                        <span className={styles.navModuleId}>{consoleModule.id}</span><span className={styles.navModuleName}>{consoleModule.title}</span><span className={styles.navArrow}>›</span>
                      </Link>
                    )
                  })}
                </section>
              ))}
            </nav>
            <div className={styles.navigationBoundary}><span>平台边界</span><strong>新控制台独立运行</strong><p>仅使用本平台路由、组件与查询合同。</p></div>
          </aside>

          <main className={styles.mainWorkspace} id="ai-console-main" tabIndex={-1}>
            <div className={styles.breadcrumbBar}>
              <div><strong>AI控制台</strong><i>/</i><span>平台运行架构</span></div><code>/ai-console</code>
            </div>

            <header className={styles.platformOverviewHeader}>
              <div><p>PLATFORM OPERATING ARCHITECTURE</p><h2>本地AI运行与治理总控台</h2></div>
              <p>外层业务Frame固定平台责任，内层Module Frame承载一级模块；一级模块再进入独立二级工作页。</p>
            </header>

            <div className={styles.platformStats}>
              <div><span>业务框架</span><strong>04</strong><small>OUTER FRAMES</small></div>
              <div><span>一级模块</span><strong>10</strong><small>MODULE FRAMES</small></div>
              <div><span>二级页面</span><strong>52</strong><small>WORKSPACES</small></div>
              <div><span>页面查询合同</span><strong>READY</strong><small>DATA NOT CONNECTED</small></div>
            </div>

            <div className={styles.operatingLoop} aria-label="平台主闭环">
              {operatingLoop.map((step, index) => <span key={step}><strong>{String(index + 1).padStart(2, "0")}</strong>{step}{index < operatingLoop.length - 1 ? <i>→</i> : null}</span>)}
            </div>

            <div className={styles.frameworkStack}>
              {aiConsoleFrameworks.map((framework) => {
                const modules = framework.moduleSlugs.map((slug) => aiConsoleModules.find((candidate) => candidate.slug === slug)).filter((module): module is AiConsoleModule => Boolean(module))
                return (
                  <section
                    aria-labelledby={`framework-${framework.id}-title`}
                    className={framework.plane === "control" ? styles.frameworkFrameControl : styles.frameworkFrame}
                    key={framework.id}
                  >
                    <header className={styles.frameworkFrameHeader}>
                      <div className={styles.frameworkFrameIndex}>{framework.id.replace("FRAME-", "")}</div>
                      <div><span>{framework.id}</span><h2 id={`framework-${framework.id}-title`}>{framework.title}</h2><small>{framework.englishTitle}</small></div>
                      <p>{framework.summary}</p>
                      <strong>{framework.plane === "control" ? "CONTROL PLANE" : `${modules.length} MODULES`}</strong>
                    </header>
                    <div className={modules.length === 1 ? styles.frameworkFrameBodySingle : styles.frameworkFrameBody}>
                      {modules.map((consoleModule) => <ModuleFrame key={consoleModule.id} consoleModule={consoleModule} />)}
                    </div>
                  </section>
                )
              })}
            </div>
          </main>

          <aside className={styles.contextRail} aria-label="平台上下文">
            <section className={styles.currentDomain}>
              <div className={styles.railHeading}><span>ACTIVE CAPABILITY DOMAIN</span><strong>当前能力域</strong></div>
              <div className={styles.currentDomainBody}>
                <div><span className={styles.domainMonogram}>AIP</span><span className={styles.currentLabel}><i />CURRENT</span></div>
                <h2>{currentCapability?.name}</h2><p>{currentCapability?.description}</p>
                <div className={styles.modalityList}>{currentCapability?.modalities.map((modality) => <span key={modality}>{modality}</span>)}</div>
              </div>
            </section>
            <section className={styles.railSection}>
              <div className={styles.railHeading}><span>CAPABILITY EXPANSION</span><strong>统一能力扩展</strong></div>
              <div className={styles.capabilityList}>{aiCapabilityDomains.filter((domain) => domain.status === "reserved").map((domain) => <div key={domain.id}><span>{domain.name}</span><small>接口预留</small></div>)}</div>
            </section>
            <section className={styles.railSection}>
              <div className={styles.railHeading}><span>UNIFIED DATA FOUNDATION</span><strong>统一数据基础</strong></div>
              <div className={styles.dictionaryList}>{dictionaryFoundations.map(([code, title, description], index) => <div key={code}><span>{String(index + 1).padStart(2, "0")}</span><p><strong>{title}</strong>{description}</p><code>{code}</code></div>)}</div>
            </section>
            <section className={styles.runtimeBoundary}><span>LOCAL RUNTIME BOUNDARY</span><strong>本地独立运行</strong><p>页面关闭不影响本地任务、训练、验证、审核、发布和证据保存。</p><div><span>控制台</span><i>→</i><span>本地服务</span><i>→</i><span>数据库与证据</span></div></section>
          </aside>
        </div>

        <footer className={styles.statusbar}>
          <span><i className={styles.liveDot} />专业平台壳已接入</span><span>4个外层Frame / 10个内层Module Frame</span><span>权威数据：未接入</span><span>控制副作用：无</span><code>/ai-console</code>
        </footer>
      </div>
    </div>
  )
}
