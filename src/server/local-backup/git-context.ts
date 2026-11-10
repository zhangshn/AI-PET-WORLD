import {runtimeWorkingDirectory} from '../../../scripts/lib/runtime-working-directory.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { store } from './service'
import { createGitService } from './git-service.mjs'
import { publishAndRecord } from './git-recording.mjs'
import { recordGitOperation } from './work-producers.mjs'

export function productionGit() {
  // This verifies the existing registered runtime mapping and module initialization.
  // Neither a browser-supplied repository nor a fixture hook can enter this factory.
  store().inventory()
  const service=createGitService(runtimeWorkingDirectory(),path.join(fs.realpathSync(path.join(runtimeWorkingDirectory(),'.runtime')),'local-backup','git'))
  return {...service,publish:(input:unknown)=>publishAndRecord(service,input,recordGitOperation)}
}
