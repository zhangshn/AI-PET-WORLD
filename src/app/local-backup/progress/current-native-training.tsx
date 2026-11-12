import Link from 'next/link'
import type {NativeStage0Progress,NativeStage0HistoricalStop} from './progress-types'
import styles from './current-delivery.module.css'

const labels:Record<string,string>={not_started:'尚未启动',initialization_incomplete:'初始化未完成',active:'运行中',stopping:'正在停止',
 stopped:'已停止',host_not_running:'服务进程已退出',failed_closed:'已因错误停止',dispatch_reserved:'接续已登记',waiting_resources:'接续等待资源',host_exit_unconfirmed:'接续进程退出状态待确认',
 training_completed_fixed_review_passed:'训练已完成，固定审核通过',training_completed_fixed_review_failed:'训练已完成，固定审核未通过'}
const phases:Record<string,string>={training_guard:'训练计算与资源检查',before_pair:'开始一对模型更新',after_pair:'完成一对模型更新',
 validation:'固定开发图观察',checkpoint:'保存恢复文件'}
const dateText=(v:string)=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
const duration=(s:number)=>[Math.floor(s/3600),Math.floor(s/60)%60,Math.floor(s)%60].map(n=>String(n).padStart(2,'0')).join(':')

function HistoricalStop({data}:{data:NativeStage0HistoricalStop|undefined}){
 if(!data)return null
 return <aside aria-label="训练历史记录"><h5>首次停机记录（历史）</h5>
  {data.status==='verified'?<>
   <p>北京时间 {dateText(data.endedAt)}，原始停机记录记载已封存 {data.recordedPairs} 对更新、{data.recordedSegments} 段。</p>
   <p>仅为首次停机记录，不代表最新接续进度或可恢复资格。</p>
   <p>停止原因：{data.reason==='host or disk below floor'?'内存或磁盘低于原资源门槛':data.reason}。</p>
   <details><summary>历史记录来源</summary><p>运行编号 {data.runId}</p>
    <p>开始 {dateText(data.startedAt)}　停止 {dateText(data.endedAt)}</p>
    <p>原始记录 SHA-256：{data.terminalSha256}</p>
    <p>记录核验于北京时间 {dateText(data.verifiedAtUtc)}；未重新校验恢复文件。</p>
   </details>
   {data.continuation&&<><h5>接续终态（历史）</h5>{data.continuation.status==='verified'?<>
    <p>北京时间 {dateText(data.continuation.endedAt)}，接续记录记载已完成 {data.continuation.recordedPairs} 对更新、{data.continuation.recordedSegments} 段；训练完成，固定审核未通过。</p>
    <p>这是已结束运行的历史终态，不代表模型能力通过或当前正在训练。</p>
   </>:<p>{data.continuation.message}</p>}</>}
  </>:<p>{data.message}</p>}
 </aside>
}

export function CurrentNativeTraining({data}:{data:NativeStage0Progress|null|undefined}){
 if(!data)return null
 if(data.kind!=='verified')return <section className={styles.training} aria-label="本地地图模型训练"><h4>原生 256 地图模型训练</h4><p role="status">{data.message}</p><HistoricalStop data={data.historicalStop}/></section>
 return <section className={styles.training} aria-label="本地地图模型训练">
  <header><div><small>Painter · Stage0 · 256 × 192</small><h4>原生地图模型训练</h4></div><strong>{labels[data.status]??data.status}</strong></header>
  <div className={styles.trainingCount}><b>{data.percentage.toFixed(1)}%</b><span>本轮已封存 {data.committed} / 1152 对更新</span></div>
  <progress aria-label="本轮已封存训练更新" value={data.committed} max={1152}/>
  <p>每对含 1 次判别器更新和 1 次生成器更新。每完成一段并验证恢复文件后计入进度。</p>
  <div className={styles.trainingFacts}><span>已封存段 <b>{data.segments} / 48</b></span>
   <span>当前训练轮 <b>{data.epoch===null?'—':data.epoch+' / 24'}</b></span>
   <span>当前段 <b>{data.currentSegment??'—'}</b></span><span>运行耗时 <b>{data.elapsedSeconds===null?'—':duration(data.elapsedSeconds)}</b></span>
  </div>
  {data.heartbeatAt&&<p><strong>最近一次未封存读数</strong>　判别器 D {data.pendingD} 次，生成器 G {data.pendingG} 次。采样于北京时间 {dateText(data.heartbeatAt)}。</p>}
  {data.reason&&<p><strong>运行结果</strong>　{data.reason}</p>}
  {data.previousStop&&<p>首次执行在北京时间 {dateText(data.previousStop.endedAt)} 保护停机，封存 {data.previousStop.committed} 对更新。本次接续沿用原断点和截止时间。</p>}
  {data.waitingResource&&<p>北京时间 {dateText(data.waitingResource.at)}，可用内存 {(data.waitingResource.ram/2**30).toFixed(2)} GiB，下限 {data.waitingResource.minRam/2**30} GiB。可用磁盘 {(data.waitingResource.disk/2**30).toFixed(2)} GiB，下限 {data.waitingResource.minDisk/2**30} GiB。</p>}
  {data.reviews.map(v=><p key={v.epoch}>第 {v.epoch} 轮固定观察已保存 {v.rows} 张图，{v.reviewAvailable?<Link href={'/local-backup/work/native-stage0-review?epoch='+v.epoch}>查看验证原图、预测和逐图指标</Link>:'审核尚未封存'}。</p>)}
  <p><small>本地服务读数 · 北京时间 {dateText(data.sourceTime)}</small></p>
  <details><summary>运行时点与本地进程</summary>
   <p>运行编号 {data.runId}</p>
   <p>开始 {data.startedAt?dateText(data.startedAt):'尚无开始记录'}　结束 {data.endedAt?dateText(data.endedAt):'尚无结束记录'}</p>
   <p>后台服务 PID {data.hostPid??'—'}{data.hostAlive===null?'':data.hostAlive?'（在运行）':'（已退出）'}　
    工作进程 PID {data.workerPid??'—'}{data.workerPid?(data.workerOwned?'（受管）':'（最近记录）'):''}</p>
   {data.workerPhase&&<p>工作阶段 {phases[data.workerPhase]??data.workerPhase}</p>}
  </details>
  <HistoricalStop data={data.historicalStop}/>
  <nav aria-label="地图模型相关工作记录">{data.links.map(link=><Link key={link.href} href={link.href}>{link.label} ↗</Link>)}</nav>
 </section>
}
