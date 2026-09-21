import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as liveRegistry from '../../../src/server/ai-painter-current-execution-registry.mjs';

// Execute the actual TS projection in CPU checks without producing build files.
// The optional registry double is for isolated unit fixtures, never live checks.
export function loadCurrentExecutionProjectionForCpu(root, registry = liveRegistry) {
  const nativeRequire=createRequire(import.meta.url);
  const compile=(logical,resolve)=>{
    const source=fs.readFileSync(path.resolve(root,logical),'utf8');
    const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
      esModuleInterop:true}}).outputText;
    const exports={};new Function('require','exports',output)(resolve,exports);return exports;
  };
  const contract=compile('src/server/ai-console/projection-contract.ts',id=>{throw new Error(`unexpected projection contract import: ${id}`);});
  return compile('src/server/ai-console/ai-painter-current-execution-projection.ts',id=>{
    if(id==='../ai-painter-current-execution-registry.mjs')return registry;
    if(id==='./projection-contract')return contract;
    if(['node:crypto','node:fs/promises','node:path'].includes(id))return nativeRequire(id);
    throw new Error(`unexpected projection import: ${id}`);
  });
}
