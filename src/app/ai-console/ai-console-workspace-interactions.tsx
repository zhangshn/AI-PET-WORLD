"use client"

import { useEffect, useMemo, useState } from "react"
import { aiCapabilityDomains } from "./ai-console-catalog"
import { AiConsoleCapabilityLifecycleControl, AiConsoleRegistryVerificationControl, AiConsoleReviewAdjudicationControl, AiConsoleRuntimeReleaseControl, AiConsoleTaskRegistryControl, AiConsoleTrainingDesignControl, AiConsoleWorldControl } from "./ai-console-control-surface"
import type {
  AiConsoleWorkspaceDefinition,
  AiConsoleWorkspaceField,
} from "./ai-console-workspace-catalog"
import styles from "./ai-console-workspace.module.css"

const fieldTypeLabels = {
  identity: "身份字符串",
  enum: "受控枚举",
  timestamp_utc: "UTC时间",
  sha256: "SHA-256",
  integer: "整数",
  boolean: "布尔值",
  scalar: "标量",
  string: "字符串",
  structured: "结构数据",
} as const

const fieldRoleLabels = {
  primary_identity: "身份",
  relation: "关系",
  state: "状态",
  time: "时间",
  integrity: "完整性",
  measure: "度量",
  attribute: "属性",
} as const

const presentationLabels = {
  registry: "注册表视图",
  timeline: "时间线视图",
  topology: "拓扑视图",
  matrix: "矩阵视图",
  monitor: "监测视图",
  search: "检索视图",
  control_contract: "命令合同视图",
} as const

export type WorkspaceQueryPayload = {
  contractStatus?: string
  dataStatus?: "connected" | "partial" | "not_connected" | "unknown_or_stale"
  sourceIdentity?: string
  selectedView?: string
  result?: {
    records: readonly Record<string, unknown>[] | null
    total: number | null
    reasonCode: string | null
    unavailableFields?: readonly string[]
    provenance?: {
      observedAtUtc?: string
      trustStatus?: string
    }
  }
}

type EvidenceArtifactDetailPayload = {
  ok?: boolean
  integrityStatus?: string
  lookupMode?: string
  errorCode?: string
  record?: {
    evidenceId?: string
    evidenceType?: string
    mediaType?: string
    contentByteLength?: number
    contentSha256?: string
  }
  contentInspection?: {
    inspectionMode?: "verified_utf8_preview" | "binary_metadata_only"
    previewText?: string | null
    previewByteLength?: number
    previewTruncated?: boolean
    contentByteLength?: number
    contentSha256?: string
  }
}

function dataStatusLabel(dataStatus: WorkspaceQueryPayload["dataStatus"]): string {
  if (dataStatus === "connected") return "CONNECTED"
  if (dataStatus === "partial") return "PARTIAL"
  if (dataStatus === "unknown_or_stale") return "UNKNOWN / STALE"
  return "NOT CONNECTED"
}

function formatProjectionValue(fieldName: string, value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "number") {
    if (fieldName.toLowerCase().includes("utilization")) return `${value.toFixed(2)}%`
    if (fieldName.toLowerCase().includes("bytes")) {
      return `${(value / 1024 ** 3).toFixed(2)} GiB`
    }
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value)
  }
  if (fieldName.toLowerCase().includes("atutc") && typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.valueOf())) return parsed.toLocaleString("zh-CN", { hour12: false })
  }
  return String(value)
}

function ProjectionFooter({ activeArea, projection, workspace }: { activeArea: string; projection: WorkspaceQueryPayload | null; workspace: AiConsoleWorkspaceDefinition }) {
  return (
    <div className={styles.projectionFooter}>
      <span>当前视图 <strong>{activeArea}</strong></span>
      <span>预期实体 <code>{workspace.primaryEntity}</code></span>
      <span>呈现类型 <strong>{presentationLabels[workspace.presentation]}</strong></span>
      <span>记录状态 <strong>{dataStatusLabel(projection?.dataStatus)}{typeof projection?.result?.total === "number" ? ` · ${projection.result.total} RECORDS` : ""}</strong></span>
    </div>
  )
}

function ProjectionRecordDetails({
  fields,
  record,
}: {
  fields: readonly AiConsoleWorkspaceField[]
  record: Record<string, unknown> | undefined
}) {
  if (!record) return null
  return (
    <aside className={styles.recordDetails} aria-label="选中记录详情">
      <header><span>RECORD INSPECTOR</span><strong>选中记录</strong><small>只读详情</small></header>
      <dl>
        {fields.map((field) => (
          <div key={field.canonicalName}>
            <dt>{field.displayName}<code>{field.canonicalName}</code></dt>
            <dd>{formatProjectionValue(field.canonicalName, record[field.canonicalName])}</dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}

function EvidenceArtifactContentInspector({ evidenceId }: { evidenceId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading")
  const [detail, setDetail] = useState<EvidenceArtifactDetailPayload | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/ai-console/evidence/artifacts/${encodeURIComponent(evidenceId)}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json() as EvidenceArtifactDetailPayload
      const valid = response.ok
        && payload.ok === true
        && payload.integrityStatus === "verified"
        && payload.lookupMode === "exact_evidence_identity"
        && payload.record?.evidenceId === evidenceId
        && payload.record?.contentSha256 === payload.contentInspection?.contentSha256
      setDetail(payload)
      setState(valid ? "ready" : "failed")
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setDetail(null)
        setState("failed")
      }
    })
    return () => controller.abort()
  }, [evidenceId])

  const inspection = detail?.contentInspection
  return (
    <section className={styles.evidenceContentInspector} aria-label="证据原始内容只读检查">
      <header>
        <div><span>EXACT CONTENT INSPECTION</span><strong>原始内容只读检查</strong></div>
        <small className={state === "ready" ? styles.evidenceInspectionReady : state === "failed" ? styles.evidenceInspectionFailed : undefined}>{state === "loading" ? "VERIFYING" : state === "ready" ? "VERIFIED" : "FAILED CLOSED"}</small>
      </header>
      {state === "ready" && detail?.record ? (
        <>
          <div className={styles.evidenceInspectionFacts}>
            <div><span>证据类型</span><code>{detail.record.evidenceType}</code></div>
            <div><span>媒体类型</span><code>{detail.record.mediaType}</code></div>
            <div><span>原始字节</span><strong>{new Intl.NumberFormat("zh-CN").format(detail.record.contentByteLength ?? 0)}</strong></div>
            <div><span>检查模式</span><code>{inspection?.inspectionMode}</code></div>
          </div>
          {inspection?.inspectionMode === "verified_utf8_preview" ? (
            <div className={styles.evidenceTextPreview}>
              <div><span>VERIFIED UTF-8 PREVIEW</span><small>{inspection.previewTruncated ? `显示前 ${inspection.previewByteLength ?? 0} 字节 · 已截断` : "完整文本内容"}</small></div>
              <pre>{inspection.previewText ?? ""}</pre>
            </div>
          ) : (
            <div className={styles.evidenceBinaryNotice}><strong>二进制证据不在页面展开</strong><p>SQLite原始字节保存在正式索引中；当前只显示经过复核的长度、媒体类型和SHA-256，不下载、不解析、不执行。</p></div>
          )}
        </>
      ) : state === "failed" ? (
        <div className={styles.evidenceBinaryNotice}><strong>证据详情失败关闭</strong><p>{detail?.errorCode ?? "无法证明证据身份、原始字节与内容摘要一致。"}</p></div>
      ) : <div className={styles.evidenceInspectionLoading}>正在按完整证据身份复核索引记录与原始字节…</div>}
    </section>
  )
}

function EvidenceReconciliationInspector({ record }: { record: Record<string, unknown> }) {
  const identities = [
    ["命令回执证据", "receiptEvidenceId"],
    ["事件账本证据", "eventLedgerEvidenceId"],
    ["事件Head证据", "eventHeadEvidenceId"],
    ["事务SQLite证据", "transactionRegistryEvidenceId"],
  ] as const
  const statuses = [
    ["文件", "fileConsistencyStatus"],
    ["事件", "eventConsistencyStatus"],
    ["SQLite", "sqliteConsistencyStatus"],
    ["索引", "indexConsistencyStatus"],
    ["跨载体", "crossSurfaceStatus"],
  ] as const

  return (
    <section className={styles.reconciliationInspector} aria-label="跨载体正式证据核对">
      <header>
        <div><span>CROSS-SURFACE RECONCILIATION</span><strong>跨载体正式证据核对</strong></div>
        <small>READ-ONLY · FAIL-CLOSED</small>
      </header>
      <div className={styles.reconciliationContext}>
        <div><span>事务身份</span><code>{formatProjectionValue("transactionId", record.transactionId)}</code></div>
        <div><span>登记批次</span><code>{formatProjectionValue("registrationId", record.registrationId)}</code></div>
      </div>
      <div className={styles.reconciliationStatuses}>
        {statuses.map(([label, field]) => <div key={field}><span>{label}</span><strong>{formatProjectionValue(field, record[field])}</strong><code>{field}</code></div>)}
      </div>
      <div className={styles.reconciliationEvidenceIds}>
        {identities.map(([label, field]) => <div key={field}><span>{label}</span><code>{formatProjectionValue(field, record[field])}</code></div>)}
      </div>
    </section>
  )
}

function WorkspaceProjection({ activeArea, projection, workspace }: { activeArea: string; projection: WorkspaceQueryPayload | null; workspace: AiConsoleWorkspaceDefinition }) {
  let visibleFields = workspace.fields.slice(0, workspace.presentation === "monitor" ? 6 : 4)
  if (workspace.moduleSlug === "evidence" && workspace.slug === "capsules") {
    const fieldNamesByView: Record<string, readonly string[]> = {
      "任务目标": ["capsuleId", "taskId", "taskGoal", "terminalStatus"],
      "输入与能力": ["capsuleId", "capabilityDomain", "capabilityVersionId", "inputEvidenceSetId"],
      "执行摘要": ["capsuleId", "executionId", "executionSummary", "terminalEventId"],
      "终态与边界": ["capsuleId", "terminalStatus", "policyBoundaryReportId", "terminalAtUtc"],
    }
    visibleFields = (fieldNamesByView[activeArea] ?? fieldNamesByView["任务目标"]).map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
  }
  if (workspace.moduleSlug === "capabilities") {
    const capabilityFieldNames: Record<string, readonly string[]> = {
      candidates: ["capabilityVersionId", "capabilityDomain", "modelIdentity", "candidateStatus"],
      qualification: ["qualificationResultId", "qualificationGateId", "capabilityVersionId", "qualificationStatus"],
      releases: ["capabilityReleaseIdentity", "capabilityDomain", "capabilityVersionId", "releaseStatus"],
      migration: ["migrationAssessmentId", "capabilityDomain", "currentMaturityLevel", "machineAcceptanceStatus"],
    }
    const fieldNames = capabilityFieldNames[workspace.slug]
    if (fieldNames) visibleFields = fieldNames.map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
  }
  if (workspace.moduleSlug === "training") {
    const trainingFieldNames: Record<string, readonly string[]> = {
      models: ["modelStructureId", "modelFamily", "capabilityDomain", "modelStructureStatus"],
      plans: ["trainingPlanId", "modelStructureId", "capabilityDomain", "planStatus"],
    }
    const fieldNames = trainingFieldNames[workspace.slug]
    if (fieldNames) visibleFields = fieldNames.map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
  }
  if (workspace.moduleSlug === "runtime") {
    const runtimeFieldNames: Record<string, readonly string[]> = {
      candidates: ["runtimeFrameCandidateIdentity", "capabilityDomain", "worldId", "candidateStatus"],
      frames: ["runtimeFrameIdentity", "worldId", "tick", "runtimeFrameStatus"],
      world: ["worldStateRevisionId", "worldId", "activeRuntimeFrameIdentity", "publishControlStatus", "visualUpdateStatus", "worldRevision"],
    }
    const fieldNames = runtimeFieldNames[workspace.slug]
    if (fieldNames) visibleFields = fieldNames.map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
  }
  const firstRecord = projection?.result?.records?.[0]
  const projectionRecords = useMemo(() => projection?.result?.records ?? [], [projection?.result?.records])
  const [recordQuery, setRecordQuery] = useState("")
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0)
  const normalizedRecordQuery = recordQuery.trim().toLocaleLowerCase("zh-CN")
  const filteredProjectionRecords = useMemo(() => projectionRecords.filter((record) => {
    if (!normalizedRecordQuery) return true
    return Object.values(record).some((value) => formatProjectionValue("search", value).toLocaleLowerCase("zh-CN").includes(normalizedRecordQuery))
  }), [normalizedRecordQuery, projectionRecords])
  const selectedRecord = filteredProjectionRecords[selectedRecordIndex] ?? filteredProjectionRecords[0]
  const isConnectedEmpty = projection?.dataStatus === "connected" && projection.result?.total === 0

  if (workspace.moduleSlug === "capabilities" && workspace.slug === "domains") {
    return (
      <div className={styles.capabilityDirectoryProjection}>
        <div className={styles.projectionCaption}><span>CAPABILITY DOMAIN REGISTRY</span><strong>能力域正式目录</strong><small>{activeArea} · 产品结构事实</small></div>
        <div className={styles.capabilityDomainTable}>
          {aiCapabilityDomains.map((domain) => (
            <div key={domain.id}>
              <code>{domain.id}</code>
              <strong>{domain.name}</strong>
              <span className={domain.status === "current" ? styles.domainCurrent : styles.domainReserved}>{domain.status === "current" ? "当前能力域" : "未来预留"}</span>
              <p>{domain.description}</p>
              <small>{domain.modalities.join(" · ")}</small>
            </div>
          ))}
        </div>
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  if (workspace.presentation === "timeline") {
    const timelineIdentity = visibleFields[0]?.canonicalName ?? "identity"
    return (
      <div className={styles.timelineProjection}>
        <div className={styles.projectionCaption}><span>EVENT SEQUENCE</span><strong>{activeArea}</strong><small>{projectionRecords.length > 0 ? `${projectionRecords.length} 条受信事件` : isConnectedEmpty ? "正式登记已连接 · 当前0条" : "按权威事件序号排序"}</small></div>
        {projectionRecords.length > 0 ? (
          <>
            <div className={styles.timelineRecordList}>
              {projectionRecords.slice(0, 12).map((record, index) => (
                <button className={selectedRecordIndex === index ? styles.timelineRecordActive : styles.timelineRecord} key={String(record[timelineIdentity] ?? index)} onClick={() => setSelectedRecordIndex(index)} type="button">
                  <span>{String(index + 1).padStart(2, "0")}</span><i /><strong>{formatProjectionValue(timelineIdentity, record[timelineIdentity])}</strong><small>{visibleFields.slice(1, 3).map((field) => formatProjectionValue(field.canonicalName, record[field.canonicalName])).join(" · ")}</small>
                </button>
              ))}
            </div>
            <ProjectionRecordDetails fields={workspace.fields} record={selectedRecord} />
            {workspace.moduleSlug === "evidence" && workspace.slug === "artifacts" && activeArea === "正式证据记录" && typeof selectedRecord?.evidenceId === "string"
              ? <EvidenceArtifactContentInspector evidenceId={selectedRecord.evidenceId} key={selectedRecord.evidenceId} />
              : null}
          </>
        ) : (
          <div className={styles.timelineTrack}>
            {workspace.workAreas.map((area, index) => (
              <div className={area === activeArea ? styles.projectionNodeActive : undefined} key={area}><span>{String(index + 1).padStart(2, "0")}</span><i /><strong>{area}</strong><small>{area === activeArea ? "当前查看范围" : isConnectedEmpty ? "当前无登记事件" : "事件投影未接入"}</small></div>
            ))}
          </div>
        )}
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  if (workspace.presentation === "topology") {
    let topologyFields = workspace.fields.slice(0, 6)
    if (workspace.moduleSlug === "capabilities" && workspace.slug === "qualification") {
      topologyFields = ["qualificationGateId", "capabilityVersionId", "gateOrder", "qualificationStatus", "evidenceRequirement", "failureTerminal"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "capabilities" && workspace.slug === "migration") {
      topologyFields = ["capabilityId", "capabilityDomain", "currentMaturityLevel", "targetMaturityLevel", "machineAcceptanceStatus", "rollbackIdentity"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "evidence" && workspace.slug === "transactions" && activeArea === "文件与事件") {
      topologyFields = ["transactionId", "registrationId", "fileConsistencyStatus", "eventConsistencyStatus", "indexConsistencyStatus", "crossSurfaceStatus"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "evidence" && workspace.slug === "transactions" && activeArea === "SQLite一致性") {
      topologyFields = ["transactionId", "registrationId", "sqliteConsistencyStatus", "indexConsistencyStatus", "evidenceRecordCount", "crossSurfaceStatus"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    return (
      <div className={styles.topologyProjection}>
        <div className={styles.projectionCaption}><span>RELATION GRAPH</span><strong>{activeArea}</strong><small>{projectionRecords.length > 0 ? `${projectionRecords.length} 条受信关系` : isConnectedEmpty ? "正式登记已连接 · 当前0条" : "只表达合同关系，不推测运行状态"}</small></div>
        {projectionRecords.length > 0 ? (
          <div className={styles.topologyRecordList}>
            {projectionRecords.slice(0, 8).map((record, index) => (
              <article className={styles.topologyRecord} key={String(record[topologyFields[0]?.canonicalName ?? "identity"] ?? index)}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><strong>{formatProjectionValue(topologyFields[0]?.canonicalName ?? "identity", record[topologyFields[0]?.canonicalName ?? "identity"])}</strong></header>
                <div>
                  {topologyFields.slice(1).map((field) => <p key={field.canonicalName}><span>{field.displayName}</span><strong>{formatProjectionValue(field.canonicalName, record[field.canonicalName])}</strong></p>)}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.topologyTrack}>
            {workspace.workAreas.map((area, index) => (
              <div className={styles.topologyStep} key={area}>
                <div className={area === activeArea ? styles.projectionNodeActive : undefined}><span>{String(index + 1).padStart(2, "0")}</span><strong>{area}</strong><small>{area === activeArea ? "当前关系节点" : isConnectedEmpty ? "当前无登记关系" : "关系节点"}</small></div>
                {index < workspace.workAreas.length - 1 ? <i>→</i> : null}
              </div>
            ))}
          </div>
        )}
        {workspace.moduleSlug === "evidence" && workspace.slug === "transactions" && (activeArea === "文件与事件" || activeArea === "SQLite一致性") && firstRecord
          ? <EvidenceReconciliationInspector record={firstRecord} />
          : null}
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  if (workspace.presentation === "matrix") {
    let matrixFields = workspace.fields.slice(0, 4)
    const isPolicyReportView = workspace.moduleSlug === "evidence" && workspace.slug === "policies" && activeArea === "正式边界报告"
    if (isPolicyReportView) {
      matrixFields = ["policyBoundaryReportId", "boundaryCategory", "failureCode", "terminalStatus"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "evidence" && workspace.slug === "policies" && activeArea === "边界规则目录") {
      matrixFields = ["policyRuleId", "boundaryCategory", "prohibitedAction", "failureTerminal"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "evidence" && workspace.slug === "policies" && activeArea === "阻断分类") {
      matrixFields = ["policyRuleId", "boundaryCategory", "failureTerminal", "prohibitedAction"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "data" && workspace.slug === "conditions" && activeArea === "范围和缺失") {
      matrixFields = ["conditionSchemaId", "valueRange", "missingValueRule", "resamplingRule"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "data" && workspace.slug === "conditions" && activeArea === "对齐与重采样") {
      matrixFields = ["conditionSchemaId", "fieldOrChannelOrder", "resamplingRule", "missingValueRule"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "evidence" && workspace.slug === "policies" && activeArea === "影响与保持项") {
      matrixFields = ["policyRuleId", "boundaryCategory", "preservationRequirement", "prohibitedAction"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    if (workspace.moduleSlug === "evidence" && workspace.slug === "policies" && activeArea === "安全替代路线") {
      matrixFields = ["policyRuleId", "boundaryCategory", "safeAlternativeRequirement", "failureTerminal"].map((canonicalName) => workspace.fields.find((field) => field.canonicalName === canonicalName)).filter((field): field is AiConsoleWorkspaceField => Boolean(field))
    }
    const rowIdentityField = matrixFields[0]
    const rowIdentityName = rowIdentityField?.canonicalName ?? "identity"
    const matrixValueFields = matrixFields.slice(1, 4)
    return (
      <div className={styles.matrixProjection}>
        <div className={styles.projectionCaption}><span>{isPolicyReportView ? "FORMAL POLICY REPORTS" : "CONTRACT MATRIX"}</span><strong>{activeArea}</strong><small>{projectionRecords.length > 0 ? `显示 ${Math.min(24, projectionRecords.length)} / ${projection?.result?.total ?? projectionRecords.length} 条受信记录` : isConnectedEmpty ? "正式登记已连接 · 当前0条" : "行列语义来自统一目录"}</small></div>
        <div className={styles.matrixTable}>
          <div className={styles.matrixHeader}><span>{rowIdentityField?.displayName ?? "业务分区"}</span>{matrixValueFields.map((field) => <code key={field.canonicalName}>{field.displayName}</code>)}</div>
          {projectionRecords.length > 0
            ? projectionRecords.slice(0, 24).map((record, index) => (
                <div className={styles.matrixRow} key={`${String(record[rowIdentityName] ?? index)}`}>
                  <strong>{formatProjectionValue(rowIdentityName, record[rowIdentityName])}</strong>
                  {matrixValueFields.map((field) => <span key={field.canonicalName}>{formatProjectionValue(field.canonicalName, record[field.canonicalName])}</span>)}
                </div>
              ))
            : isPolicyReportView && isConnectedEmpty
              ? <div className={styles.matrixEmptyState}><strong>当前没有政策边界阻断报告</strong><span>正式报告索引已连接；仅实际失败关闭事件会在此登记。</span><code>CONNECTED · 0 RECORDS</code></div>
              : workspace.workAreas.map((area) => (
                <div className={`${styles.matrixRow} ${area === activeArea ? styles.matrixRowActive : ""}`} key={area}><strong>{area}</strong>{matrixValueFields.map((field) => <span key={field.canonicalName}>{area === activeArea ? "当前范围" : isConnectedEmpty ? "无登记记录" : "未接入"}</span>)}</div>
              ))}
        </div>
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  if (workspace.presentation === "monitor") {
    return (
      <div className={styles.monitorProjection}>
        <div className={styles.projectionCaption}><span>TRUSTED MONITOR</span><strong>{activeArea}</strong><small>{isConnectedEmpty ? "正式登记已连接 · 当前0条" : projection?.result?.provenance?.observedAtUtc ? `采样 ${formatProjectionValue("sampledAtUtc", projection.result.provenance.observedAtUtc)}` : "无机器采样时不显示数值"}</small></div>
        <div className={styles.monitorGrid}>
          {visibleFields.map((field) => (
            <div key={field.canonicalName}>
              <span>{field.displayName}</span>
              <strong>{formatProjectionValue(field.canonicalName, firstRecord?.[field.canonicalName])}</strong>
              <code>{field.canonicalName}</code>
              <small>{projection?.result?.unavailableFields?.includes(field.canonicalName) ? "适配器未接入" : isConnectedEmpty ? "受信正式登记 · 当前无记录" : projection?.dataStatus === "connected" || projection?.dataStatus === "partial" ? projection.result?.provenance?.trustStatus === "verified_registry" ? "受信正式登记" : "受信本机采样" : `${activeArea} · 数据未接入`}</small>
            </div>
          ))}
        </div>
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  if (workspace.presentation === "search") {
    return (
      <div className={styles.searchProjection}>
        <div className={styles.projectionCaption}><span>READ-ONLY DISCOVERY</span><strong>{activeArea}</strong><small>{projectionRecords.length > 0 ? `${filteredProjectionRecords.length} / ${projectionRecords.length} 条受信结果` : isConnectedEmpty ? "正式登记已连接 · 当前0条" : "查询服务接入后开放数据检索"}</small></div>
        <div className={styles.searchContract}>
          {visibleFields.slice(0, 3).map((field) => <div key={field.canonicalName}><span>{field.displayName}</span><code>{field.canonicalName}</code><small>{fieldTypeLabels[field.dataType]}</small></div>)}
        </div>
        {projectionRecords.length > 0 ? (
          <>
            <label className={styles.recordSearch}><span>结果内检索</span><input aria-label="在当前受信结果中检索" onChange={(event) => { setRecordQuery(event.target.value); setSelectedRecordIndex(0) }} placeholder="输入身份、状态或字段值" type="search" value={recordQuery} /><small>仅过滤当前API已返回记录</small></label>
            <div className={styles.searchResults}>
              {filteredProjectionRecords.slice(0, 24).map((record, index) => (
                <button className={selectedRecordIndex === index ? styles.searchResultActive : styles.searchResult} key={String(record[visibleFields[0]?.canonicalName ?? "identity"] ?? index)} onClick={() => setSelectedRecordIndex(index)} type="button">
                  <span>{String(index + 1).padStart(2, "0")}</span><strong>{formatProjectionValue(visibleFields[0]?.canonicalName ?? "identity", record[visibleFields[0]?.canonicalName ?? "identity"])}</strong><small>{visibleFields.slice(1, 3).map((field) => formatProjectionValue(field.canonicalName, record[field.canonicalName])).join(" · ")}</small>
                </button>
              ))}
              {filteredProjectionRecords.length === 0 ? <div className={styles.searchNoMatch}><strong>当前结果中没有匹配记录</strong><span>调整检索词，不会发起新的目录扫描。</span></div> : null}
            </div>
            <ProjectionRecordDetails fields={workspace.fields} record={selectedRecord} />
            {workspace.moduleSlug === "evidence" && workspace.slug === "artifacts" && activeArea === "正式证据记录" && typeof selectedRecord?.evidenceId === "string"
              ? <EvidenceArtifactContentInspector evidenceId={selectedRecord.evidenceId} key={selectedRecord.evidenceId} />
              : null}
          </>
        ) : <div className={styles.searchEmpty}><span>0</span><strong>{isConnectedEmpty ? `${activeArea}当前无登记记录` : `${activeArea}结果区未连接`}</strong><p>{isConnectedEmpty ? "新平台正式索引已连接；当前没有符合该范围的登记记录。" : "当前可切换检索范围，但不执行数据查询，也不将目录扫描结果冒充正式记录。"}</p></div>}
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  if (workspace.presentation === "control_contract") {
    const commandSteps = ["目标与命令", "修订与幂等", "状态转换复核", "结果证据"]
    const activeStepIndex = Math.max(0, workspace.workAreas.indexOf(activeArea)) % commandSteps.length
    return (
      <div className={styles.controlProjection}>
        <div className={styles.projectionCaption}><span>SAFE COMMAND PIPELINE</span><strong>{activeArea}</strong><small>仅登记了执行器身份的命令提供本地入口</small></div>
        <div className={styles.commandPipeline}>
          {commandSteps.map((step, index) => (
            <div className={index === activeStepIndex ? styles.projectionNodeActive : undefined} key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong><code>{workspace.fields[index]?.canonicalName ?? workspace.stateContract.canonicalField}</code><small>{index === 3 ? "保存不可变结果" : "服务端复核"}</small></div>
          ))}
        </div>
        <div className={styles.commandCatalog} aria-label="允许命令目录">
          {projectionRecords.map((record) => (
            <article key={String(record.commandDefinitionId)}>
              <header><code>{formatProjectionValue("commandType", record.commandType)}</code><span>{formatProjectionValue("requiredRole", record.requiredRole)}</span></header>
              <strong>{formatProjectionValue("targetType", record.targetType)}</strong>
              <dl>
                <div><dt>验证规则</dt><dd>{formatProjectionValue("validationRuleSetId", record.validationRuleSetId)}</dd></div>
                <div><dt>参数Schema</dt><dd>{formatProjectionValue("parameterSchemaId", record.parameterSchemaId)}</dd></div>
                <div><dt>安全边界</dt><dd>{formatProjectionValue("safetyBoundary", record.safetyBoundary)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
        <div className={styles.commandDisabled}><span>COMMAND VALIDATION CONTRACT</span><strong>{workspace.slug === "tasks" ? "3 SAFE COMMANDS READY" : workspace.slug === "capabilities" ? "4 SAFE COMMANDS READY" : workspace.slug === "training" ? "2 SAFE COMMANDS READY" : workspace.slug === "reviews" ? "3 SAFE COMMANDS READY" : workspace.slug === "world" ? "7 SAFE COMMANDS READY" : "READY · EXECUTOR DISABLED"}</strong><p>{workspace.slug === "tasks" ? "仅任务登记、未启动任务优先级和取消已接入；启动任务与队列调度保持禁用。" : workspace.slug === "capabilities" ? "候选、顺序资格结果、非活动发布登记和完整资格发布激活已接入；停用、回退与迁移裁决保持禁用。" : workspace.slug === "training" ? "仅不可变模型结构与非活动训练计划登记已接入；训练启动、暂停、恢复、停止和资源窗口保持禁用。" : workspace.slug === "reviews" ? "主登记核验、冻结审核合同和机器观测终态登记已接入；主动验证、审核重跑、投影重建与证据改写保持禁用。" : workspace.slug === "world" ? "Frame候选、正式未消费Frame、消费、发布暂停/恢复、合法回退和视觉冻结已接入；全部只写新平台登记库，不写旧世界或WorldFacts。" : "允许命令、角色、参数与安全规则已接入；执行器身份未登记，因此不提交命令、不调用进程，也不修改训练或Runtime状态。"}</p></div>
        {workspace.slug === "tasks" ? <AiConsoleTaskRegistryControl /> : null}
        {workspace.slug === "capabilities" ? <AiConsoleCapabilityLifecycleControl /> : null}
        {workspace.slug === "capabilities" ? <AiConsoleRuntimeReleaseControl mode="activation" /> : null}
        {workspace.slug === "training" ? <AiConsoleTrainingDesignControl /> : null}
        {workspace.slug === "reviews" ? <AiConsoleRegistryVerificationControl /> : null}
        {workspace.slug === "reviews" ? <AiConsoleReviewAdjudicationControl /> : null}
        {workspace.slug === "world" ? <AiConsoleRuntimeReleaseControl mode="runtime" /> : null}
        {workspace.slug === "world" ? <AiConsoleWorldControl /> : null}
        <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
      </div>
    )
  }

  return (
    <div className={styles.registryProjection}>
      <div className={styles.projectionCaption}><span>ENTITY REGISTRY</span><strong>{activeArea}</strong><small>{projectionRecords.length > 0 ? `显示 ${Math.min(24, projectionRecords.length)} / ${projection?.result?.total ?? projectionRecords.length} 条受信记录` : isConnectedEmpty ? "正式登记已连接 · 当前0条" : "记录按正式身份与登记修订组织"}</small></div>
      <div className={styles.registryTable}>
        <div className={styles.registryHeader}>{visibleFields.map((field) => <span key={field.canonicalName}>{field.displayName}<code>{field.canonicalName}</code></span>)}</div>
        {projectionRecords.length > 0
          ? projectionRecords.slice(0, 24).map((record, index) => (
              <button className={selectedRecordIndex === index ? styles.registryRowActive : styles.registryRow} key={String(record[visibleFields[0]?.canonicalName ?? "identity"] ?? index)} onClick={() => setSelectedRecordIndex(index)} type="button">
                {visibleFields.map((field) => <span key={field.canonicalName}>{formatProjectionValue(field.canonicalName, record[field.canonicalName])}</span>)}
              </button>
            ))
          : <div className={styles.registryEmpty}><span>{isConnectedEmpty ? "TRUSTED REGISTRY EMPTY" : "NO TRUSTED PROJECTION"}</span><strong>{isConnectedEmpty ? `${activeArea}当前无登记记录` : `${activeArea}等待受信记录`}</strong><p>{isConnectedEmpty ? "新平台正式索引已通过身份、修订和SHA-256校验。" : "列结构已经固定，当前不创建演示行。"}</p></div>}
      </div>
      <ProjectionRecordDetails fields={workspace.fields} record={selectedRecord} />
      <ProjectionFooter activeArea={activeArea} projection={projection} workspace={workspace} />
    </div>
  )
}

export function AiConsoleWorkspaceWorkbench({ initialProjection, workspace }: { initialProjection?: WorkspaceQueryPayload; workspace: AiConsoleWorkspaceDefinition }) {
  const [activeArea, setActiveArea] = useState(workspace.workAreas[0] ?? "默认视图")
  const [contractState, setContractState] = useState<"connecting" | "ready" | "rejected">(initialProjection ? "ready" : "connecting")
  const [projection, setProjection] = useState<WorkspaceQueryPayload | null>(initialProjection ?? null)

  useEffect(() => {
    const controller = new AbortController()
    const endpoint = `/api/ai-console/workspaces/${workspace.moduleSlug}/${workspace.slug}?view=${encodeURIComponent(activeArea)}`
    const isDynamicCurrentView = (workspace.moduleSlug === "tasks" && (workspace.slug === "current" || workspace.slug === "active"))
      || (workspace.moduleSlug === "training" && workspace.slug === "overview")
      || (workspace.moduleSlug === "reviews" && (workspace.slug === "current" || workspace.slug === "results" || workspace.slug === "evidence"))
    let requestInFlight = false
    const refreshProjection = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal })
        const payload = await response.json() as WorkspaceQueryPayload
        const isValid = response.ok
          && payload.contractStatus === "ready"
          && ["connected", "partial", "not_connected", "unknown_or_stale"].includes(payload.dataStatus ?? "")
          && payload.selectedView === activeArea
        setProjection(isValid ? payload : null)
        setContractState(isValid ? "ready" : "rejected")
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setContractState("rejected")
        }
      } finally {
        requestInFlight = false
      }
    }
    void refreshProjection()
    const intervalId = isDynamicCurrentView
      ? window.setInterval(() => { void refreshProjection() }, 1_000)
      : null
    return () => {
      controller.abort()
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [activeArea, workspace.moduleSlug, workspace.slug])

  return (
    <div className={styles.projectionSurface}>
      <div className={styles.viewDirectory} aria-label="工作区视图目录">
        <span>WORKSPACE VIEWS</span>
        {workspace.workAreas.map((area, index) => (
          <button
            aria-pressed={area === activeArea}
            className={area === activeArea ? styles.viewItemActive : styles.viewItem}
            key={area}
            onClick={() => {
              setContractState("connecting")
              setProjection(null)
              setActiveArea(area)
            }}
            type="button"
          >
            <small>{String(index + 1).padStart(2, "0")}</small><strong>{area}</strong><i>{area === activeArea ? "当前视图" : "切换视图"}</i>
          </button>
        ))}
      </div>
      <div className={styles.projectionStage} aria-live="polite">
        <div className={styles.viewSessionBar}>
          <span>当前业务视图</span><strong>{activeArea}</strong>
          <span>页面查询合同</span><small className={contractState === "ready" ? styles.contractReady : contractState === "rejected" ? styles.contractRejected : undefined}>{contractState === "ready" ? "CONNECTED" : contractState === "rejected" ? "REJECTED" : "CONNECTING"}</small>
        </div>
        {projection?.result?.reasonCode ? (
          <div className={projection.dataStatus === "unknown_or_stale" ? styles.projectionWarning : styles.projectionNotice}>
            <span>{projection.dataStatus === "unknown_or_stale" ? "TRUTH CONFLICT" : projection.dataStatus === "not_connected" ? "DATA SOURCE NOT CONNECTED" : "BOUNDED PROJECTION"}</span>
            <strong>{projection.dataStatus === "unknown_or_stale" ? "权威记录未通过当前合同校验" : projection.dataStatus === "not_connected" ? "当前视图没有权威记录来源" : "当前仅显示已验证字段"}</strong>
            <code>{projection.result.reasonCode}</code>
          </div>
        ) : null}
        <WorkspaceProjection activeArea={activeArea} key={activeArea} projection={projection} workspace={workspace} />
      </div>
    </div>
  )
}

export function AiConsoleFieldDictionary({ fields }: { fields: readonly AiConsoleWorkspaceField[] }) {
  const [query, setQuery] = useState("")
  const [role, setRole] = useState<"all" | AiConsoleWorkspaceField["role"]>("all")
  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN")
  const visibleFields = useMemo(() => fields.filter((field) => {
    const matchesQuery = !normalizedQuery || `${field.canonicalName} ${field.displayName}`.toLocaleLowerCase("zh-CN").includes(normalizedQuery)
    return matchesQuery && (role === "all" || field.role === role)
  }), [fields, normalizedQuery, role])

  return (
    <>
      <div className={styles.fieldTools}>
        <label><span>字段检索</span><input aria-label="按机器字段或中文名称检索" onChange={(event) => setQuery(event.target.value)} placeholder="输入字段名" type="search" value={query} /></label>
        <label><span>字段角色</span><select aria-label="按字段角色筛选" onChange={(event) => setRole(event.target.value as typeof role)} value={role}><option value="all">全部角色</option>{Object.entries(fieldRoleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div><strong>{visibleFields.length}</strong><span>/ {fields.length} 个字段</span><small>仅过滤当前页面字典</small></div>
      </div>
      <div className={styles.fieldTable}>
        <div className={styles.fieldHeader}><span>机器字段</span><span>显示名称</span><span>数据类型</span><span>字段角色</span><span>空值</span></div>
        {visibleFields.map((field) => (
          <div className={styles.fieldRow} key={field.canonicalName}>
            <code>{field.canonicalName}</code><strong>{field.displayName}</strong><span>{fieldTypeLabels[field.dataType]}</span><span>{fieldRoleLabels[field.role]}</span><small>{field.nullable ? "允许" : "禁止"}</small>
          </div>
        ))}
        {visibleFields.length === 0 ? <div className={styles.fieldEmpty}><strong>没有匹配字段</strong><span>调整字段名称或角色筛选条件。</span></div> : null}
      </div>
    </>
  )
}
