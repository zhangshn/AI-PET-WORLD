import 'server-only'
import path from 'node:path'
import { ledger } from './service'
import { createWorkEvidenceReader } from './work-evidence.mjs'
export function workEvidence(){const records=ledger();return createWorkEvidenceReader({runtimeRoot:path.resolve(process.cwd(),'.runtime'),ledger:records})}
