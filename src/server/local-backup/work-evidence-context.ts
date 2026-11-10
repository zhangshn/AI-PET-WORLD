import {runtimeWorkingDirectory,resolveRuntimePath} from '../../../scripts/lib/runtime-working-directory.mjs'
import 'server-only'
import path from 'node:path'
import { ledger } from './service'
import { createWorkEvidenceReader } from './work-evidence.mjs'
export function workEvidence(){const records=ledger();return createWorkEvidenceReader({runtimeRoot:resolveRuntimePath(runtimeWorkingDirectory(),'.runtime'),ledger:records})}
