'use client'
import { useEffect, useRef, useState } from 'react'
import { startHistoryPolling } from './ai-console-history-poll'
import { AiConsoleTrainingSummary } from './ai-console-training-summary'
import styles from './ai-console-training-history.module.css'

type Artifact = { artifactId: string; role: string; url: string | null; sampleId?: string; split?: string; arm?: string; seed?: number; inferenceMode?: string; sourceLabel?: string; epoch?: number | null; passed?: boolean; issueCodes?: string[]; logicalPath: string; sha256: string; byteLength?: number; optimizerSteps?: number; verificationStatus: string; previewStatus?: string }
type RegistryEvent = { eventSequence: number; registryRevision: number; transactionId: string; taskId: string; runId: string; action: string | null; recordedAtUtc: string | null; currentSha256: string; evidenceReferences: string[] }
type Run = { runId: string; recordId?: string; runKind: string; terminalStatus: string; sourceRevision: number; finishedAtUtc: string | null; recordedAtUtc?: string | null; registeredAtUtc?: string | null; independentReviewStatus?: string; independentReviewIssueCodes?: string[]; reviewStatusSource?: string; optimizerSteps?: number | null; resolution?: unknown; qualification?: unknown; artifacts?: Artifact[]; metrics?: unknown[]; checkpoints?: Artifact[]; events?: RegistryEvent[]; eventCoverage?: { scope: string; complete: boolean; gap: unknown } }
type Listing = { schemaVersion: string; dataStatus: string; reasonCode: string | null; sourceRevision: number; indexRevision?: number | null; observedAtUtc: string; records: Run[]; nextCursor: string | null; total: number | null; coverage: unknown }
type Detail = { schemaVersion: string; dataStatus: string; reasonCode: string | null; unavailableFields?: string[]; record: Run & { detailCoverage?: unknown } }
type Section = 'artifacts' | 'metrics' | 'events' | 'logs'
type SectionPage = { schemaVersion: string; dataStatus: string; reasonCode: string | null; record: Run; section: Section; items: unknown[]; knownItemCount: number; total: number | null; nextCursor: string | null; coverage: unknown }
const sectionLabels: Record<Section, string> = { artifacts: '图像与证据', metrics: '指标与观测', events: '登记事件', logs: '历史程序日志' }
const kindLabels: Record<string, string> = { decoder_binding_ab: '解码器绑定对照实验', timestep_ab: '时间步对照实验', rgb_head_adaptation: 'RGB输出分支适配实验', learning_capacity: '学习能力实验', interrupted_experiment: '已中断实验', registered_experiment: '已登记实验', bounded_endpoint_ab_experiment: '端点对照实验' }
function kindLabel(run: Run) {
  if (run.runKind === 'spatial_affine_controlled_smoke') return '空间仿射受控训练'
  if (run.runKind === 'independent_materialization') return '独立证据（未纳入已核验登记区间）'
  if (run.runKind === 'dry_single_world_bounded_training') return '单世界有界训练'
  if (['mvp_denoiser_stage0_training', 'mvp_native_rgb_stage0_training', 'formal_stage0_256x192_native_rgb_training', 'stage0_machine_review_closure'].includes(run.runKind)) return 'MVP 256×192 Stage0训练与机器审核'
  const registeredKinds: Record<string, string> = { bounded_timestep_ab_experiment: '时间步对照实验', bounded_decoder_binding_ab_experiment: '解码器绑定对照实验', bounded_rgb_head_adaptation_experiment: 'RGB输出分支适配实验', bounded_train_only_learning_capacity_experiment: '训练集学习能力实验', interrupted_training_terminal_registration: '已中断实验' }
  if (registeredKinds[run.runKind]) return registeredKinds[run.runKind]
  if (kindLabels[run.runKind]) return kindLabels[run.runKind]
  return run.runKind === 'unclassified' ? '已登记实验（类别未记录）' : '已登记实验'
}
function statusLabel(status: string) {
  if (status === 'independent_evidence_only') return '独立证据可查 · 登记链未证明'
  if (/fail|interrupt|error|blocked/i.test(status)) return '已失败或受阻 · 证据保留'
  if (/not.*qualif|not_visual|not.*qualified/i.test(status)) return '实验已完成 · 未获正式资格'
  if (/completed|executed/i.test(status)) return '执行已完成 · 资格以独立审核为准'
  return '已登记终态 · 查看原始结论'
}
function runStatusLabel(run: Run) {
  const qualification = run.qualification && typeof run.qualification === 'object' ? run.qualification as Record<string, unknown> : null
  const review = typeof qualification?.independentReviewStatus === 'string' ? qualification.independentReviewStatus : run.independentReviewStatus
  if (review && /fail|blocked|reject/i.test(review)) return '独立审核未通过 · 训练终态另列'
  if (review) return '独立审核已登记 · 正式资格另行裁决'
  return statusLabel(run.terminalStatus)
}
function reasonLabel(reason: string | null) {
  if (reason === 'history_spatial_affine_detail_partial') return '已展开历史训练指标、可用图像及权重信息；尚未记录的逐图关联或其他缺口见“内容覆盖与缺失项”。'
  const labels: Record<string, string> = { history_terminal_schema_unsupported: '此历史格式暂未展开图像与指标；终态证据和已核验登记事件仍可查看。', history_index_coverage_incomplete: '所选Run的图像与审核绑定已核验；独立历史索引仍在补齐其他范围，不能宣称全盘历史完整。', history_independent_only_records: '存在独立可核验的Run，但登记链未证明其历史事件；可查询其绑定证据，不能当作正式资格。', history_independent_review_not_indexed: '训练图像已核验，独立审核尚未被索引，不能推断审核通过。', history_output_association_not_recorded: '原图、登记图像、指标和权重元数据可查。旧结果没有逐图用途/样本/实验臂对应，不能按文件名猜配对。', history_detail_evidence_exceeds_limit: '结果证据超过8MiB安全读取上限。本页保留终态、登记事件和证据入口，不伪造缺失指标。', history_failed_before_artifact_registration: '此轮失败，未登记输出制品。可查看已绑定原图、失败结果和登记事件。', history_snapshot_missing: '较早历史快照缺失，仅展示连续核验通过的区间。', history_mvp_stage0_review_not_registered: '训练已完成，但当前登记链尚未绑定对应机器审核；仅显示已核验训练证据。', history_mvp_stage0_review_evidence_missing: '机器审核终态已登记，但候选图或报告证据不完整。' }
  if (reason === 'history_index_partial_sources') return '独立来源中有未支持或验证失败的条目；已核验记录仍可查，来源缺口见覆盖说明。'
  if (reason === 'history_independent_run_conflict') return '独立来源的同一Run绑定冲突；冲突项未并入可信记录。'
  if (reason === 'history_package_schema_unsupported' || reason === 'history_mvp_stage0_review_schema_unsupported') return '绑定证据可查，部分历史格式尚未适配；不把未支持内容解释为未保存。'
  if (reason === 'history_logs_not_indexed') return '历史程序日志尚未索引，不能用登记事件代替日志。'
  return reason ? labels[reason] ?? '部分证据暂不可用；请查看诊断代码与原始证据。' : '已核验详情；不代表训练资格或能力发布。'
}
function timeLabel(value: string | null | undefined) { return value ? `${new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）` : '未记录' }
function readableJson(value: unknown) { const text = JSON.stringify(value, null, 2) ?? '未记录'; const bytes = new TextEncoder().encode(text); return bytes.length > 64000 ? `${new TextDecoder().decode(bytes.subarray(0,64000))}\n[本项显示已截断，请查询绑定证据]` : text }
function MetricSummary({ metrics }: { metrics: unknown[] }) {
  return <><p>已返回 {metrics.length} 项指标，逐项独立展开；整表预览截断不影响下方每项读取。</p><table><thead><tr><th>样本／轮次</th><th>实验臂</th><th>种子</th><th>度量</th></tr></thead><tbody>{metrics.map((value, index) => {
    const row = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
    const label = row?.sampleId !== undefined ? `${String(row.sampleId)}${row.optimizerStep !== undefined ? ` · 第${String(row.optimizerStep)}步` : ''}` : row?.epoch !== undefined && row.epoch !== null ? `第 ${String(row.epoch)} 轮` : `指标项 ${index + 1}`
    return <tr key={index}><td>{label}</td><td>{String(row?.arm ?? '未绑定')}</td><td>{String(row?.seed ?? '未绑定')}</td><td><details><summary>{label}：查看本项实际度量</summary><pre>{readableJson(value)}</pre></details></td></tr>
  })}</tbody></table><details><summary>整表字段预览（有长度上限，完整已返回项请逐项展开）</summary><pre>{readableJson(metrics)}</pre></details></>
}
function EvidenceImage({ item }: { item: Artifact }) {
  const [failed, setFailed] = useState(false)
  const verdict = item.role === 'output' && item.passed !== undefined ? (item.passed ? '机器审核通过' : '机器审核未通过') : null
  return <figure><figcaption>{item.role === 'original' ? item.split === 'train' ? '训练原图' : '验证参考原图' : item.role === 'image' ? `材料化报告登记图像${item.sourceLabel ? ` · ${item.sourceLabel}` : '（逐图用途未记录）'}` : item.sourceLabel ? `本地模型实验图 · ${item.sourceLabel}` : '本地AI候选输出'} · {item.sampleId} {item.arm} {item.epoch != null ? `第 ${item.epoch} 轮` : ''} {item.seed !== undefined ? `种子 ${item.seed}` : item.inferenceMode === 'deterministic_condition_to_complete_rgb' ? '确定性推理' : ''}{verdict ? <><br /><strong>{verdict}</strong>{item.issueCodes?.length ? ` · ${item.issueCodes.join('、')}` : ''}</> : null}<br />{item.logicalPath.split('/').pop()}</figcaption>
    {failed || !item.url ? <p role="alert">{!item.url ? '受信图片入口未提供。' : '图片读取失败或摘要冲突；不能解释为未保存。'}{item.url && <button onClick={() => setFailed(false)}>重试图片</button>}</p> : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={`${item.role} ${item.sampleId ?? ''}`} loading="lazy" onError={() => setFailed(true)} /></a>}
    <small>绑定SHA：{item.sha256}；图片响应前重新核验字节。</small></figure>
}
export function AiConsoleTrainingHistory() {
  const [listing, setListing] = useState<Listing | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('artifacts')
  const [sectionCursor, setSectionCursor] = useState<string | null>(null)
  const [sectionPage, setSectionPage] = useState<SectionPage | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null)
  useEffect(() => { if (selected) { detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); detailRef.current?.focus({ preventScroll: true }) } }, [selected])
  useEffect(() => startHistoryPolling(async signal => {
    const response = await fetch(`/api/ai-console/training/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store', signal })
    const data = await response.json() as Listing
    if (signal.aborted) return
    if (data.reasonCode === 'history_cursor_revision_conflict') { setCursor(null); throw new Error('登记已更新，正在刷新首页；保留选中Run') }
    if (!response.ok || data.schemaVersion !== 'ai_console_training_history_v1' || !Array.isArray(data.records)) throw new Error(data.reasonCode ?? `历史请求失败 HTTP ${response.status}`)
    if (signal.aborted) return
    setListing(data)
    setLastSuccess(new Date().toISOString())
    setError(data.dataStatus !== 'connected' ? `覆盖未完整：${reasonLabel(data.reasonCode)}` : null)
    if (selected) {
      const detailResponse = await fetch(`/api/ai-console/training/history/${encodeURIComponent(selected)}`, { cache: 'no-store', signal })
      const value = await detailResponse.json() as Detail
      if (signal.aborted) return
      if (!detailResponse.ok || value.schemaVersion !== 'ai_console_training_run_detail_v1' || (value.record?.recordId ?? value.record?.runId) !== selected) { setDetailError(`详情暂不可用：${reasonLabel(value.reasonCode)}（${value.reasonCode ?? detailResponse.status}）`); return }
      if (!signal.aborted) { setDetail(value); setDetailError(null) }
      const sectionResponse = await fetch(`/api/ai-console/training/history/${encodeURIComponent(selected)}?section=${section}&limit=20${sectionCursor ? `&cursor=${encodeURIComponent(sectionCursor)}` : ''}`, { cache: 'no-store', signal })
      const page = await sectionResponse.json() as SectionPage
      if (signal.aborted) return
      if (page.reasonCode === 'history_cursor_revision_conflict') {
        setSectionCursor(null); setSectionPage(null); setSectionError('内容来源已更新，正在刷新本节首页；保留选中Run'); return
      }
      if (!sectionResponse.ok || page.schemaVersion !== 'ai_console_training_run_detail_v1' || (page.record?.recordId ?? page.record?.runId) !== selected || page.section !== section || !Array.isArray(page.items)) {
        setSectionError(`内容页暂不可用：${page.reasonCode ?? sectionResponse.status}；保留页为陈旧快照，将自动重连。`); return
      }
      setSectionPage(page); setSectionError(null)
    }
  }, failure => { const message = `断线/陈旧：${failure instanceof Error ? failure.message : String(failure)}。保留值不是实时状态，将自动重连。`; setError(message); if (selected) { setDetailError(message); setSectionError(message) } }), [cursor, selected, section, sectionCursor])
  const artifacts = section === 'artifacts' ? (sectionPage?.items ?? []) as Artifact[] : []
  const events = section === 'events' ? (sectionPage?.items ?? []) as RegistryEvent[] : []
  return <section className={styles.history} aria-label="真实训练历史">
    <AiConsoleTrainingSummary />
    <header><h2>真实训练历史与制品</h2><p>目标2秒自动查询 · 当前执行与历史选择相互独立 · 不执行训练或修改证据</p></header>
    <p role="status">{error ?? (listing ? '查询已连接' : '正在连接')} · 最近成功查询：{lastSuccess ?? '尚未取得'} · 登记修订：{listing?.sourceRevision ?? '未知'} · 索引修订：{listing?.indexRevision ?? '未连接'}</p>
    {listing && <details><summary>登记覆盖与限制（不等于磁盘全部历史）</summary><pre>{JSON.stringify(listing.coverage, null, 2)}</pre></details>}
    <nav aria-label="历史分页"><button disabled={!cursor} onClick={() => setCursor(null)}>最新首页</button><button disabled={!listing?.nextCursor} onClick={() => setCursor(listing?.nextCursor ?? null)}>下一页</button><span>总数：{listing?.total ?? '覆盖未完整核验'}</span></nav>
    <div className={styles.runs}>{listing?.records.map(run => <button key={run.recordId ?? run.runId} aria-pressed={selected === (run.recordId ?? run.runId)} onClick={() => { const identity = run.recordId ?? run.runId; if (selected !== identity) { setSelected(identity); setDetail(null); setDetailError(null); setSectionCursor(null); setSectionPage(null); setSectionError(null) } else detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}><strong>{runStatusLabel(run)}</strong><span>{run.runId ?? run.recordId}</span><small>{kindLabel(run)} · 训练终态：{run.terminalStatus} · {run.finishedAtUtc ? `完成时间：${timeLabel(run.finishedAtUtc)}` : `最近登记时间：${timeLabel(run.registeredAtUtc ?? run.recordedAtUtc)}`}</small><b>查看详情与登记事件 ↓</b></button>)}</div>
    {selected && <article ref={detailRef} tabIndex={-1} aria-label="选中Run详情" className={styles.detail}><h3>所选实验详情</h3><code>{selected}</code>{detailError && <p role="alert">{detailError}{detail ? ' 下方为上次成功快照，已过期；恢复连接前不代表最新状态。' : ''}</p>}{!detail ? <p role="status">{detailError ? '未取得可显示详情；将在下一轮自动重试。' : '正在查询选中Run的精确绑定与登记事件…'}</p> : <>
      <p>{runStatusLabel(detail.record)} · {kindLabel(detail.record)}</p><p>{reasonLabel(detail.reasonCode)}</p>
      <details><summary>原始状态与诊断代码</summary><code>{detail.record.terminalStatus} · {detail.dataStatus} · {detail.reasonCode ?? '无错误'}</code></details>
      <details><summary>内容覆盖与缺失项</summary><pre>{readableJson({ unavailableFields: detail.unavailableFields ?? [], coverage: detail.record.detailCoverage ?? '未提供逐项覆盖说明' })}</pre></details>
      <p>完成时间：{timeLabel(detail.record.finishedAtUtc)} · 最近登记时间：{timeLabel(detail.record.registeredAtUtc ?? detail.record.recordedAtUtc)}</p>
      <p>实验执行完成不等于视觉合格、正式Stage通过或发布。历史数据不代表当前正在训练。</p>
      {detail.record.qualification && typeof detail.record.qualification === 'object' && 'independentReviewStatus' in detail.record.qualification && <p role="status">独立审核：{String((detail.record.qualification as Record<string, unknown>).independentReviewStatus)} · 失败码：{Array.isArray((detail.record.qualification as Record<string, unknown>).issueCodes) ? ((detail.record.qualification as Record<string, unknown>).issueCodes as string[]).join('、') || '无' : '未记录'}。候选图不代表合格或发布。</p>}
      <p>真实优化步：{detail.record.optimizerSteps ?? '未记录'} · 分辨率：{JSON.stringify(detail.record.resolution ?? '未记录')}</p>
      <details><summary>真实资格字段</summary><pre>{readableJson(detail.record.qualification)}</pre></details>
      <nav aria-label="详情内容分区">{(Object.keys(sectionLabels) as Section[]).map(kind => <button key={kind} aria-pressed={section === kind} onClick={() => { if (section !== kind) { setSection(kind); setSectionCursor(null); setSectionPage(null); setSectionError(null) } }}>{sectionLabels[kind]}</button>)}</nav>
      <nav aria-label="详情内容分页"><button disabled={!sectionCursor} onClick={() => { setSectionCursor(null); setSectionPage(null) }}>本节首页</button><button disabled={!sectionPage?.nextCursor} onClick={() => { setSectionCursor(sectionPage?.nextCursor ?? null); setSectionPage(null) }}>本节下一页</button><span>本页 {sectionPage?.items.length ?? '未取得'} 项 · 已知 {sectionPage?.knownItemCount ?? '未知'} 项 · 完整总数：{sectionPage?.total ?? '覆盖未完整核验'}</span></nav>
      {sectionError && <p role="alert">{sectionError}</p>}
      {!sectionPage && <p role="status">正在查询{sectionLabels[section]}内容页…</p>}
      {sectionPage && <details><summary>本节实际覆盖与限制 · {sectionPage.dataStatus}</summary><p>{reasonLabel(sectionPage.reasonCode)}</p><pre>{readableJson(sectionPage.coverage)}</pre></details>}
      {section === 'events' && <><h3>本Run登记时间线</h3><p>仅包含事务、数据库与快照均核验通过的本Run事件，不是逐步训练日志。{detail.record.eventCoverage?.complete ? '登记链覆盖完整。' : '较早登记链存在缺口，事件覆盖不完整。'}</p>
      {events.length ? <ol>{events.map(event => <li key={event.transactionId}><strong>{timeLabel(event.recordedAtUtc)}</strong> · 修订{event.registryRevision} / 事件{event.eventSequence}<br /><span>{event.action === 'advance_current_capability_lifecycle' ? '本地程序推进并登记状态' : '本地程序登记事件'}</span><details><summary>UTC时间、事件身份及证据路径</summary><pre>{readableJson(event)}</pre></details></li>)}</ol> : sectionPage && <p>本页没有该Run自身的登记事件；不能借用其他任务事件补齐。</p>}</>}
      {section === 'artifacts' && <>
      <h3>原图与已登记图像</h3><div className={styles.images}>{artifacts.filter(item => ['original', 'output', 'image'].includes(item.role)).map(item => <EvidenceImage key={item.artifactId} item={item} />)}</div>
      {!artifacts.some(item => ['original', 'output', 'image'].includes(item.role)) && sectionPage && <p>本页没有图像，其他内容请继续分页；实际缺失范围见覆盖说明。</p>}
      <h3>Checkpoint（绑定已核验，权重字节未重算）</h3>
      {artifacts.filter(item => item.role === 'checkpoint').map(cp => <p key={cp.artifactId}><a href={cp.url ?? undefined} target="_blank" rel="noreferrer">{cp.arm} · {cp.byteLength}字节 · {cp.optimizerSteps ?? '未知'}优化步</a><br />{cp.logicalPath}<br />SHA：{cp.sha256}</p>)}
      {!artifacts.some(item => item.role === 'checkpoint') && sectionPage && <p>本页未提供Checkpoint绑定；其他页与实际缺口见分页及覆盖说明。</p>}
      <h3>请求、条件与终态证据</h3><ul>{artifacts.filter(item => !['original', 'output', 'image', 'checkpoint'].includes(item.role)).map(item => <li key={item.artifactId}><>{!item.url ? <span>{item.previewStatus === 'bounded_projection_only_raw_source_over_limit' ? '实验结果原文超过8MiB；已核验图像和指标通过受控派生分页查看' : '证据原文不可预览'} · {item.logicalPath}</span> : <a href={item.url} target="_blank" rel="noreferrer">{({ terminal: '终态证据', result: '实验结果', request: '实验请求与样本', condition: '样本条件', task_capsule: '本任务证据胶囊', registry_transaction: '登记事务', evidence: '已绑定证据', steps: '优化步证据' } as Record<string, string>)[item.role] ?? item.role} {item.sampleId} {item.arm}</a>}</> · {item.sha256}</li>)}</ul>
      </>}
      {section === 'metrics' && <><h3>指标与观测</h3>{sectionPage?.items.length ? <MetricSummary metrics={sectionPage.items} /> : sectionPage && <p>本页没有可展开指标，已记录范围见本节覆盖说明。</p>}</>}
      {section === 'logs' && <><h3>历史程序日志</h3>{sectionPage?.items.length ? sectionPage.items.map((item, index) => <pre key={index}>{readableJson(item)}</pre>) : sectionPage && <p>{reasonLabel(sectionPage.reasonCode)} · {sectionPage.reasonCode}</p>}</>}
    </>}</article>}
  </section>
}
