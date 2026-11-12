import ts from 'typescript'

const app = 'src/app/ai-console/'
const server = 'src/server/ai-console/'
const shared = 'src/shared/ai-console/'
const namespace = '.runtime/ai-painter/'
const registry = `${namespace}current-execution-registry/current.json`
const packageSchema = 'ai-painter-current-training-package-v1'
const progressSchema = 'ai-painter-current-training-progress-v1'
const policies = 'data/ai-painter/system-governance/'
const prefixReceivers = new Map([
  [`${app}ai-console-experiment-time.tsx`, ['value.sourcePath']],
  [`${shared}ai-console-training-summary-model.ts`, ['directory']],
  [`${server}bound-training-presentation.mjs`, ['outputRoot', 'pkg.outputRoot']],
  [`${server}training-history-independent-review.mjs`, ['pkg.outputRoot']],
  [`${server}training-history-dry-lifecycle.mjs`, ['pkg.outputRoot']],
  [`${server}training-history-system-interruption.mjs`, ['pkg.outputRoot']],
  [`${server}training-history-managed-detail.mjs`, ['pkg.outputRoot', 'boundAutonomous.outputRoot', 'outputRoot']],
  [`${server}training-history-store.mjs`, ['pkg.outputRoot']],
  [`${server}training-observation-contract.mjs`, ['pkg.outputRoot']],
  [`${server}training-preview-history-v1.mjs`, ['root']],
])
const historicalRoots = new Set([
  'decode1-entry-weight-quality-same-call-v1-executions/',
  'object-support-structure-quality-executions/',
  'final-rgb-base-weight-quality-executions/',
  'joint-object-priority-quality-executions/',
  'decode1-entry-weight-quality-executions/',
  'decode1-entry-weight-quality-completion-executions/',
  'decode1-entry-weight-quality-completion-v2-executions/',
].map(value => namespace + value))

function equalRight(node, left, file) {
  const parent = node.parent
  return ts.isBinaryExpression(parent) && parent.right === node
    && parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
    && left.includes(parent.left.getText(file))
}
function startsWith(node, receivers, file) {
  const call = node.parent
  return ts.isCallExpression(call) && call.arguments.length === 1 && call.arguments[0] === node
    && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'startsWith'
    && receivers.includes(call.expression.expression.getText(file))
}
function variable(node, name) {
  return ts.isVariableDeclaration(node.parent) && node.parent.initializer === node
    && ts.isIdentifier(node.parent.name) && node.parent.name.text === name
}
function insideVariable(node, name) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    // A literal in a callback/call is not a static protocol descriptor.
    if (ts.isCallExpression(parent) || ts.isFunctionLike(parent)) return false
    if (ts.isVariableDeclaration(parent)) return ts.isIdentifier(parent.name) && parent.name.text === name
  }
  return false
}
function property(node, name) {
  return ts.isPropertyAssignment(node.parent) && node.parent.initializer === node
    && node.parent.name.getText() === name
}

// These are syntax roles in documented observation readers, not file exemptions.
// A permitted path used as fetch/readFile/import input is still inspected.
function permittedLiteral(node, filePath, file) {
  const value = node.text
  if (value === namespace && startsWith(node, prefixReceivers.get(filePath) ?? [], file)) return 'observation_namespace_check'
  if (filePath === `${app}ai-console-current-execution-store.ts` && value === registry
    && equalRight(node, ['v.sourcePath'], file)) return 'registry_provenance_check'
  if (filePath === `${app}ai-console-current-execution-status.tsx` && value === registry) {
    const parent = node.parent
    if (ts.isBinaryExpression(parent) && parent.right === node
      && parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      && parent.left.getText(file) === 'snapshot?.sourcePath'
      && ts.isJsxExpression(parent.parent)) return 'registry_provenance_display'
  }
  if (filePath === `${server}training-history-evidence-index.mjs` && value === '.runtime/ai-painter'
    && ts.isArrayLiteralExpression(node.parent) && variable(node.parent, 'SCAN_ROOTS')
    && node.parent.elements.length === 2 && node.parent.elements[0] === node
    && ts.isStringLiteral(node.parent.elements[1]) && node.parent.elements[1].text === 'cold/runs') return 'registered_history_scan_root'

  if (filePath === `${server}bound-training-presentation.mjs`) {
    if (value === packageSchema && variable(node, 'OBSERVATION_SCHEMA')) return 'package_schema_definition'
    if (value === progressSchema && ts.isConditionalExpression(node.parent)
      && node.parent.whenTrue === node && node.parent.condition.getText(file) === 'pkg.schemaVersion === OBSERVATION_SCHEMA') return 'progress_schema_selection'
  }
  if ([`${server}training-history-system-interruption.mjs`, `${server}training-history-managed-detail.mjs`, `${server}training-preview-history-v1.mjs`].includes(filePath)) {
    if (value === packageSchema && equalRight(node, ['observation.schemaVersion'], file)) return 'package_schema_check'
    if (value === progressSchema && equalRight(node, ['progress.schemaVersion'], file)) return 'progress_schema_check'
  }
  if (filePath === `${server}training-history-system-interruption.mjs` && value === registry
    && equalRight(node, ['original.path'], file)) return 'historical_registry_binding_check'
  if (filePath === `${server}training-preview-history-v1.mjs`) {
    if ((value === packageSchema && property(node, 'package')) || (value === progressSchema && property(node, 'progress'))) {
      const object = node.parent.parent, call = object.parent
      if (ts.isObjectLiteralExpression(object) && ts.isCallExpression(call)
        && call.expression.getText(file) === 'Object.freeze' && call.arguments.length === 1
        && variable(call, 'TRAINING_INTERFACE_PROTOCOLS')) return 'observation_protocol_definition'
    }
    if (value === policies && startsWith(node,
      ['policy.trainingPreviewPolicy.path', 'policy.progressPublication.componentPolicy.path'], file)) return 'policy_namespace_check'
    if (insideVariable(node, 'POLICY_PROTOCOLS')) {
      if (historicalRoots.has(value) && property(node, 'root')) return 'historical_protocol_root'
      if (new RegExp(`^${policies}ai-painter-training-preview-observation-policy-v[2-9]\\.json$`).test(value)
        && ts.isArrayLiteralExpression(node.parent) && node.parent.elements[0] === node
        && node.parent.elements.length === 2 && ts.isObjectLiteralExpression(node.parent.elements[1])) return 'historical_policy_key'
    }
  }
  if (filePath === `${server}training-history-completion-observation.mjs` && insideVariable(node, 'COMPLETION_PROTOCOLS')) {
    if (historicalRoots.has(value) && property(node, 'root')) return 'historical_completion_root'
    if (new RegExp(`^${policies}ai-painter-decode1-entry-weight-quality-execution-policy-v[2-4]\\.json$`).test(value)
      && property(node, 'policyPath')) return 'historical_completion_policy'
  }
  return null
}

function permittedTemplate(node, filePath, file) {
  if (node.templateSpans.length !== 1) return null
  const span = node.templateSpans[0], expression = span.expression.getText(file)
  if (filePath === `${server}single-map-training-history.mjs`
    && node.head.text === `${namespace}learning-capacity-experiments/` && span.literal.text === ''
    && ((expression === 'registry.runId' && equalRight(node, ['pkg.outputRoot'], file))
      || (expression === 'runId' && equalRight(node, ['request.outputRoot'], file)))) return 'single_map_bound_root_check'
  if (filePath === `${server}training-history-independent-review.mjs`
    && node.head.text === `${namespace}controller-repair-reviews/independent-review-adoption-004-20261022/review-`
    && expression === 'plan.recoveryId' && span.literal.text === ''
    && equalRight(node, ['plan.outputRoot'], file)) return 'independent_review_bound_root_check'
  if (filePath === `${server}training-preview-history-v1.mjs`
    && node.head.text === `${namespace}registered-training-` && expression === 'selector'
    && span.literal.text === '-executions' && equalRight(node, ['policy.outputRoot'], file)) return 'registered_protocol_root_check'
  if (filePath === `${server}training-history-system-interruption.mjs`
    && node.head.text === `${namespace}current-execution-registry/transactions/`
    && expression === 'event.transactionId' && span.literal.text === '/current.staged.json'
    && variable(node, 'snapshotPath')) return 'historical_transaction_snapshot_binding'
  return null
}

function staticString(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(node.left), right = staticString(node.right)
    if (left !== null && right !== null) return left + right
  }
  return null
}

const prohibited = [
  ['legacy_page_route', /ai-painter-progress/u],
  ['legacy_page_api', /\/api\/ai-painter/u],
  ['legacy_page_entry', /current-training/u],
  ['legacy_page_import', /(?:from|import\()[^\n]*(?:ai-painter-progress|aiPainterProgress)/u],
  ['legacy_runtime_source', /(?:\.runtime|data|src)[\\/]ai-painter/u],
]

export function auditAiConsoleSourceBoundary(filePath, source) {
  filePath = filePath.replaceAll('\\', '/')
  const file = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : filePath.endsWith('.css') ? ts.ScriptKind.Unknown : ts.ScriptKind.TS)
  const permissions = [], decodedUnpermitted = []
  function visit(node) {
    const reason = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      ? permittedLiteral(node, filePath, file)
      : ts.isTemplateExpression(node) ? permittedTemplate(node, filePath, file) : null
    if (reason) permissions.push({ start: node.getStart(file), end: node.end, reason })
    else {
      const decoded = staticString(node)
      if (decoded !== null) decodedUnpermitted.push(decoded)
      ts.forEachChild(node, visit)
    }
  }
  // CSS has no protocol literals. Keep its raw checks without a TS parse error.
  if (!filePath.endsWith('.css')) visit(file)
  let inspected = source
  for (const { start, end } of [...permissions].sort((a, b) => b.start - a.start)) {
    inspected = inspected.slice(0, start) + ' '.repeat(end - start) + inspected.slice(end)
  }
  inspected += '\n' + decodedUnpermitted.join('\n')
  const failures = prohibited.filter(([, pattern]) => pattern.test(inspected)).map(([name]) => name)
  if (!filePath.endsWith('.css') && file.parseDiagnostics.length) failures.push('source_parse_error')
  return { failures, permissions }
}
