import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'

// A compiler invocation must not move the live Runtime or consume a legacy
// Owner ticket. Interrupted old build holds require explicit recovery.
export function runProductionBuild({root=process.cwd(),runner=spawnSync,env=process.env}={}) {
  root=path.resolve(root)
  const parent=path.dirname(root)
  if(fs.existsSync(path.join(parent,'.ai-pet-world-runtime-junction-production-build-hold'))
    || fs.readdirSync(parent).some(name=>name.startsWith('.ai-pet-world-production-build-hold--runtime-backup--'))) {
    throw new Error('Interrupted legacy build hold exists; inspect and recover it explicitly before building. No paths were moved.')
  }
  const result=runner(process.execPath,['--max-old-space-size=16384',path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],
    {cwd:root,env,stdio:'inherit',windowsHide:true})
  if(result.error)throw result.error
  return result.status??1
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  process.exitCode=runProductionBuild()
}
