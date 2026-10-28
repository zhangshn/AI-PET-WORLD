const review='.runtime/ai-painter/controller-repair-reviews/'
export const PROGRESS_PLAN='docs/game-world-generation/CURRENT_EXECUTION_GUIDE_20260710.md'
export const PROGRESS_SNAPSHOT='.runtime/local-backup/project-progress/snapshot.json'
// Fixed read inventory. Neither a request nor a snapshot can register a path.
export const PROGRESS_SOURCES=Object.freeze({
 'closure095':{path:review+'natural-world-closure-095-20261027/controller-final-acceptance.json',title:'095 · 训练后候选裁决'},
 'training095':{path:'.runtime/ai-painter/learning-capacity-experiments/replay-retention-balanced-boundary-v1-4ac24b43a75404b1c174/terminal.json',title:'095 · 原训练终态'},
 'reference096':{path:review+'reference-representation-096-20261027/controller-acceptance.json',title:'096 · 参考表示对照'},
 'persistence097':{path:review+'natural-world-runtime-097-20261027/controller-component-acceptance.json',title:'097 · 自然存档组件'},
 'facts098':{path:review+'natural-world-facts-098-20261028/controller-component-acceptance.json',title:'098 · 新世界事实与条件'},
 'input102':{path:review+'natural-world-model-input-102-20261028/controller-component-acceptance.json',title:'102 · 模型输入组件'},
 'probe104':{path:review+'natural-world-model-probe-104-20261028/controller-component-acceptance.json',title:'104 · 新世界原生候选',eventId:'codex-7474043a9ed206fa0f86dae21b59e863c37e1dc2ce3615f339bda7e827c29c3a'},
 'gradient130':{path:review+'native-required-gradient-130-20261028/controller-gpu-acceptance.json',title:'130 · 受限 GPU 实测',eventId:'codex-62c4e248bbda9d5a5497ecd39532689ee3ba6e30fa9a7cb542a19317ee33d3cd'},
 'observer131':{path:review+'native-boundary-observation-131-20261028/implementation/cpu-component-acceptance.json',title:'131 · 观察器 CPU 组件'},
})
export const PROGRESS_STAGES=Object.freeze([
 {id:'world-facts',title:'自然世界事实',moduleIds:['7'],evidence:['facts098'],status:'component_verified'},
 {id:'model-input',title:'23 通道输入',moduleIds:['2','7'],evidence:['input102'],status:'component_verified'},
 {id:'native-compute',title:'原生训练准入',moduleIds:['2'],evidence:['gradient130','observer131'],status:'blocked'},
 {id:'native-training',title:'原生完整训练',moduleIds:['2'],evidence:['training095','gradient130'],status:'not_verified'},
 {id:'visual-quality',title:'画质与语义审核',moduleIds:['2'],evidence:['closure095','reference096','probe104'],status:'blocked'},
 {id:'capability-release',title:'能力与帧发布',moduleIds:['2','7'],evidence:['probe104'],status:'not_verified'},
 {id:'persistence',title:'独立存档恢复',moduleIds:['7'],evidence:['persistence097','facts098'],status:'component_verified'},
 {id:'world-loop',title:'世界演化与重入',moduleIds:['7'],evidence:['persistence097','probe104'],status:'not_verified'},
])
export const PROGRESS_STATUS=Object.freeze({component_verified:'组件核验通过',blocked:'受阻 / 未过门',not_verified:'未验证'})

export function sourceSemantics(id,v){
 switch(id){
 case 'closure095':return v.status==='experiment_completed_candidate_rejected'&&v.decision?.absoluteOutcome==='failed'&&v.formalQualificationGranted===false
 case 'training095':return v.schemaVersion==='ai-painter-learning-capacity-experiment-terminal-v1'&&v.executionState==='completed'&&v.formalTrainingQualified===false&&v.actualFinalOptimizerSteps?.generator===200&&v.actualFinalOptimizerSteps?.discriminator===200
 case 'reference096':return v.status==='reference_comparison_verified_not_qualification'&&v.actualAuditCalls===112
 case 'persistence097':return v.status==='natural_persistence_component_accepted_with_limits'&&v.formalQualificationGranted===false&&v.worldMvpCompleted===false
 case 'facts098':return v.taskId==='NATURAL-WORLD-FACTS-098'&&v.status==='facts_conditions_private_save_restore_component_accepted'
 case 'input102':return v.taskId==='NATURAL-WORLD-MODEL-INPUT-102'&&v.status==='natural_world_model_input_component_accepted'
 case 'probe104':return v.status==='actual_image_and_existing_proxy_review_component_accepted'&&v.modelQualified===false&&v.framePublished===false&&v.mvpAccepted===false
 case 'gradient130':return v.status==='accepted_actual_wall_stop_not_full_qualification'&&v.actualCalls?.gGradientCompletions===4&&v.actualCalls?.gGradientAttempts===5&&v.completeGradientGate==='not_evaluated_missing_objectSupportStructure'
 case 'observer131':return v.taskId==='NATIVE-BOUNDARY-OBSERVATION-131'&&v.status==='passed_observer_CPU_semantics_and_cleanup'&&v.CPUWallNotGPUAcceleration===true
 default:return false
 }
}
