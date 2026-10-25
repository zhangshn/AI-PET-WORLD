// Stable source positions: the original four IDs must never be reordered.
export const diagramSourceProfiles=Object.freeze([
  ['docs/BUSINESS_SPEC.md','business','project'],
  ['docs/ARCHITECTURE.md','system','project'],
  ['docs/LOCAL_SELF_DEVELOPED_AI_CAPABILITY_AND_CODEX_MIGRATION_ARCHITECTURE.md','subsystem','local-ai'],
  ['docs/ai-console/AI_CONSOLE_ARCHITECTURE_SPEC.md','subsystem','console'],
  ['docs/ai-console/AI_CONSOLE_FORMAL_PRODUCT_AND_INFORMATION_ARCHITECTURE_SPEC.md','system','console'],
  ['docs/ai-console/AI_CONSOLE_INFORMATION_ARCHITECTURE_AND_UI_STANDARD.md','subsystem','console'],
  ['docs/DIRECTORY_STRUCTURE.md','data-flow','governance'],
  ['docs/DOCUMENT_AUTHORITY_INDEX.md','data-flow','governance'],
  ['docs/game-world-generation/AI_PAINTER_FORMAL_IMPLEMENTATION_SPEC.md','subsystem','painter'],
  ['docs/game-world-generation/DOCUMENT_INDEX.md','data-flow','painter'],
  ['docs/game-world-generation/REVIEW_AUTOMATION_AND_STORAGE_SPEC.md','data-flow','painter'],
  ['docs/game-world-generation/TRAINING_DATA_AND_SOURCE_POLICY.md','data-flow','painter'],
  ['docs/ziwei/CONTENT_DATA_DICTIONARY.md','data-flow','ziwei'],
  ['docs/ziwei/DATA_DICTIONARY_ANALYSIS_FLOW.md','subsystem','ziwei'],
  ['docs/ziwei/DATA_DICTIONARY_ARCHITECTURE.md','subsystem','ziwei'],
  ['docs/ziwei/DATA_DICTIONARY_MASTER_BLUEPRINT.md','subsystem','ziwei'],
].map(([path,level,module])=>Object.freeze({path,level,module})))
export const architectureLevels=Object.freeze([{id:'business',label:'业务架构'},{id:'system',label:'系统架构'},{id:'subsystem',label:'子系统架构'},{id:'data-flow',label:'数据与流程'}])
export const architectureModules=Object.freeze([{id:'project',label:'项目全景'},{id:'personality',label:'人格与角色'},{id:'world',label:'世界与Runtime'},{id:'painter',label:'AI Painter'},{id:'local-ai',label:'本地AI与迁移'},{id:'console',label:'AI控制台'},{id:'ziwei',label:'紫微资料与读盘'},{id:'storage',label:'本地数据管理'},{id:'governance',label:'存储与治理'}])
export const panoramaBinding=Object.freeze({documentId:'docs-architecture',section:'2.1 全业务线与子系统导航',type:'mermaid'})
export const textDefinitionReferences=Object.freeze([
  {module:'ziwei',topic:'P0算法来源、参数与排盘规则边界',path:'docs/ziwei/ALGORITHM_CONTRACTS.md',section:'参数定义原则、硬规则来源、固定算法边界'},
  {module:'ziwei',topic:'资料字段及调用字段模型',path:'docs/ziwei/DATA_DICTIONARY_FIELDS.md',section:'字段总原则、通用基础字段'},
  {module:'ziwei',topic:'资料来源、许可及存储资格',path:'docs/ziwei/SOURCE_STORAGE_BOUNDARY.md',section:'来源与存储边界'},
  {module:'storage',topic:'页面、API、服务与固定存储职责',path:'docs/LOCAL_BACKUP_AND_WORK_LEDGER_SPEC.md',section:'2. 职责与架构'},
])
export function classifyDiagram(relativePath,section){
 const profile=diagramSourceProfiles.find(p=>p.path===relativePath)
 let level=profile?.level??'subsystem',moduleId=profile?.module??'project'
 if(relativePath==='docs/BUSINESS_SPEC.md')moduleId=/^2\.1/.test(section)?'personality':/^2\.2|可复用/.test(section)?'world':/^0\.1/.test(section)?'local-ai':'project'
 if(relativePath==='docs/ARCHITECTURE.md'){
  if(/^2\./.test(section)){level='business';moduleId='project'}
  else if(/^3\.1/.test(section)){level='subsystem';moduleId='painter'}
  else if(/^0\./.test(section))moduleId='local-ai'
  else if(/^1\.|^3\.2|^7\./.test(section))moduleId='world'
 }
 return{level,module:moduleId}
}
