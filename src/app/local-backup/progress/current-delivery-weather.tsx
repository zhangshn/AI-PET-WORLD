import type {CurrentWorldBaseline} from './progress-types'

const fieldNames: Record<string,string>={PRECTOTCORR:'降水',RH2M:'相对湿度',T2M:'气温',WS2M:'风速'}
const label:Record<string,string>={
  available:'还有可用次数',reserved_uncommitted:'已占用下一次预测，尚无提交收据',
  completed_exhausted:'本轮累计预算已用完，已由独立进程读回终点',budget_exhausted:'预算已用完，尚无终点读回记录',
  commit_pending_accounting:'存档已提交，预算账本正在衔接',no_inflight_model:'账本当前无在途计算',stopped:'服务已停止，本轮未完成',
  exhausted:'两次预测均已提交',exhausted_exited:'两次预测均已提交，服务器任务已退出',
}
function printed(value:number){
  return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:Math.abs(value)>0&&Math.abs(value)<0.001?9:3}).format(value)
}
export function CommittedWeatherDays({head}:{head:NonNullable<CurrentWorldBaseline['currentHead']>}){
  if(!head.days?.length)return null
  const rolling=head.rolling
  return <section aria-label="已提交天气履历">
    <h4>已提交的天气变化</h4>
    {head.pendingTransaction&&<p>服务器正在提交下一笔事务。这里显示最近一笔已有收据的天气。</p>}
    <p>同一世界的模拟日历（UTC）。箭头左侧是步前存档值，右侧是本步模型预测并保存的值。</p>
    {head.scheduled&&<div data-scheduled-weather={head.scheduled.status}>
      <strong>正式世界已推进至第 {head.tick} 日</strong>
      <p>累计天气预算 {head.scheduled.total} 次，已提交 {head.scheduled.committed} 日，模型还可启动 {head.scheduled.remaining} 次。已使用 {head.scheduled.batches} 批，第 {head.scheduled.activation} 次服务启动。</p>
      <p>{label[head.scheduled.status]??head.scheduled.status}。{head.scheduled.completedAtUtc&&<> 终点核验时间 {head.scheduled.completedAtUtc}。</>}{head.scheduled.serverExit&&<> 服务器进程 {head.scheduled.serverExit.pid} 已退出，退出码 {head.scheduled.serverExit.code}。</>}</p>
      <p>下列卡片显示前三日与当前日的原始天气。累计数量取自本世界账本和当前存档。</p>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,17rem),1fr))',gap:'0.65rem'}}>
      {head.days.map(day=><article key={day.tick} data-weather-day={day.tick} style={{background:'#fff',color:'#233b53',border:'1px solid #dbe5ef',borderRadius:'0.45rem',padding:'0.65rem'}}>
        <h5 style={{margin:0}}>第 {day.tick} 日</h5><p>{day.logicalStartUtc.slice(0,10)} 至 {day.logicalEndUtc.slice(0,10)}</p>
        <dl style={{margin:0,fontVariantNumeric:'tabular-nums'}}>{day.after.map((v,i)=><div key={day.fields[i]}
          style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',columnGap:'0.5rem',padding:'0.3rem 0',borderTop:'1px solid #e7edf3'}}>
          <dt>{fieldNames[day.fields[i]]??day.fields[i]}（{day.units[i]}）</dt><dd style={{margin:0}}>{printed(day.before[i])} → {printed(v)}</dd>
        </div>)}</dl>
      </article>)}
    </div>
    {rolling&&<p><strong>第 2 至 3 日滚动天气预算</strong>　共 {rolling.total} 次，已占用 {rolling.reserved} 次，已提交 {rolling.committed} 次，可再预测 {rolling.remaining} 次。{label[rolling.status]??rolling.status}。
      {rolling.terminal&&<> 退出码 {rolling.terminal.exitCode}，退出记录时间 {rolling.terminal.finishedUtc}。</>}</p>}
    <details><summary>逐日存档、模型和进程证据</summary>
      {head.days.map(day=><section key={day.tick}><h5>模拟第 {day.tick} 日</h5><p>事件游标 {day.cursor} · 状态版本 {day.stateVersion} · 实际保存 {day.savedAtUtc}</p>
        <p>存档 {day.fileSha256}<br/>事件 {day.eventSha256}<br/>前序事件 {day.previousEventSha256}<br/>收据 {day.receiptSha256}</p>
        {day.modelPid&&<p>服务器 PID {day.serverPid} · 模型 PID {day.modelPid} · 受管耗时 {day.workerMs} ms<br/>
          七日输入数值 {day.historyValueSha256}<br/>输入文件 {day.inputSha256}<br/>输出文件 {day.outputSha256}<br/>模型 {day.modelSha256}<br/>进程回执 {day.nativeProofSha256}</p>}
      </section>)}
      {rolling?.releaseVerifiedAtUtc&&<p>发布资格上次完整核验 {rolling.releaseVerifiedAtUtc}。30 秒内可复用完整核验结果，本次读取另行核对发布及注册表摘要、生命周期、事件与存档。</p>}
    </details>
    <p>这里记录服务器天气与存档。游戏画面的发布和玩家访问资格分别核验。</p>
  </section>
}
