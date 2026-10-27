import { readFileSync } from 'node:fs'
import ts from 'typescript'
import {createRequire} from 'node:module'

const source = readFileSync(new URL('../../../src/app/ai-console/ai-console-training-time.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
export const trainingTime = {}
new Function('exports', code)(trainingTime)
const nativeRequire=createRequire(import.meta.url)
const viewSource=readFileSync(new URL('../../../src/app/ai-console/ai-console-experiment-time.tsx',import.meta.url),'utf8')
const viewCode=ts.transpileModule(viewSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
export const experimentTime={}
new Function('require','exports',viewCode)(name=>name==='./ai-console-training-time'?trainingTime:nativeRequire(name),experimentTime)
