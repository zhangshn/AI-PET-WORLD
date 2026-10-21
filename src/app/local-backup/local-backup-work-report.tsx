export type WorkReport = {
  title:string;objective:string;reason:string;actions:string[];changes:{path:string;description:string}[]
  checks:{command:string|null;status:'passed'|'failed'|'not_run'|'not_verified';description:string}[]
  results:string[];issues:string[];nextSteps:string[];planComparison:string
}
const checkNames={passed:'通过',failed:'失败',not_run:'未执行',not_verified:'未验证'}
function Items({items}:{items:string[]}) { return items.length?<ol>{items.map((item,index)=><li key={index}>{item}</li>)}</ol>:<p>该报告未提供此项说明。</p> }
export function DetailedWorkReport({report}:{report:WorkReport}) {
  return <details><summary>详细工作报告：{report.title}</summary>
    <h4>目标与原因</h4><p>{report.objective}</p><p>{report.reason}</p>
    <h4>实际做法</h4><Items items={report.actions}/>
    <h4>修改与交付</h4>{report.changes.length?<ul>{report.changes.map((change,index)=><li key={index}><code>{change.path}</code>：{change.description}</li>)}</ul>:<p>此报告未列文件变更，不能据此推断修改了代码。</p>}
    <h4>验证结果</h4>{report.checks.length?<div style={{overflowX:'auto'}}><table style={{minWidth:620}}><thead><tr><th>实际命令</th><th>状态</th><th>范围与说明</th></tr></thead><tbody>{report.checks.map((check,index)=><tr key={index}><td><code>{check.command??'不适用 / 未提供命令'}</code></td><td>{checkNames[check.status]}</td><td>{check.description}</td></tr>)}</tbody></table></div>:<p>未提供验证记录，保持未知。</p>}
    <h4>实际结果</h4><Items items={report.results}/>
    <h4>失败及遗留</h4><Items items={report.issues}/>
    <h4>计划推进和下一步</h4><p>{report.planComparison}</p><Items items={report.nextSteps}/>
  </details>
}
