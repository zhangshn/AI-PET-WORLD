import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { auditProjectDependencies, findDependencyCycles } from '../lib/project-dependency-audit.mjs'

function loaderFixture(t, text) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'project-loader-binding-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('project-loader-binding-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, { recursive: true })
  })
  fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'scripts'))
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
    allowJs: true, module: 'esnext', moduleResolution: 'bundler',
  } }))
  fs.writeFileSync(path.join(root, 'src', 'entry.mjs'), text + "\nthrow Error('audit must not execute source');")
  fs.writeFileSync(path.join(root, 'src', 'target.mjs'), "export const target = true; throw Error('audit must not execute target');")
  return auditProjectDependencies({ root })
}

test('dependency scan distinguishes a const local require function from module loading', t => {
  const result = loaderFixture(t, "const require = (condition, message) => { if (!condition) throw Error(message) }; require(flag, 'rule'); require('./not-a-module');")
  assert.equal(result.edgeCount, 0)
  assert.deepEqual(result.computedImports, [])
  assert.deepEqual(result.unresolved, [])
  assert.equal(result.localRequireCalls.length, 2)
})

for (const [name, declaration] of [
  ['named factory alias', "import { createRequire as factory } from 'node:module'; const load = factory(import.meta.url);"],
  ['namespace factory', "import * as module from 'node:module'; const load = module.createRequire(import.meta.url);"],
  ['default module factory', "import module from 'module'; const load = module.createRequire(import.meta.url);"],
]) test(`dependency scan follows ${name} without executing it`, t => {
  const result = loaderFixture(t, declaration + "load('./target.mjs'); load(selectedModule);")
  assert.equal(result.graph['src/entry.mjs'].length, 1)
  assert.equal(result.graph['src/entry.mjs'][0].to, 'src/target.mjs')
  assert.equal(result.computedImports.length, 1)
  assert.equal(result.computedImports[0].expression, 'selectedModule')
})

test('require shadowing is scoped and does not hide outer loading or nested import', t => {
  const result = loaderFixture(t, "import {createRequire} from 'node:module'; const require=createRequire(import.meta.url); require('./target.mjs'); function check(){const require=()=>import(chosen); require('./not-a-module')} require(selected);")
  assert.equal(result.graph['src/entry.mjs'][0].to, 'src/target.mjs')
  assert.deepEqual(result.computedImports.map(row => row.expression).sort(), ['chosen', 'selected'])
  assert.deepEqual(result.unresolved, [])
  assert.equal(result.localRequireCalls.length, 1)
})

test('a mutable require binding is retained conservatively as a possible loader', t => {
  const result = loaderFixture(t, "let require=()=>{}; require=unknownLoader; require('./target.mjs');")
  assert.equal(result.graph['src/entry.mjs'][0].to, 'src/target.mjs')
  assert.equal(result.localRequireCalls.length, 0)
})

test('a locally shadowed factory is not confused with its imported namesake', t => {
  const result = loaderFixture(t, "import {createRequire} from 'node:module'; function check(createRequire){const load=createRequire('unused'); load('./not-a-module')} const load=createRequire(import.meta.url); load('./target.mjs');")
  assert.equal(result.edgeCount, 1)
  assert.equal(result.graph['src/entry.mjs'][0].to, 'src/target.mjs')
  assert.deepEqual(result.unresolved, [])
})

test('dependency scan follows an immediately invoked native createRequire result', t => {
  const result = loaderFixture(t, "import {createRequire as factory} from 'node:module'; factory(import.meta.url)('./target.mjs');")
  assert.equal(result.graph['src/entry.mjs'][0].to, 'src/target.mjs')
})

for (const name of ['require', 'load']) test(`unknown factory base is reported without guessing a relative target: ${name}`, t => {
  const result = loaderFixture(t, `import {createRequire} from 'node:module'; const ${name}=createRequire(selectedBase); ${name}('./target.mjs');`)
  assert.equal(result.edgeCount, 0)
  assert.equal(result.computedImports.length, 1)
  assert.equal(result.computedImports[0].reason, 'createRequire_base_not_current_source')
})

test('a native loader alias participates in real cycle detection', t => {
  const result = loaderFixture(t, "import {createRequire} from 'node:module'; const load=createRequire(import.meta.url); load('./entry.mjs');")
  assert.deepEqual(result.staticCycles, [['src/entry.mjs']])
})

test('duplicate runtime import bindings fail source validation without evaluating modules', t => {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, 'project-import-bindings-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('project-import-bindings-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, { recursive: true })
  })
  fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'scripts'))
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { allowJs: true, module: 'esnext', moduleResolution: 'bundler' } }))
  const put = (name, text) => fs.writeFileSync(path.join(root, 'src', name), text)
  put('base.mjs', "export const a = 1, b = 2; export default 1; throw Error('must never execute');")
  put('named.mjs', "import {a as shared} from './base.mjs'; import {b as shared} from './base.mjs';")
  put('default.mjs', "import shared from './base.mjs'; import * as shared from './base.mjs';")
  put('typed.ts', "import type {Kind} from './base.mjs'; import {a as Kind} from './base.mjs';")
  const result = auditProjectDependencies({ root })
  assert.deepEqual(result.parseErrors.map(e => e.file).sort(), ['src/default.mjs', 'src/named.mjs'])
  assert(result.parseErrors.every(e => /Duplicate runtime import binding/u.test(e.message)))
  put('named.mjs', "import {a as shared} from './base.mjs'; import {b as other} from './base.mjs';")
  put('default.mjs', "import shared from './base.mjs'; import * as other from './base.mjs';")
  assert.deepEqual(auditProjectDependencies({ root }).parseErrors, [])
})

test('cycle check distinguishes deferred cycles and reports self imports', () => {
  const graph = { a: [{ to: 'b', kind: 'static' }], b: [{ to: 'a', kind: 'deferred' }], self: [{ to: 'self', kind: 'static' }] }
  assert.deepEqual(findDependencyCycles(graph), [['self']])
  assert.deepEqual(findDependencyCycles(graph, true), [['a', 'b'], ['self']])
})

test('source audit follows configured exact and wildcard aliases beyond @/',t=>{
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'project-dependency-alias-'))
  t.after(()=>{assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('project-dependency-alias-'));assert.equal(fs.realpathSync(root),root);assert(!fs.lstatSync(root).isSymbolicLink());fs.rmSync(root,{recursive:true})})
  fs.mkdirSync(path.join(root,'src','feature','b'),{recursive:true});fs.mkdirSync(path.join(root,'scripts'));fs.mkdirSync(path.join(root,'.runtime'))
  const put=(file,source)=>fs.writeFileSync(path.join(root,file),source)
  put('tsconfig.json',JSON.stringify({compilerOptions:{allowJs:true,moduleResolution:'bundler',module:'esnext',baseUrl:'.',paths:{'#*':['src/unused/*'],'#feature/*/public':['src/feature/*/public.ts'],entry:['src/missing.ts','src/a.ts'],'private-*':['src/unused/*'],'private-evidence':['.runtime/proof.mjs'],'visual-theme':['src/missing.css','src/theme.css']}}}))
  put('src/a.ts',"import '#feature/b/public'; import '#feature/missing/public'; import 'private-evidence'; import 'visual-theme'; export const a=1; throw Error('must not execute');")
  put('src/feature/b/public.ts',"export { a } from 'entry';")
  put('.runtime/proof.mjs',"throw Error('must not execute historical proof');")
  put('src/theme.css','.fixture {color:blue}')
  const result=auditProjectDependencies({root})
  assert.deepEqual(result.staticCycles,[['src/a.ts','src/feature/b/public.ts']])
  assert.equal(result.runtimeEvidenceImports.length,1);assert.equal(result.runtimeEvidenceImports[0].resolved,'.runtime/proof.mjs')
  assert.equal(result.assetImports.length,1);assert.equal(result.assetImports[0].resolved,'src/theme.css')
  assert.equal(result.unresolved.length,1);assert.equal(result.unresolved[0].specifier,'#feature/missing/public')
  assert.equal(result.parseErrors.length,0)
})

test('source audit recognizes the same physical source with different import casing',t=>{
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'project-dependency-case-'))
  t.after(()=>{assert.equal(path.dirname(root),parent);assert(path.basename(root).startsWith('project-dependency-case-'));assert.equal(fs.realpathSync(root),root);assert(!fs.lstatSync(root).isSymbolicLink());fs.rmSync(root,{recursive:true})})
  fs.mkdirSync(path.join(root,'src'));fs.mkdirSync(path.join(root,'scripts'))
  const put=(file,source)=>fs.writeFileSync(path.join(root,file),source)
  put('tsconfig.json',JSON.stringify({compilerOptions:{allowJs:true,moduleResolution:'bundler',module:'esnext'}}))
  put('src/a.mjs',"import './B.mjs'; export const a=1; throw Error('must not execute');")
  put('src/b.mjs',"import './a.mjs'; export const b=1;")
  if(!fs.existsSync(path.join(root,'src/B.mjs'))){t.skip('filesystem is case-sensitive');return}
  const result=auditProjectDependencies({root})
  assert.deepEqual(result.staticCycles,[['src/a.mjs','src/b.mjs']]);assert.equal(result.edgeCount,2)
  assert.equal(result.outsideSourceImports.length,0);assert.equal(result.unresolved.length,0)
})

test('source audit includes JSX and explicit ESM/CommonJS TypeScript in cycles and syntax diagnostics', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-dependency-extension-'))
  t.after(() => {
    const resolved = fs.realpathSync(root)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert(path.basename(resolved).startsWith('project-dependency-extension-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'scripts'))
  const put = (file, source) => fs.writeFileSync(path.join(root, file), source)
  put('tsconfig.json', JSON.stringify({ compilerOptions: { allowJs: true, jsx: 'react-jsx', moduleResolution: 'bundler', module: 'esnext' } }))
  for (const extension of ['jsx', 'mts', 'cts']) {
    put(`src/a.${extension}`, `import './b.${extension}'; export const value = 1; throw Error('must not execute');`)
    put(`src/b.${extension}`, extension === 'cts'
      ? "require('./a.cts'); export const other = 2;"
      : `export { value } from './a.${extension}';${extension === 'jsx' ? 'export const view = <div />;' : ''}`)
  }
  const result = auditProjectDependencies({ root })
  assert.equal(result.files, 6)
  assert.equal(result.edgeCount, 6)
  assert.deepEqual(result.staticCycles, ['cts', 'jsx', 'mts'].map(extension => [`src/a.${extension}`, `src/b.${extension}`]))
  assert.equal(result.unresolved.length, 0)
  assert.equal(result.outsideSourceImports.length, 0)
  assert.equal(result.parseErrors.length, 0)
  for (const extension of ['jsx', 'mts', 'cts']) put(`src/bad.${extension}`, 'export const = ;')
  assert.deepEqual(auditProjectDependencies({ root }).parseErrors.map(row => row.file).sort(), ['src/bad.cts', 'src/bad.jsx', 'src/bad.mts'])
})

test('actual source scan handles aliases, re-exports, type-only imports, require and unresolved expressions without execution', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-dependency-test-'))
  t.after(() => {
    const resolved = fs.realpathSync(root)
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()))
    assert(path.basename(resolved).startsWith('project-dependency-test-'))
    fs.rmSync(resolved, { recursive: true })
  })
  fs.mkdirSync(path.join(root, 'src'))
  fs.mkdirSync(path.join(root, 'scripts'))
  const put = (name, value) => fs.writeFileSync(path.join(root, name), value)
  put('tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] }, allowJs: true } }))
  put('src/a.ts', "export { value } from '@/b'; throw Error('must not execute');")
  put('src/b.ts', "import type { Kind } from './a'; export const value = 1; import('./a');")
  put('src/c.ts', "import { type Kind } from './a'; export type { Kind as Alias } from './b'; require('./d');")
  put('src/d.ts', "import e = require('./e'); require(variable); import('./missing');")
  put('src/e.ts', "export { value } from './c';")
  const result = auditProjectDependencies({ root })
  assert.deepEqual(result.staticCycles, [['src/c.ts', 'src/d.ts', 'src/e.ts']])
  assert.deepEqual(result.includingDeferredCycles, [['src/a.ts', 'src/b.ts'], ['src/c.ts', 'src/d.ts', 'src/e.ts']])
  assert.equal(result.typeOnly.length, 3)
  assert.equal(result.unresolved.length, 1); assert.equal(result.unresolved[0].specifier, './missing')
  assert.equal(result.computedImports.length, 1)
  assert.equal(result.parseErrors.length, 0)
  fs.mkdirSync(path.join(root, '.runtime'))
  put('.runtime/old.mjs', "throw Error('historical evidence must not execute');")
  put('src/styles.css', '.example { color: blue; }')
  put('src/assets.ts', "import './styles.css'; import '@/styles.css'; import './missing.css'; import '../.runtime/old.mjs'; import '../.runtime/missing.mjs';")
  const withAssets = auditProjectDependencies({ root })
  assert.equal(withAssets.assetImports.length, 2)
  assert.equal(withAssets.runtimeEvidenceImports.length, 2)
  assert.equal(withAssets.runtimeEvidenceImports[0].resolved, '.runtime/old.mjs')
  assert(withAssets.unresolved.some(e => e.specifier === './missing.css'))
  put('src/bad.ts', 'export const = ;')
  assert(auditProjectDependencies({ root }).parseErrors.some(e => e.file === 'src/bad.ts'))
  assert.throws(() => auditProjectDependencies({ root, roots: ['../outside'] }), /outside project/u)
})
