// Presentation only: elapsed time is read from the worker's monotonic clock,
// never reconstructed from UTC, registration, file dates, or heartbeats.
export const WORKER_TIMING_SCOPE = 'worker_training_execute_including_authentication_data_model_checkpoint_validation_and_final_progress_before_terminal_publication'

export type WorkerExecutionTiming = {
  availability: 'available' | 'unavailable'
  reasonCode: string | null
  sourcePath: string | null
  sourceSha256: string | null
  scope: string | null
  startedAtUtc: string | null
  endedAtUtc: string | null
  elapsedSeconds: number | null
  status: string | null
  stopReason: unknown
}

function timestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/u.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second, , zone] = match
  const y = Number(year), m = Number(month), d = Number(day)
  const days = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m < 1 || m > 12 || d < 1 || d > days[m - 1] || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59
    || zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const beijing = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23',
})
export function formatTrainingTime(value: unknown, missing = '未记录／未知') {
  if (value === null || value === undefined || value === '') return missing
  const parsed = timestamp(value)
  if (parsed === null) return '未知（时间格式异常）'
  const parts = Object.fromEntries(beijing.formatToParts(parsed).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond}（北京时间）`
}

export function formatTrainingElapsed(value: unknown) {
  if (value === null || value === undefined) return '未记录／未知（无单调计时证据）'
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER / 1000) return '未知（耗时数据异常）'
  const milliseconds = Math.round(value * 1000)
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000)
  const seconds = (milliseconds % 60_000 / 1000).toFixed(3)
  return `${hours ? `${hours}小时` : ''}${minutes ? `${minutes}分` : ''}${seconds}秒（${(milliseconds / 1000).toFixed(3)}秒）`
}

export function mapWorkerTiming(value: unknown) {
  const timing = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<WorkerExecutionTiming> : null
  const trusted = timing?.availability === 'available' && timing.reasonCode == null && typeof timing.sourcePath === 'string' && !!timing.sourcePath
    && typeof timing.sourceSha256 === 'string' && /^[a-f0-9]{64}$/u.test(timing.sourceSha256)
  const supported = trusted && timing.scope === WORKER_TIMING_SCOPE
  const started = supported && timing.status === 'started'
  const terminal = supported && ['completed', 'failed_closed'].includes(timing.status ?? '')
  const end = terminal ? timestamp(timing.endedAtUtc) : null
  const start = supported ? timestamp(timing.startedAtUtc) : null
  const reversed = start !== null && end !== null && end < start
  return {
    available: supported,
    startedAt: supported ? formatTrainingTime(timing.startedAtUtc) : '未记录／未知（无可用计时证据）',
    endedAt: started ? '尚未记录结束；最终结束时间未知' : terminal ? reversed ? '未知（起止顺序异常）' : formatTrainingTime(timing.endedAtUtc) : '未记录／未知（无可用计时证据）',
    elapsed: started ? '最终耗时未知（仅有开始记录）' : terminal && end !== null && !reversed ? formatTrainingElapsed(timing.elapsedSeconds) : '最终耗时未知（无完整终态计时证据）',
    scope: supported ? '训练 worker：含认证、数据与模型加载、训练、Checkpoint、验证及最终进度；不含此前CPU准备、GPU准入及后续终态发布／审核。不是纯GPU训练耗时。' : '训练 worker；具体计时范围未核验',
    state: supported ? started ? '仅记录开始，不代表当前仍在运行' : timing.status === 'completed' ? 'worker已结束；审核与发布资格另列' : timing.status === 'failed_closed' ? 'worker失败关闭；停止原因见绑定证据' : '计时状态未知' : '计时未记录或无法核验',
    reasonCode: timing?.reasonCode ?? (trusted && !supported ? 'worker_timing_scope_unsupported' : !trusted && timing?.availability === 'available' ? 'worker_timing_source_invalid' : null),
    sourcePath: trusted ? timing.sourcePath : null,
    sourceSha256: trusted ? timing.sourceSha256 : null,
    raw: timing ? { sourcePath: trusted ? timing.sourcePath : null, sourceSha256: trusted ? timing.sourceSha256 : null,
      scope: supported ? timing.scope : null, status: supported ? timing.status : null,
      startedAtUtc: supported && typeof timing.startedAtUtc === 'string' ? timing.startedAtUtc.slice(0, 128) : null,
      endedAtUtc: supported && typeof timing.endedAtUtc === 'string' ? timing.endedAtUtc.slice(0, 128) : null,
      elapsedSeconds: terminal && typeof timing.elapsedSeconds === 'number' && Number.isFinite(timing.elapsedSeconds) ? timing.elapsedSeconds : null } : null,
  }
}
