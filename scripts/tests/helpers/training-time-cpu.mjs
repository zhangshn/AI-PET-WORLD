import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../../../src/app/ai-console/ai-console-training-time.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
export const trainingTime = {}
new Function('exports', code)(trainingTime)
