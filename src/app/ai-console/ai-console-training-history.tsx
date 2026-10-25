'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { startHistoryPolling } from './ai-console-history-poll'
import { AiConsoleTrainingSummary } from './ai-console-training-summary'
import { formatTrainingTime, mapWorkerTiming, type WorkerExecutionTiming } from './ai-console-training-time'
import styles from './ai-console-training-history.module.css'

type Artifact = { artifactId: string; role: string; url: string | null; evidenceKind?: string; sampleId?: string; split?: string; arm?: string; seed?: number; inferenceMode?: string; sourceLabel?: string; epoch?: number | null; passed?: boolean; issueCodes?: string[]; logicalPath: string; sha256: string; byteLength?: number; optimizerSteps?: unknown; verificationStatus: string; previewStatus?: string }
type RegistryEvent = { eventSequence: number; registryRevision: number; transactionId: string; taskId: string; runId: string; action: string | null; recordedAtUtc: string | null; currentSha256: string; evidenceReferences: string[] }
type Run = { runId: string; recordId?: string; runKind: string; terminalStatus: string; sourceRevision: number; startedAtUtc?: string | null; finishedAtUtc: string | null; workerExecutionTiming?: WorkerExecutionTiming | null; recordedAtUtc?: string | null; registeredAtUtc?: string | null; independentReviewStatus?: string; independentReviewIssueCodes?: string[]; reviewStatusSource?: string; optimizerSteps?: unknown; completedEpochs?: unknown; targetEpochs?: unknown; trainingPlan?: unknown; detailCoverage?: unknown; resolution?: unknown; qualification?: unknown; failureSummary?: unknown; artifacts?: Artifact[]; metrics?: unknown[]; checkpoints?: Artifact[]; events?: RegistryEvent[]; eventCoverage?: { scope: string; complete: boolean; gap: unknown } }
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
  if (reason === 'history_training_preview_observation_only') return '可查看同Run受信进度显式绑定的未审核训练预览；不从历史记录推断训练活动，其他内容覆盖另列。'
  return reason ? labels[reason] ?? '部分证据暂不可用；请查看诊断代码与原始证据。' : '已核验详情；不代表训练资格或能力发布。'
}
function timeLabel(value: string | null | undefined) { return formatTrainingTime(value) }
function RunTiming({ run, compact = false, stale = false }: { run: Run; compact?: boolean; stale?: boolean }) {
  const timing = mapWorkerTiming(run.workerExecutionTiming)
  const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
  const coverage = object(run.detailCoverage) ? run.detailCoverage : null
  const availability = object(coverage?.availability) ? coverage.availability : null
  const counters = object(run.optimizerSteps) ? run.optimizerSteps : null
  const training = run as Run & { trainingStatus?: unknown; trainingExecutionState?: unknown }
  // Only the verified pre-training failure adapter establishes non-applicability.
  // Missing/corrupt timing alone says nothing about whether training started.
  const notStarted = run.runKind === 'bounded_gpu_qualification' && run.terminalStatus === 'failed_closed'
    && coverage?.adapter === 'managed_parent_execution_failure' && coverage.supported === true
    && coverage.sourcePolicy === 'verified_registry_explicit_sha256_parents_only'
    && ['qualification', 'gpu_qualification'].includes(String(coverage.phase))
    && coverage.workerTerminal === 'not_recorded' && availability?.workerTerminal === 'not_recorded'
    && training.trainingStatus == null && training.trainingExecutionState == null && run.completedEpochs == null
    && counters !== null && counters.generator == null && counters.discriminator == null
    && run.workerExecutionTiming?.availability === 'unavailable' && timing.reasonCode === 'worker_timing_not_bound'
    && run.workerExecutionTiming.sourcePath === null && run.workerExecutionTiming.sourceSha256 === null
    && run.workerExecutionTiming.startedAtUtc === null && run.workerExecutionTiming.endedAtUtc === null
    && run.workerExecutionTiming.elapsedSeconds === null && run.workerExecutionTiming.status === null
    && run.workerExecutionTiming.stopReason === null
  if (!compact && notStarted) return <section aria-label="所选Run起止与耗时"><h4>开始、结束与实际耗时</h4>
    {stale && <p role="status">阶段为上次成功详情快照，已过期；不代表当前执行状态。</p>}
    <p>GPU准入阶段失败，训练未启动；训练计时不适用。</p>
    <p>GPU准入耗时与训练worker计时属于不同阶段；本页不以准入、登记或文件时间替代训练起止与耗时。</p>
    <p>最近登记时间：{timeLabel(run.registeredAtUtc ?? run.recordedAtUtc)}（仅登记事件，不代替开始或结束）。</p>
  </section>
  // Raw run times retain their own scope. Never combine them with worker times
  // or calculate an elapsed duration from them, even when both are present.
  const hasWorker = run.workerExecutionTiming != null
  if (compact && timing.available) return <span>worker开始时间：{timing.startedAt} · worker结束时间：{timing.endedAt}<br />
    worker实际耗时：{timing.elapsed}；计时范围：{timing.scope}
  </span>
  if (compact) return <span>
    开始时间：{timeLabel(run.startedAtUtc)} · 结束时间：{timeLabel(run.finishedAtUtc)}<br />
    实际耗时：列表未提供可用worker计时，请到详情查看；范围：原始运行记录。登记时间不代表起止时间。
  </span>
  return <section aria-label="所选Run起止与耗时"><h4>开始、结束与实际耗时</h4>
    {stale && <p role="status">计时为上次成功详情快照，已过期；不代表当前执行状态。</p>}
    <dl>
      <div><dt>{hasWorker ? '训练worker开始时间' : '运行记录开始时间'}</dt><dd>{hasWorker ? timing.startedAt : timeLabel(run.startedAtUtc)}</dd></div>
      <div><dt>{hasWorker ? '训练worker结束时间' : '运行记录结束时间'}</dt><dd>{hasWorker ? timing.endedAt : timeLabel(run.finishedAtUtc)}</dd></div>
      <div><dt>实际耗时（单调计时）</dt><dd>{hasWorker ? timing.elapsed : '未记录／未知（无单调计时证据）'}</dd></div>
    </dl>
    <p>计时范围：{hasWorker ? timing.scope : '原始运行记录；具体阶段范围未记录，不能作为纯GPU训练耗时。'}</p>
    {hasWorker && <><p>{timing.state}</p><details><summary>计时来源、原始UTC与诊断代码</summary><pre>{readableJson({ reasonCode: timing.reasonCode, timing: timing.raw })}</pre></details>
      {(run.startedAtUtc || run.finishedAtUtc) && <p>原始运行记录（与worker范围分开）：开始 {timeLabel(run.startedAtUtc)}；结束 {timeLabel(run.finishedAtUtc)}。</p>}</>}
    <p>最近登记时间：{timeLabel(run.registeredAtUtc ?? run.recordedAtUtc)}（仅登记事件，不代替开始或结束）。</p>
  </section>
}
function recordedEpoch(value: unknown) {
  if (value === null || value === undefined) return '未记录'
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : '数据格式异常'
}
function TrainingFailureSummary({ run }: { run: Run }) {
  const failed = /fail|interrupt|error|blocked/i.test(run.terminalStatus)
  if (!failed && run.failureSummary == null) return null
  const value = run.failureSummary
  const failure = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
  const type = typeof failure?.type === 'string' && ['Error', 'AssertionError', 'ValueError', 'RuntimeError', 'TypeError', 'RangeError', 'TimeoutError'].includes(failure.type) ? failure.type : null
  // Do not dump arbitrary error objects, paths, secrets or unbounded messages into JSX.
  // Match the entire known format, including rejecting a trailing newline. The
  // index is an observation, not a lookup into a guessed model/module identity.
  const gradient = typeof failure?.message === 'string' && failure.message.length <= 96
    ? /^actual four-term total gradient identity differs at parameter (0|[1-9][0-9]{0,7})$/u.exec(failure.message) : null
  const coverage = run.detailCoverage && typeof run.detailCoverage === 'object' && !Array.isArray(run.detailCoverage) ? run.detailCoverage as Record<string, unknown> : null
  const timeout = failed && failure?.message === 'wall_timeout'
  const trainingTimeout = timeout && coverage?.phase === 'training'
  const plan = run.trainingPlan && typeof run.trainingPlan === 'object' && !Array.isArray(run.trainingPlan) ? run.trainingPlan as Record<string, unknown> : null
  const maxWallSeconds = trainingTimeout && typeof plan?.maxWallSeconds === 'number' && Number.isSafeInteger(plan.maxWallSeconds) && plan.maxWallSeconds > 0 ? plan.maxWallSeconds : null
  const message = timeout
    ? trainingTimeout ? '达到本轮训练时间上限，已停止'
      : typeof coverage?.phase === 'string' && ['qualification', 'gpu_qualification'].includes(coverage.phase) ? '达到本轮资格检查时间上限，已停止' : '达到本轮执行时间上限，已停止（阶段未核验）'
    : gradient && gradient[0] === failure?.message
    ? `四项总梯度一致性检查未通过（参数索引 ${gradient[1]}）`
    : failure?.message === 'snapshot outside verified source/known control'
    ? 'snapshot outside verified source/known control'
    : typeof failure?.message === 'string' && failure.message.trim()
      ? '错误详情见已绑定终态证据（原始文本未直接展示）'
      : '错误信息未记录或无法核验'
  return <section aria-label="所选Run失败信息"><h4>已登记失败信息（不是当前执行）</h4>
    <p>{type ? `${type}: ` : ''}{message}</p>
    {maxWallSeconds !== null && <p>本轮冻结训练时限：{maxWallSeconds}秒（取自所选Run计划，不代表实际运行耗时）。</p>}
    <p>已完成轮数：{recordedEpoch(run.completedEpochs)} / 计划轮数：{recordedEpoch(run.targetEpochs)}；真实优化步：{formatOptimizerSteps(run.optimizerSteps)}。</p>
    <p>轮数与 G／D 步数各按该 Run 已登记值展示，不互相换算；参数索引不等于模块名称，也不证明故障根因。故障证据与结果图分开查看。</p>
  </section>
}
function TrainingArtifactStatus({ run }: { run: Run }) {
  const artifacts = Array.isArray(run.artifacts) ? run.artifacts : []
  const checkpoint = artifacts.some(item => item?.role === 'checkpoint')
    || Array.isArray(run.checkpoints) && run.checkpoints.length > 0
  const output = artifacts.some(item => item?.role === 'output')
  return <><p>Checkpoint：{checkpoint ? '已登记，内容与资格以核验证据为准' : '未记录或无法核验'}；
    验证／输出图：{output ? '已登记，图片按需核验读取' : '未记录或无法核验'}。
    没有绑定或仅标记未记录，不能据此断言未生成。</p>
    {!output && <p>本轮无已登记结果图（以本次详情返回的结果图绑定为限）。故障清单、首错记录不是图片；未记录或无法核验不等于文件不存在。原图与其他图像仍按各自用途展示。</p>}
  </>
}
function formatOptimizerSteps(value: unknown): string {
  const countLabel = (count: unknown): string => {
    if (count === null || count === undefined) return '未记录'
    return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0
      ? `${count}`
      : '数据格式异常'
  }
  if (value === null || value === undefined || typeof value === 'number') return countLabel(value)
  if (typeof value !== 'object' || Array.isArray(value)) return '数据格式异常'
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return '数据格式异常'
  const steps = value as Record<string, unknown>
  const hasGenerator = Object.prototype.hasOwnProperty.call(steps, 'generator')
  const hasDiscriminator = Object.prototype.hasOwnProperty.call(steps, 'discriminator')
  if (!hasGenerator && !hasDiscriminator) return Object.keys(steps).length === 0 ? '未记录' : '数据格式异常'
  return `G（生成器）：${countLabel(hasGenerator ? steps.generator : undefined)} · D（判别器）：${countLabel(hasDiscriminator ? steps.discriminator : undefined)}`
}
function readableJson(value: unknown) { const text = JSON.stringify(value, null, 2) ?? '未记录'; const bytes = new TextEncoder().encode(text); return bytes.length > 64000 ? `${new TextDecoder().decode(bytes.subarray(0,64000))}\n[本项显示已截断，请查询绑定证据]` : text }
function failureEvidenceLabel(item: Artifact): string | null {
  if (item.role !== 'evidence') return null
  if (item.evidenceKind === 'gradientFailureManifest') return '故障清单'
  if (item.evidenceKind === 'gradientFailurePrimary') return '首错记录'
  return null
}
function EvidenceEntry({ item }: { item: Artifact }) {
  const label = failureEvidenceLabel(item) ?? ({ terminal: '终态证据', result: '实验结果', request: '实验请求与样本', condition: '样本条件', task_capsule: '本任务证据胶囊', registry_transaction: '登记事务', steps: '优化步证据' } as Record<string, string>)[item.role] ?? '已绑定证据'
  return <li>{!item.url ? <span>{label} · {item.previewStatus === 'bounded_projection_only_raw_source_over_limit' ? '实验结果原文超过8MiB；已核验图像和指标通过受控派生分页查看' : '证据原文不可预览'} · {item.logicalPath}</span> : <a href={item.url} target="_blank" rel="noreferrer">{label} {item.sampleId} {item.arm}</a>} · SHA：{item.sha256}</li>
}
function MetricSummary({ metrics }: { metrics: unknown[] }) {
  return <><p>已返回 {metrics.length} 项指标，逐项独立展开；整表预览截断不影响下方每项读取。</p><table><thead><tr><th>样本／轮次</th><th>实验臂</th><th>种子</th><th>度量</th></tr></thead><tbody>{metrics.map((value, index) => {
    const row = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
    const label = row?.sampleId !== undefined ? `${String(row.sampleId)}${row.optimizerStep !== undefined ? ` · 第${String(row.optimizerStep)}步` : ''}` : row?.epoch !== undefined && row.epoch !== null ? `第 ${String(row.epoch)} 轮` : `指标项 ${index + 1}`
    return <tr key={index}><td>{label}</td><td>{String(row?.arm ?? '未绑定')}</td><td>{String(row?.seed ?? '未绑定')}</td><td><details><summary>{label}：查看本项实际度量</summary><pre>{readableJson(value)}</pre></details></td></tr>
  })}</tbody></table><details><summary>整表字段预览（有长度上限，完整已返回项请逐项展开）</summary><pre>{readableJson(metrics)}</pre></details></>
}
function EvidenceImage({ item }: { item: Artifact }) {
  const [failed, setFailed] = useState(false)
  const diagnostic = item.evidenceKind === 'training_diagnostic_preview'
  const verdict = !diagnostic && item.role === 'output' && typeof item.passed === 'boolean' ? (item.passed ? '机器审核通过' : '机器审核未通过') : null
  return <figure><figcaption>{diagnostic ? '未审核训练预览，非Checkpoint／正式输出' : item.role === 'original' ? item.split === 'train' ? '训练原图' : '验证参考原图' : item.role === 'image' ? `材料化报告登记图像${item.sourceLabel ? ` · ${item.sourceLabel}` : '（逐图用途未记录）'}` : item.sourceLabel ? `本地模型实验图 · ${item.sourceLabel}` : '本地AI候选输出'} · {item.sampleId} {item.arm} {item.epoch != null ? `第 ${item.epoch} 轮` : ''} {item.seed !== undefined ? `种子 ${item.seed}` : item.inferenceMode === 'deterministic_condition_to_complete_rgb' ? '确定性推理' : ''}{diagnostic && <><br />训练前向的已保存诊断图，不是故障发生时画面，不证明画质合格或当步权重可恢复。</>}{verdict ? <><br /><strong>{verdict}</strong>{item.issueCodes?.length ? ` · ${item.issueCodes.join('、')}` : ''}</> : null}<br />{item.logicalPath.split('/').pop()}</figcaption>
    {failed || !item.url ? <p role="alert">{!item.url ? '受信图片入口未提供。' : '图片读取失败或摘要冲突；不能解释为未保存。'}{item.url && <button onClick={() => setFailed(false)}>重试图片</button>}</p> : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={`${item.role} ${item.sampleId ?? ''}`} loading="lazy" onError={() => setFailed(true)} /></a>}
    {diagnostic && <p>D更新后、G更新前捕获 · {formatOptimizerSteps(item.optimizerSteps)}；这些是捕获时计数，不是当前实时进度。</p>}
    <small>图像自身开始／结束／生成耗时：未记录（无自身区间，不采用任务耗时）。<br />绑定SHA：{item.sha256}；图片响应前重新核验字节。</small></figure>
}
function TrainingPreviewCoverage({ coverage, stale }: { coverage: unknown; stale?: boolean }) {
  if (stale) return <p role="status">训练诊断预览：详情未取得或已过期，登记状态待重新核验；不能据此判定未登记或未保存。不参与Checkpoint选择、机器资格或世界发布。</p>
  const record = coverage && typeof coverage === 'object' && !Array.isArray(coverage) ? coverage as Record<string, unknown> : null
  const preview = record?.trainingPreview && typeof record.trainingPreview === 'object' && !Array.isArray(record.trainingPreview) ? record.trainingPreview as Record<string, unknown> : null
  if (!preview) return null
  const labels: Record<string, string> = { available: '已核验绑定的训练诊断预览可查看（未审核）', partial: '部分训练预览不可用，已核验的其他图像仍保留', not_recorded: '未登记训练预览，不能补造旧图', missing: '已绑定预览文件缺失', unreadable: '已绑定预览文件无法读取', hash_conflict: '预览字节与绑定摘要冲突', unsupported_schema: '预览协议或政策版本尚未支持', unavailable: '当前预览来源未通过核验', over_limit: '超出本次有界读取限额，不能据此判断未保存', capture_failed: '生产端记录预览捕获失败；没有可用图像时不补图', budget_exhausted: '生产端记录预览预算耗尽，不扩大预算或补图', publication_incomplete: '生产端记录图片／记录发布不完整，暂存文件不作为已登记预览', binding_mismatch: '生产端记录预览身份绑定冲突，不采用该条目' }
  const status = typeof preview.status === 'string' && Object.hasOwn(labels, preview.status) ? preview.status : 'unavailable'
  return <p role="status">训练诊断预览：{labels[status]}。不参与Checkpoint选择、机器资格或世界发布。</p>
}
function TrainingArtifactSourceGap({ coverage }: { coverage: unknown }) {
  const value = coverage && typeof coverage === 'object' && !Array.isArray(coverage) ? coverage as Record<string, unknown> : null
  if (value?.artifactSourceGap !== '缺少受信终态清单，当前接口未接入；不能据此判定未训练、未生成或未保存。') return null
  // Recognize the exact supported gap, never echo arbitrary backend prose.
  return <p role="status" aria-label="产物来源缺口">缺少受信终态清单，当前接口未接入；不能据此判定未训练、未生成或未保存。</p>
}
function subscribeToHistoryUrl(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}
function historicalRunFromUrl() {
  const identity = new URL(window.location.href).searchParams.get('run')
  return identity && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/.test(identity) ? identity : null
}
function serverHistoricalRun() { return null }
export function AiConsoleTrainingHistory() {
  const [listing, setListing] = useState<Listing | null>(null)
  const [detailSnapshot, setDetail] = useState<Detail | null>(null)
  const [selectedRun, setSelected] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('artifacts')
  const [sectionCursor, setSectionCursor] = useState<string | null>(null)
  const [sectionSnapshot, setSectionPage] = useState<SectionPage | null>(null)
  const [sectionError, setSectionError] = useState<string | null>(null)
  const [query, setRunQuery] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null)
  // The server and hydration render share a null snapshot; the browser then
  // restores the URL identity without copying external state in an Effect.
  const restoredRun = useSyncExternalStore(subscribeToHistoryUrl, historicalRunFromUrl, serverHistoricalRun)
  const selected = selectedRun ?? restoredRun
  const detail = (detailSnapshot?.record.recordId ?? detailSnapshot?.record.runId) === selected ? detailSnapshot : null
  const sectionPage = (sectionSnapshot?.record.recordId ?? sectionSnapshot?.record.runId) === selected && sectionSnapshot?.section === section ? sectionSnapshot : null
  const runQuery = query ?? restoredRun ?? ''
  function selectRun(identity: string) {
    if (selected !== identity) { setSelected(identity); setDetail(null); setDetailError(null) }
    setSection('artifacts'); setSectionCursor(null); setSectionPage(null); setSectionError(null)
    if (selected === identity) detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  useEffect(() => {
    if (!selected || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('run', selected)
    window.history.replaceState(window.history.state, '', url.toString())
  }, [selected])
  useEffect(() => { if (selected) { detailRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); detailRef.current?.focus({ preventScroll: true }) } }, [selected])
  useEffect(() => {
    const disconnected = (failure: unknown) => `断线/陈旧：${failure instanceof Error ? failure.message : String(failure)}。保留值不是实时状态，将自动重连。`
    // Selected content gets the first slot. All three requests are independent,
    // serial and bounded; an unavailable list/detail must not starve images.
    return startHistoryPolling([
      ...(selected ? [{ run: async (signal: AbortSignal) => {
        const sectionResponse = await fetch(`/api/ai-console/training/history/${encodeURIComponent(selected)}?section=${section}&limit=20${sectionCursor ? `&cursor=${encodeURIComponent(sectionCursor)}` : ''}`, { cache: 'no-store', signal })
        const page = await sectionResponse.json() as SectionPage
        if (signal.aborted) return
        if (page.reasonCode === 'history_cursor_revision_conflict') {
          setSectionCursor(null); setSectionPage(null); throw new Error('内容来源已更新，正在刷新本节首页；保留选中Run')
        }
        if (!sectionResponse.ok || page.schemaVersion !== 'ai_console_training_run_detail_v1' || (page.record?.recordId ?? page.record?.runId) !== selected || page.section !== section || !Array.isArray(page.items)) {
          throw new Error(`内容页暂不可用：${page.reasonCode ?? sectionResponse.status}`)
        }
        setSectionPage(page); setSectionError(page.dataStatus === 'unknown_or_stale' ? '内容来源已过期，保留页不是最新状态，将自动重连。' : null)
      }, failed: (failure: unknown) => setSectionError(disconnected(failure)) }, {
        run: async (signal: AbortSignal) => {
          const detailResponse = await fetch(`/api/ai-console/training/history/${encodeURIComponent(selected)}`, { cache: 'no-store', signal })
          const value = await detailResponse.json() as Detail
          if (signal.aborted) return
          if (!detailResponse.ok || value.schemaVersion !== 'ai_console_training_run_detail_v1' || (value.record?.recordId ?? value.record?.runId) !== selected) {
            throw new Error(`详情暂不可用：${reasonLabel(value.reasonCode)}（${value.reasonCode ?? detailResponse.status}）`)
          }
          setDetail(value); setDetailError(value.dataStatus === 'unknown_or_stale' ? '详情来源已过期，预览登记状态待重新核验，将自动重连。' : null)
        }, failed: (failure: unknown) => setDetailError(disconnected(failure)),
      }] : []),
      { run: async signal => {
        const response = await fetch(`/api/ai-console/training/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { cache: 'no-store', signal })
        const data = await response.json() as Listing
        if (signal.aborted) return
        if (data.reasonCode === 'history_cursor_revision_conflict') { setCursor(null); throw new Error('登记已更新，正在刷新首页；保留选中Run') }
        if (!response.ok || data.schemaVersion !== 'ai_console_training_history_v1' || !Array.isArray(data.records)) throw new Error(data.reasonCode ?? `历史请求失败 HTTP ${response.status}`)
        setListing(data)
        setLastSuccess(new Date().toISOString())
        setError(data.dataStatus !== 'connected' ? `覆盖未完整：${reasonLabel(data.reasonCode)}` : null)
      }, failed: failure => setError(disconnected(failure)) },
    ])
  }, [cursor, selected, section, sectionCursor])
  const artifacts = section === 'artifacts' ? (sectionPage?.items ?? []) as Artifact[] : []
  const hasPreview = artifacts.some(item => item.evidenceKind === 'training_diagnostic_preview' && item.role === 'image')
  const events = section === 'events' ? (sectionPage?.items ?? []) as RegistryEvent[] : []
  return <section className={styles.history} aria-label="真实训练历史">
    <AiConsoleTrainingSummary />
    <header><h2>真实训练历史与制品</h2><p>目标2秒自动查询 · 当前执行与历史选择相互独立 · 不执行训练或修改证据</p></header>
    <form className={styles.lookup} onSubmit={event => { event.preventDefault(); const identity = runQuery.trim(); if (/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/.test(identity)) selectRun(identity) }}>
      <label>查询完整Run标识<input value={runQuery} maxLength={192} onChange={event => setRunQuery(event.target.value)} placeholder="粘贴Run标识，直接查询历史图像与证据" /></label>
      <button type="submit" disabled={!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,191}$/.test(runQuery.trim())}>查看该Run图像与证据</button>
    </form>
    {!selected && <p>先选择下方任一历史记录，或粘贴完整Run标识查询。已登记的原图、结果图及失败证据在详情中查看；不会用历史图替代当前训练预览。</p>}
    <p role="status">{error ?? (listing ? '查询已连接' : '正在连接')} · 最近成功查询：{lastSuccess ?? '尚未取得'} · 登记修订：{listing?.sourceRevision ?? '未知'} · 索引修订：{listing?.indexRevision ?? '未连接'}</p>
    {listing && <details><summary>登记覆盖与限制（不等于磁盘全部历史）</summary><pre>{JSON.stringify(listing.coverage, null, 2)}</pre></details>}
    <nav aria-label="历史分页"><button disabled={!cursor} onClick={() => setCursor(null)}>最新首页</button><button disabled={!listing?.nextCursor} onClick={() => setCursor(listing?.nextCursor ?? null)}>下一页</button><span>总数：{listing?.total ?? '覆盖未完整核验'}</span></nav>
    <div className={styles.runs}>{listing?.records.map(run => <button key={run.recordId ?? run.runId} aria-pressed={selected === (run.recordId ?? run.runId)} onClick={() => selectRun(run.recordId ?? run.runId)}><strong>{runStatusLabel(run)}</strong><span>{run.runId ?? run.recordId}</span><small>{kindLabel(run)} · 训练终态：{run.terminalStatus}<br /><RunTiming run={run} compact /><br />最近登记时间：{timeLabel(run.registeredAtUtc ?? run.recordedAtUtc)}</small><b>查看图像、详情与登记事件 ↓</b></button>)}</div>
    {selected && <article ref={detailRef} tabIndex={-1} aria-label="选中Run详情" className={styles.detail}><h3>所选实验详情</h3><code>{selected}</code>{detailError && <p role="alert">{detailError}{detail ? ' 详情元数据为上次成功快照，已过期；恢复连接前不代表最新状态。内容页连接状态独立列示。' : ''}</p>}{!detail ? <p role="status">{detailError ? '未取得可显示详情；将在下一轮自动重试，内容页独立查询。' : '正在查询选中Run的精确绑定与登记事件；内容页独立查询…'}</p> : <>
      <p>{runStatusLabel(detail.record)} · {kindLabel(detail.record)}</p><p>{reasonLabel(detail.reasonCode)}</p><RunTiming run={detail.record} stale={Boolean(detailError)} /></>}
      <nav aria-label="详情内容分区">{(Object.keys(sectionLabels) as Section[]).map(kind => <button key={kind} aria-pressed={section === kind} onClick={() => { if (section !== kind) { setSection(kind); setSectionCursor(null); setSectionPage(null); setSectionError(null) } }}>{sectionLabels[kind]}</button>)}</nav>
      <nav aria-label="详情内容分页"><button disabled={!sectionCursor} onClick={() => { setSectionCursor(null); setSectionPage(null) }}>本节首页</button><button disabled={!sectionPage?.nextCursor} onClick={() => { setSectionCursor(sectionPage?.nextCursor ?? null); setSectionPage(null) }}>本节下一页</button><span>本页 {sectionPage?.items.length ?? '未取得'} 项 · 已知 {sectionPage?.knownItemCount ?? '未知'} 项 · 完整总数：{sectionPage?.total ?? '覆盖未完整核验'}</span></nav>
      {sectionError && <p role="alert">{sectionError}</p>}
      {sectionError && sectionPage && <p role="status">本节保留上次成功内容，已过期；不是当前最新快照。</p>}
      {!sectionPage && <p role="status">{sectionError ? `${sectionLabels[section]}内容页未取得；将在下一轮自动重试。` : `正在查询${sectionLabels[section]}内容页…`}</p>}
      {section === 'artifacts' && <>
        <TrainingPreviewCoverage coverage={detail?.record.detailCoverage} stale={!detail || Boolean(detailError)} />
        <TrainingArtifactSourceGap coverage={detail?.record.detailCoverage} />
        {hasPreview && <section aria-label="未审核训练预览"><h3>训练诊断预览（未审核）</h3><div className={styles.images}>{artifacts.filter(item => item.evidenceKind === 'training_diagnostic_preview' && item.role === 'image').map(item => <EvidenceImage key={item.artifactId} item={item} />)}</div></section>}
        <h3 className={styles.imageHeading}>原图与已登记图像</h3>
        <div className={styles.images}>{artifacts.filter(item => item.evidenceKind !== 'training_diagnostic_preview' && ['original', 'output', 'image'].includes(item.role)).map(item => <EvidenceImage key={item.artifactId} item={item} />)}</div>
        {!artifacts.some(item => item.evidenceKind !== 'training_diagnostic_preview' && ['original', 'output', 'image'].includes(item.role)) && sectionPage && <p>本页没有原图／结果图。{hasPreview ? '本页训练诊断预览已单独列示。' : '本页没有可查看的训练诊断预览条目。'}{sectionPage.nextCursor ? '其他内容可继续分页查看。' : '本节没有下一页。'}实际可查范围与缺口见覆盖说明。</p>}
      </>}
      {detail && <><TrainingFailureSummary run={detail.record} />
      <TrainingArtifactStatus run={detail.record} />
      <details><summary>原始状态与诊断代码</summary><code>{detail.record.terminalStatus} · {detail.dataStatus} · {detail.reasonCode ?? '无错误'}</code></details>
      <details><summary>内容覆盖与缺失项</summary><pre>{readableJson({ unavailableFields: detail.unavailableFields ?? [], coverage: detail.record.detailCoverage ?? '未提供逐项覆盖说明' })}</pre></details>
      {detail.record.qualification && typeof detail.record.qualification === 'object' && 'independentReviewStatus' in detail.record.qualification && <p role="status">独立审核：{String((detail.record.qualification as Record<string, unknown>).independentReviewStatus)} · 失败码：{Array.isArray((detail.record.qualification as Record<string, unknown>).issueCodes) ? ((detail.record.qualification as Record<string, unknown>).issueCodes as string[]).join('、') || '无' : '未记录'}。候选图不代表合格或发布。</p>}
      <p>真实优化步：{formatOptimizerSteps(detail.record.optimizerSteps)} · 分辨率：{JSON.stringify(detail.record.resolution ?? '未记录')}</p>
      <details><summary>真实资格字段</summary><pre>{readableJson(detail.record.qualification)}</pre></details></>}
      <p>实验执行完成不等于视觉合格、正式Stage通过或发布。历史数据不代表当前正在训练。</p>
      {sectionPage && <details><summary>本节实际覆盖与限制 · {sectionPage.dataStatus}</summary><p>{reasonLabel(sectionPage.reasonCode)}</p><pre>{readableJson(sectionPage.coverage)}</pre></details>}
      {section === 'events' && <><h3>本Run登记时间线</h3><p>仅包含事务、数据库与快照均核验通过的本Run事件，不是逐步训练日志。{detail && !detailError ? detail.record.eventCoverage?.complete ? '登记链覆盖完整。' : '较早登记链存在缺口，事件覆盖不完整。' : '详情覆盖状态待重新核验。'}</p>
      {events.length ? <ol>{events.map(event => <li key={event.transactionId}><strong>{timeLabel(event.recordedAtUtc)}</strong> · 修订{event.registryRevision} / 事件{event.eventSequence}<br /><span>{event.action === 'advance_current_capability_lifecycle' ? '本地程序推进并登记状态' : '本地程序登记事件'}</span><details><summary>UTC时间、事件身份及证据路径</summary><pre>{readableJson(event)}</pre></details></li>)}</ol> : sectionPage && <p>本页没有该Run自身的登记事件；不能借用其他任务事件补齐。</p>}</>}
      {section === 'artifacts' && <>
      {artifacts.some(item => failureEvidenceLabel(item)) && <section aria-label="本页故障证据"><h3>故障证据（非图片）</h3><p>沿原受信制品入口查看安全JSON；响应前核验SHA，内容过长时保留截断说明。</p><ul>{artifacts.filter(item => failureEvidenceLabel(item)).map(item => <EvidenceEntry key={item.artifactId} item={item} />)}</ul></section>}
      <h3>Checkpoint（绑定已核验，权重字节未重算）</h3>
      {artifacts.filter(item => item.role === 'checkpoint').map(cp => <p key={cp.artifactId}><a href={cp.url ?? undefined} target="_blank" rel="noreferrer">{cp.arm} · {cp.byteLength}字节 · {formatOptimizerSteps(cp.optimizerSteps)}优化步</a><br />{cp.logicalPath}<br />SHA：{cp.sha256}</p>)}
      {!artifacts.some(item => item.role === 'checkpoint') && sectionPage && <p>本页未提供Checkpoint绑定；实际缺口见覆盖说明。{sectionPage.nextCursor ? '其他内容可继续分页查看。' : ''}</p>}
      <h3>请求、条件与终态证据</h3><ul>{artifacts.filter(item => !['original', 'output', 'image', 'checkpoint'].includes(item.role) && !failureEvidenceLabel(item)).map(item => <EvidenceEntry key={item.artifactId} item={item} />)}</ul>
      </>}
      {section === 'metrics' && <><h3>指标与观测</h3>{sectionPage?.items.length ? <MetricSummary metrics={sectionPage.items} /> : sectionPage && <p>本页没有可展开指标，已记录范围见本节覆盖说明。</p>}</>}
      {section === 'logs' && <><h3>历史程序日志</h3>{sectionPage?.items.length ? sectionPage.items.map((item, index) => <pre key={index}>{readableJson(item)}</pre>) : sectionPage && <p>{reasonLabel(sectionPage.reasonCode)} · {sectionPage.reasonCode}</p>}</>}
    </article>}
  </section>
}
