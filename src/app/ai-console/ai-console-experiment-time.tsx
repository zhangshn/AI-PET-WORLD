import { formatTrainingElapsed, formatTrainingTime } from './ai-console-training-time'

export type ExperimentTiming = { availability: string; scope: string; elapsedSeconds: number;
  startedAtUtc: null; endedAtUtc: null; sourcePath: string; sourceSha256: string }
export function LegacyExperimentTiming({ value, compact }: { value: ExperimentTiming; compact: boolean }) {
  const verified = value.availability === 'available' && value.scope === 'legacy_single_map_experiment_before_result_publication'
    && /^[a-f0-9]{64}$/u.test(value.sourceSha256) && value.sourcePath.startsWith('.runtime/ai-painter/')
    && Number.isFinite(value.elapsedSeconds) && value.elapsedSeconds >= 0
  if (!verified) return <span>实验计时证据异常，请查看详情。</span>
  const facts = <>
    <span>实验开始／结束时间：未记录／未知。</span><br />
    <span>已保存的实验实际耗时：{formatTrainingElapsed(value.elapsedSeconds)}。</span><br />
    <span>范围：旧实验模型加载、计算与验证至结果发布前；未记录完整worker起止，不是控制器或纯GPU耗时。</span>
  </>
  return compact ? <span>{facts}</span> : <section aria-label="所选Run实验耗时"><h4>原始实验计时</h4>{facts}
    <details><summary>原始计时来源</summary><p>{value.sourcePath}</p><p>SHA-256：{value.sourceSha256}</p></details>
  </section>
}
export function ImageExecutionTiming({ value }: { value: unknown }) {
  const v=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
  const valid=v?.scope==='prediction_forward_cpu_transfer_png_encoding_and_publication'&&v.status==='completed'
    &&typeof v.startedAtUtc==='string'&&Number.isFinite(Date.parse(v.startedAtUtc))
    &&typeof v.endedAtUtc==='string'&&Number.isFinite(Date.parse(v.endedAtUtc))
    &&typeof v.elapsedSeconds==='number'&&Number.isFinite(v.elapsedSeconds)&&v.elapsedSeconds>=0
  return <span>{valid?<>图像自身开始：{formatTrainingTime(v.startedAtUtc)}；结束：{formatTrainingTime(v.endedAtUtc)}；实际生成耗时：{formatTrainingElapsed(v.elapsedSeconds)}。范围：预测前向、CPU传输、PNG编码与保存。</>
    :'图像自身开始／结束／生成耗时：未记录（无自身区间，不采用任务耗时）。'}</span>
}
export function ControllerExecutionTiming({ value }: { value: unknown }) {
  const v=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null
  if(v?.availability!=='available'||v.scope!=='controller_after_cpu_preparation_before_terminal_registration'
    ||typeof v.sourceSha256!=='string'||!/^[a-f0-9]{64}$/u.test(v.sourceSha256))return null
  return <p>控制器开始：{formatTrainingTime(v.startedAtUtc)}；结束：{formatTrainingTime(v.endedAtUtc)}；实际耗时：{formatTrainingElapsed(v.elapsedSeconds)}。
    范围：CPU准备结束后至终态登记前的执行协调与收尾；与worker区间有重叠，不能相加。</p>
}
