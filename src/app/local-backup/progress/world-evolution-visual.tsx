'use client'

import {useState} from 'react'
import Link from 'next/link'
import type {WorldEvolutionProjection, WorldEvolutionStep} from './world-evolution-types'
import styles from './world-evolution-visual.module.css'

const metrics = [
  {key: 'temperature', title: '温度', unit: '°C', color: '#ba631e'},
  {key: 'humidity', title: '空气湿度', unit: '%', color: '#2777b5'},
  {key: 'precipitation', title: '降水', unit: 'mm/day', color: '#328b80'},
  {key: 'windSpeed', title: '风速', unit: 'm/s', color: '#7557aa'},
] as const
const number = (value: number) => Number(value.toPrecision(6)).toString()
const date = (value: string) => value.slice(0, 10)
const stamp = (value: string | null) => value ? value.replace('T', ' ').replace('Z', ' UTC') : '原记录未提供'

function Trend({steps, selected, metric}: {steps: WorldEvolutionStep[]; selected: WorldEvolutionStep; metric: typeof metrics[number]}) {
  const values = steps.map(step => step.values[metric.key])
  const low = Math.min(...values), high = Math.max(...values), span = high - low
  const y = (value: number) => span === 0 ? 68 : 112 - (value - low) / span * 88
  const x = (index: number) => steps.length === 1 ? 180 : 48 + index / (steps.length - 1) * 264
  const points = steps.map((step, index) => `${x(index)},${y(step.values[metric.key])}`).join(' ')
  return <article className={styles.metric} style={{borderTopColor: metric.color}}>
    <header><h5>{metric.title}</h5><span>{metric.unit}</span></header>
    <p className={styles.metricValue}>{number(selected.values[metric.key])}<small>第 {selected.step} 步</small></p>
    <svg viewBox="0 0 352 150" role="img" aria-label={`${metric.title}已记录趋势，单位${metric.unit}；${steps.map(step => `第${step.step}步${number(step.values[metric.key])}`).join('，')}`}>
      <line x1="48" y1="24" x2="312" y2="24" className={styles.grid}/><line x1="48" y1="112" x2="312" y2="112" className={styles.grid}/>
      <text x="48" y="15" className={styles.axis}>{number(high)}</text><text x="48" y="129" className={styles.axis}>{number(low)}</text>
      <polyline points={points} fill="none" stroke={metric.color} strokeWidth="2.5"/>
      {steps.map((step, index) => <g key={step.step}><circle cx={x(index)} cy={y(step.values[metric.key])} r={step.step === selected.step ? 6 : 3.5} fill={step.step === selected.step ? metric.color : '#fff'} stroke={metric.color} strokeWidth="2"><title>第 {step.step} 步：{number(step.values[metric.key])} {metric.unit}</title></circle><text x={x(index)} y="145" textAnchor="middle" className={styles.axis}>第 {step.step} 步</text></g>)}
    </svg>
  </article>
}

export function WorldEvolutionVisual({data, compact = false}: {data?: WorldEvolutionProjection; compact?: boolean}) {
  const [selectedStep, setSelectedStep] = useState<number | null>(null)
  const available = data?.status === 'verified_record' && data.steps.length > 0
  const steps = available ? data.steps : []
  const selected = steps.find(step => step.step === selectedStep) ?? steps.at(-1)
  const currentIndex = selected ? steps.indexOf(selected) : -1
  const workHref = data?.workHref?.startsWith('/local-backup/work/codex-') ? data.workHref : null
  const commits = steps.filter(step => step.committed).length
  return <section className={styles.panel} id="world-evolution-visual" aria-label="世界后台图形化进展" data-testid="world-evolution-visual">
    <header className={styles.header}><div><p className={styles.eyebrow}>世界后台 · 已完成记录</p><h4>看看世界是怎样继续变化的</h4></div><span className={styles.badge}>历史联调回放 · 隔离世界</span></header>
    <p className={styles.intro}>读取保存的历史，让模型计算下一步，再把变化保存下来。下方展示真实记录，切换步骤不会启动模型或推进世界。</p>
    {!available || !selected ? <div className={styles.unavailable} role="status"><strong>{data?.label ?? '尚未接入可展示的演化记录'}</strong><p>{data?.reason ?? '当前没有已绑定的历史联调数据，暂不绘制趋势。'}</p>{data?.status === 'verified_record' && <p>记录中缺少可展示的步骤，暂不绘制趋势。</p>}</div> : <>
      <div className={styles.summary}>
        <article><span>本次副本已保存</span><strong>{commits}<small>步变化</small></strong><p>{data.checks?.independentReadback ? '已由独立进程读回' : '独立读回未确认'}</p></article>
        <article><span>实际执行耗时</span><strong>{data.elapsedSeconds === null ? '未记录' : number(data.elapsedSeconds)}<small>{data.elapsedSeconds === null ? '' : '秒'}</small></strong><p>逻辑日期与现实耗时分开</p></article>
        <article className={styles.formal}><span>正式世界当前状态</span><strong>{data.formalTick === null ? '不可核验' : `已推进 ${data.formalTick} 步`}</strong><p>副本联调不等于正式世界已运行</p></article>
      </div>
      <div className={styles.replayHeader}><div><h5>选择已经发生的一步</h5><p>模拟逻辑区间 · UTC；不是现实已经运行的天数</p></div><span>正在查看第 {selected.step} 步</span></div>
      <div className={styles.timeline} aria-label="已记录步骤选择">{steps.map(step => <button type="button" key={step.step} aria-pressed={selected.step === step.step} onClick={() => setSelectedStep(step.step)} className={selected.step === step.step ? styles.selectedStep : styles.stepButton}><span>第 {step.step} 步</span><strong>{date(step.logicalStartUtc)} → {date(step.logicalEndUtc)}</strong><small>{step.committed ? '已保存' : '未提交'} · 使用 {step.historyEvents} 条已保存历史</small></button>)}</div>
      <div className={styles.controls}><button type="button" disabled={currentIndex <= 0} onClick={() => setSelectedStep(steps[currentIndex - 1].step)}>← 上一步记录</button><p aria-live="polite">第 {selected.step} 步：{selected.committed ? '变化已保存' : '变化未提交'}，输入包含 {selected.historyEvents} 条本副本已提交历史。</p><button type="button" disabled={currentIndex >= steps.length - 1} onClick={() => setSelectedStep(steps[currentIndex + 1].step)}>下一步记录 →</button></div>
      <ol className={styles.flow} aria-label="本步后台处理过程">
        <li><span>01</span><strong>读取世界</strong><p>当前状态＋{selected.historyEvents} 条已提交历史</p></li>
        <li><span>02</span><strong>模型计算</strong><p>生成温度、湿度、降水和风速</p></li>
        <li><span>03</span><strong>校验结果</strong><p>核对输入、输出与世界身份</p></li>
        <li><span>04</span><strong>保存变化</strong><p>{selected.committed ? '状态和事件已一起保存' : '本步未提交'}</p></li>
        <li><span>05</span><strong>{currentIndex < steps.length - 1 ? '下一步接续' : '本轮记录结束'}</strong><p>{currentIndex < steps.length - 1 ? '新进程读取本次已保存结果' : '后续正式运行仍需接入'}</p></li>
      </ol>
      <h5 className={styles.chartHeading}>环境实际改变了多少</h5>
      <p className={styles.chartNote}>各图独立纵轴与单位，折线连接已记录数值，不表示两步之间发生过额外计算。</p>
      <div className={styles.charts}>{metrics.map(metric => <Trend key={metric.key} steps={steps} selected={selected} metric={metric}/>)}</div>
      <div className={styles.checks}>
        <article><span className={data.checks?.historyAffectsOutput ? styles.pass : styles.pending}>{data.checks?.historyAffectsOutput ? '对照已通过' : '对照未确认'}</span><h5>模型用到了过去的数据吗？</h5><p>只改变过去一行的环境数值，查看预测是否变化。{data.checks?.historyAffectsOutput ? '本次结果：预测随之变化。' : '当前记录未确认通过。'}</p></article>
        <article><span className={data.checks?.metadataUnchanged ? styles.pass : styles.pending}>{data.checks?.metadataUnchanged ? '对照已通过' : '对照未确认'}</span><h5>说明文字会干扰结果吗？</h5><p>只改变说明文字，数值输入不变。{data.checks?.metadataUnchanged ? '本次结果：预测完全相同。' : '当前记录未确认通过。'}</p></article>
      </div>
      <p className={styles.boundary}>这里证明的是环境数值历史参与了计算；不是完整世界记忆、正式服务器持续运行或游戏画面验收。</p>
      {data.next.length > 0 && <details className={styles.next} open={!compact}><summary>接下来还要完成什么</summary><ol>{data.next.map((item, index) => <li key={index}>{item}</li>)}</ol></details>}
    </>}
    <footer className={styles.footer}><span>记录完成：{stamp(data?.completedAtUtc ?? null)}</span><span>页面读取：{stamp(data?.readAtUtc ?? null)}</span>{workHref && <Link href={workHref}>查看这次工作的详细记录 ↗</Link>}</footer>
    {data && <details className={styles.evidence}><summary>查看来源与核验信息</summary><p>{data.label}：{data.reason}</p><p>副本世界：{data.worldId ?? '未提供'}<br/>正式世界：{data.formalWorldId ?? '未提供'}<br/>运行：{data.runId ?? '未提供'}</p><p>原核验时间：{stamp(data.observedAtUtc)}</p><ul>{data.sources.map(source => <li key={source.path}><span>{source.path}</span><code>SHA-256 {source.sha256}</code></li>)}</ul></details>}
  </section>
}
