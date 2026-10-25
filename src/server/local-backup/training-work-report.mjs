// Deterministic display templates for already-bound terminal facts. This is not
// a diagnostic engine, a reviewer, or an execution/qualification authority.
export function trainingTerminalKind(value) {
  const schema=value.schema??value.schemaVersion
  if(schema==='object-support-structure-quality-worker-terminal-v1') {
    if(value.status==='training_completed_review_pending'&&value.executionState==='completed')return {type:'training',result:'succeeded',title:'本地训练执行完成（审核另记）'}
    if(value.status==='failed_closed'&&value.executionState==='failed_closed')return {type:'training',result:'failed',title:'本地训练失败关闭（原首错保留）'}
  }
  if(schema==='object-support-structure-review-failure-v1'&&value.status==='review_execution_failed_closed')return {type:'review',result:'failed',title:'本地审核执行失败'}
  if(schema==='completed-training-independent-review-v1') {
    if(['review_prelaunch_program_failed_closed','review_execution_failed_closed','review_failure_cleanup_unknown_active_retained'].includes(value.status))return {type:'review',result:'failed',title:'本地独立审核程序失败'}
    if(['dry_single_world_review_failed_closed','dry_single_world_numeric_passed_visual_approval_pending'].includes(value.status))return {type:'review',result:'succeeded',title:'本地独立审核已产出结论（资格另记）',audit:true}
  }
  if(schema==='object-support-structure-machine-audit-core-v1'&&['dry_single_world_review_failed_closed','dry_single_world_numeric_passed_visual_approval_pending'].includes(value.status))return {type:'review',result:'succeeded',title:'本地机器审核已产出结论（资格另记）',audit:true,core:true}
  return null
}
const integer=value=>Number.isSafeInteger(value)&&value>=0?String(value):'未知'
const flag=value=>value===true?'已记录执行':value===false?'未执行':'未知'
function errorText(value) {
  if(!value)return '未记录；不据此断言没有错误'
  // Do not publish arbitrary exception text, stderr, paths or secret digests.
  const type=['ValueError','KeyError','RuntimeError','TimeoutError','TypeError','Error'].includes(value.type??value.errorType)?value.type??value.errorType:'类型未映射'
  const message=typeof value.message==='string'&&/^actual four-term total gradient identity differs at parameter \d{1,4}$/.test(value.message)?value.message:value.message==="'contribution'"?'缺少 contribution 字段':'原消息仅保留于受限证据，未进入展示模板'
  return type+'；'+message
}
const issueNames={condition_object_footprints_reference_semantic_mismatch:'对象轮廓与留出参考语义不一致',condition_object_tree_reference_semantic_mismatch:'树木与留出参考语义不一致',condition_object_rock_reference_semantic_mismatch:'岩石与留出参考语义不一致',condition_object_vegetation_reference_semantic_mismatch:'植被与留出参考语义不一致',validation_not_improved_without_mean_rgb_regression:'未满足验证改善且平均RGB不退化的要求'}
export function describeTrainingTerminal({input,terminal,kind,preview=null,core=null,supplementGaps=[]}) {
  const failedTraining=kind.type==='training'&&kind.result==='failed',reviewFailed=kind.type==='review'&&!kind.audit
  const impact=failedTraining?'业务影响：本轮训练失败关闭，不能以已完成轮数或已保存现场冒充完整训练、Checkpoint选择、固定验证或画质审核完成。':reviewFailed?'业务影响：审核程序未完成；审核执行失败与模型视觉拒绝是不同结论。':kind.audit?'业务影响：本地审核报告已保存；报告中的未通过或部分数值通过不授予Stage4、Runtime或模型发布资格。':'业务影响：训练执行完成；后续审核、模型质量及能力发布必须分别核对。'
  const issues=[impact,'原终态状态：'+terminal.status,'技术首错：'+errorText(terminal.originalError??terminal.captureReceipt?.primaryError),
    '次生采集错误（不替换首错）：'+errorText(terminal.captureReceipt?.secondaryCaptureFailure),
    '次生预览错误（不替换首错）：'+errorText(preview?.secondaryError),
    ...supplementGaps,'修复状态：此事件只投影原终态；没有执行修复、重训或补造旧图。修复与总控独立复核须由各自生产者另记同一Run。',
    '未验证：完整模型资格、Stage4、Runtime发布和总控独立复核不由本条事件签发。']
  if(core) {
    if(Array.isArray(core.issueCodes)&&core.issueCodes.length<=48)issues.push(...core.issueCodes.map((code,i)=>'机器审核问题 '+(i+1)+'：'+(typeof code==='string'&&Object.hasOwn(issueNames,code)?issueNames[code]:'问题码未映射；原文保留于审核证据')))
    else issues.push('机器审核问题列表缺失或超限；详细问题覆盖保持未知。')
  }
  const position=terminal.failurePosition
  if(position)issues.push('失败位置：epoch '+integer(position.epoch)+' / trainIndex '+integer(position.trainIndex)+' / epoch位置 '+integer(position.zeroBasedEpochPosition)+'；样本身份见原终态证据。')
  return {title:input.title,objective:'按Run保存本地训练、审核及问题的业务与技术说明，不改变原程序结论。',reason:'真实终态已有可核对证据；用户无需填写日报，程序事实与Codex独立复核分别留存。',actions:['沿已提交登记及显式SHA绑定读取终态、执行包和适用的关联证据；不扫描运行目录或聊天。','分别记录训练执行、审核程序执行和审核发现；不把失败关闭或退出码改写为画质结论。','保存原始时间与单调耗时；缺失保持未知，详细记录按同一Run追加且幂等。'],changes:input.evidenceReferences.map(e=>({path:e.logicalPath,description:'本次已核对摘要的台账证据副本；原机器记录保持。'})),checks:[{command:null,status:'passed',description:'终态来源、执行包及已列证据摘要/身份核对；仅为台账接入检查，不是重新训练或重新审核。'},{command:null,status:'not_run',description:'台账未执行GPU、训练、数值复算、修复、实际备份或发布。'}],results:[impact,'训练进度：已完成轮数 '+integer(terminal.completedEpochs)+'；G更新 '+integer(terminal.optimizerSteps?.generator??terminal.optimizerStepsGenerator)+'；D更新 '+integer(terminal.optimizerSteps?.discriminator??terminal.optimizerStepsDiscriminator)+'。','Checkpoint选择：'+flag(terminal.checkpointSelectionExecuted)+'；严格重载：'+flag(terminal.checkpointReloadVerified)+'。',...(core?['机器审核原结论：'+core.status+'；机器验收字段保持未知，不能仅凭报告状态授予资格。']:[]),'关联Run：'+input.runId+'；本地程序来源不包含总控Codex复核。'],issues,nextSteps:['后续修复、未验证项和总控复核通过既有CLI提交同一runId及真实证据；不覆盖原失败，也不以此建议启动执行。'],planComparison:'引用唯一模块计划的实际摘要；本条记录既有训练/审核事实，不改变学习目标、门限、资格或执行范围。'}
}
