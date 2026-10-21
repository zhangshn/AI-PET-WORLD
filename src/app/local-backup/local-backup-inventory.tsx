'use client'
import { useEffect, useState } from 'react'
import styles from './local-backup.module.css'
import { query, reason, time, type Inventory, type CountMap } from './local-backup-shared'
const labels:Record<string,string> = {srcFiles:'src文件',scriptsFiles:'scripts文件',mlFilesExcludingVirtualenvAndCaches:'ml文件（排除虚拟环境/缓存）',dirtyGitEntriesAtPhaseA:'清点时Git改动条目',allDataSubtreeFiles:'data整棵子树文件',hotObservedFiles:'热层已观察文件',hotObservedDirectories:'热层已观察目录',hotRemainingQueuedDirectories:'当次未处理目录',coldObservedFiles:'冷层文件',catalogFiles:'目录数据库文件',hotObservedDatabaseAndSidecarPaths:'数据库及旁路文件路径（含夹具）',catalogObservedFileBytes:'目录数据库已观察字节',targetedConfigurationMetadataRecords:'配置元数据条目',migrationFiles:'迁移目录文件',migrationDirectories:'迁移目录子目录'}
function Counts({values}:{values:CountMap}) { return values ? <dl className={styles.counts}>{Object.entries(values).map(([k,v]) => <div key={k}><dt>{labels[k]??k}</dt><dd>{v.toLocaleString()}</dd></div>)}</dl> : <p className={styles.muted}>数量 / 大小未知</p> }

export function LocalBackupInventoryPanel(){
  const [inventory,setInventory]=useState<Inventory|null>(null),[inventoryError,setInventoryError]=useState(''),[retry,setRetry]=useState(0)
  useEffect(()=>{let active=true;query('/api/local-backup/summary').then(x=>{if(active){setInventory(x.inventory);setInventoryError('')}}).catch(e=>{if(active)setInventoryError(reason(e))});return()=>{active=false}},[retry])
  return <><div className={styles.toolbar}><span>查询已保存的清点记录，不启动重新扫描。</span><button onClick={()=>setRetry(x=>x+1)}>刷新资产记录</button></div>
    <section id="inventory" className={styles.section} aria-labelledby="inventory-title"><div className={styles.sectionTitle}><h2 id="inventory-title">资产分类与覆盖</h2><span className={styles.badge}>部分覆盖</span></div>
      {inventoryError?<p role="alert" className={styles.error}>数据总汇不可用：{inventoryError}</p>:!inventory?<p role="status">读取中…</p>:<>
        <p>清点观察：<strong>{time(inventory.observedAtUtc)}</strong>。全项目文件总数与总字节数：<strong>未知</strong>。分类重叠，以下计数不可相加。</p>
        <ul className={styles.notice}>{inventory.gaps.map(x=><li key={x}>{x}</li>)}</ul>
        <div className={styles.categories}>{inventory.categories.map(c=><article key={c.id}><h3>{c.title}</h3><Counts values={c.counts}/>{c.bytes&&<Counts values={c.bytes}/>}<details><summary>范围与保留规则</summary><p>{c.coverage}</p><p>{c.policy}</p></details></article>)}</div>
        <details><summary>实际根映射与覆盖证据</summary><div className={styles.tableWrap}><table><thead><tr><th>来源</th><th>逻辑根</th><th>实际物理根</th></tr></thead><tbody>{inventory.roots.map(r=><tr key={r.sourceRootId}><td>{r.sourceRootId}</td><td>{r.logicalRoot}</td><td>{r.physicalRoot}</td></tr>)}</tbody></table></div>
          <p>来源报告：<code>{inventory.sourceReport.logicalPath}</code></p><p>报告SHA-256：<code>{inventory.sourceReport.sha256}</code></p>
          <p>报告时间：{time(inventory.sourceReport.observedAtUtc)}。真实根中的链接只登记，不跟随。</p>
        </details>
      </>}
    </section>

{inventory&&<section className={styles.section}><div className={styles.sectionTitle}><h2>备份目标观察</h2><span className={styles.badge}>历史观察</span></div><p><code>{inventory.networkObservation.unc}</code></p><p>空闲 {(inventory.networkObservation.freeBytes/1024**3).toFixed(1)} GiB · {time(inventory.networkObservation.observedAtUtc)}</p><p className={styles.muted}>此值不能证明当前可写或容量足够，也不代表已有可恢复备份。</p></section>}
</>}
