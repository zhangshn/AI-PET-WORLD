import { isActiveUniqueModulePlan } from './unique-module-plan-contract.mjs'

const TRACE_HEADING = '### 17.2 37条稳定需求逐项追踪'
const STATUSES = Object.freeze([
  'document_defined_program_pending',
  'partial_legacy_implementation_not_certified',
  'machine_conformant',
  'superseded',
])
const COLUMNS = ['需求ID', '机器合同绑定', '程序实现绑定', '测试绑定', '运行证据绑定', '当前符合状态']

// Declaration structure only; neither a SHA-shaped reference nor this result
// authenticates machine evidence or grants program/model/release qualification.
export function validateProgramAdoptionDeclaration(text, documentedStatusCounts = null) {
  const failures = []
  const declarations = [...text.matchAll(/^程序符合状态：`([^`]+)`$/gm)]
  const stateLines = [...text.matchAll(/^[ \t]*程序符合状态：.*$/gm)]
  const status = declarations[0]?.[1] ?? null
  if (stateLines.length !== 1 || declarations.length !== 1 || !['program_adoption_pending', 'program_conformant'].includes(status)) {
    failures.push('program adoption declaration must use one supported status')
  }
  const references = [...text.matchAll(/^程序符合证据：`([^`]+)`；SHA-256：`([a-f0-9]{64})`$/gm)]
  const evidenceLines = [...text.matchAll(/^[ \t]*程序符合证据：.*$/gm)]
  if (evidenceLines.length > 1 || evidenceLines.length !== references.length) {
    failures.push('duplicate or malformed program adoption evidence declaration')
  }
  if (status === 'program_conformant') {
    const reference = references[0]
    if (references.length !== 1 || !/^(?:data|\.runtime)\/[A-Za-z0-9_./-]+\.json$/u.test(reference?.[1] ?? '') ||
        reference[1].split('/').some(part => ['.', '..', ''].includes(part))) {
      failures.push('conformant declaration requires one relative machine-summary path and SHA-256 reference')
    }
    if (documentedStatusCounts && (documentedStatusCounts.document_defined_program_pending > 0 ||
        documentedStatusCounts.partial_legacy_implementation_not_certified > 0 ||
        documentedStatusCounts.machine_conformant === 0)) {
      failures.push('whole-document conformant declaration conflicts with incomplete requirement statuses')
    }
  }
  return { failures, declaredProgramAdoption: status, machineEvidenceVerified: false,
    programConformanceCertified: false, modelQualificationGranted: false,
    capabilityReleaseGranted: false, moduleProgressCertified: false }
}

function cellsOf(line) {
  // Keep empty cells so absent bindings cannot shift into another role.
  return line.trim().split(/(?<!\\)\|/u).slice(1, -1).map(cell => cell.trim())
}

// Pure document validation. Declared statuses and textual bindings are
// traceability metadata, never authenticated machine evidence. No .runtime
// reads, qualification inference or requirement/plan mutations belong here.
export function validateAiPainterDocumentState(formalSpec, plan) {
  const failures = []
  const documentedStatusCounts = Object.fromEntries(STATUSES.map(status => [status, 0]))
  if (!isActiveUniqueModulePlan(plan)) failures.push('module plan must retain its active, exclusive role')

  const text = formalSpec.replaceAll('\r\n', '\n')
  const headings = [...text.matchAll(/^### 17\.2 37条稳定需求逐项追踪[ \t]*$/gm)]
  if (headings.length !== 1) {
    failures.push(`${TRACE_HEADING}: expected exactly one traceability section, found ${headings.length}`)
  } else {
    const start = headings[0].index
    const definitions = new Set(text.slice(0, start).match(/AP-[A-Z]+-[0-9]{3}/g) ?? [])
    const tail = text.slice(start + headings[0][0].length)
    const end = tail.search(/^#{1,3} /m)
    const section = end < 0 ? tail : tail.slice(0, end)
    const lines = section.split('\n')
    const headers = lines.filter(line => /^\|\s*需求ID\s*\|/u.test(line))
    if (headers.length !== 1 || JSON.stringify(cellsOf(headers[0])) !== JSON.stringify(COLUMNS)) {
      failures.push('traceability table must declare the six binding/status columns')
    }
    const rows = lines.filter(line => /^\|\s*`?AP-/u.test(line))
    const ids = new Set()
    if (definitions.size !== 37) failures.push(`formal requirement definitions must contain 37 unique IDs, found ${definitions.size}`)
    for (const line of rows) {
      const cells = cellsOf(line)
      const id = cells[0]?.match(/^`(AP-[A-Z]+-[0-9]{3})`$/u)?.[1]
      if (!line.trim().endsWith('|') || cells.length !== COLUMNS.length || !id) {
        failures.push(`invalid six-column traceability row: ${line}`)
        continue
      }
      if (ids.has(id)) failures.push(`duplicate traceability row: ${id}`)
      ids.add(id)
      for (let index = 1; index <= 4; index += 1) {
        if (!cells[index]) failures.push(`${id}: empty ${COLUMNS[index]}`)
      }
      const status = cells[5].match(/^`([^`]+)`$/u)?.[1]
      if (!STATUSES.includes(status)) failures.push(`${id}: invalid traceability status: ${cells[5]}`)
      else documentedStatusCounts[status] += 1
    }
    if (rows.length !== 37 || ids.size !== 37) failures.push(`traceability table must contain 37 unique rows, found ${rows.length}/${ids.size}`)
    for (const id of definitions) if (!ids.has(id)) failures.push(`traceability row missing: ${id}`)
    for (const id of ids) if (!definitions.has(id)) failures.push(`traceability row has no formal definition: ${id}`)
  }

  return {
    failures,
    validationScope: 'normative_document_and_traceability_structure_only',
    documentedStatusCounts,
    machineEvidenceVerified: false,
    programConformanceCertified: false,
    modelQualificationGranted: false,
    capabilityReleaseGranted: false,
    moduleProgressCertified: false,
  }
}
