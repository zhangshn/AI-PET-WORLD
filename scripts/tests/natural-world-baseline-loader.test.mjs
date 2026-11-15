import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {spawnSync} from 'node:child_process'

const loader = new URL('../lib/natural-world-baseline-ts-loader.mjs', import.meta.url).href

function runFixture(t, code, {missingBootstrap = false} = {}) {
  const parent = fs.realpathSync(os.tmpdir())
  const root = fs.mkdtempSync(path.join(parent, 'baseline-loader-root-'))
  t.after(() => {
    assert.equal(path.dirname(root), parent)
    assert(path.basename(root).startsWith('baseline-loader-root-'))
    assert.equal(fs.realpathSync(root), root)
    assert(!fs.lstatSync(root).isSymbolicLink())
    fs.rmSync(root, {recursive: true})
  })
  for (const [directory, marker] of [[root, 'original'], [path.join(root, 'foreign'), 'foreign']]) {
    fs.mkdirSync(path.join(directory, 'src/world/runtime'), {recursive: true})
    for (const file of ['natural-world-bootstrap.ts', 'world-runtime-store-adapter.ts', 'world-runtime-record-validation.ts']) {
      if (missingBootstrap && directory === root && file === 'natural-world-bootstrap.ts') continue
      fs.writeFileSync(path.join(directory, 'src/world/runtime', file), `export const marker=${JSON.stringify(marker)};\n`)
    }
  }
  const driver = `import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
    const {loadNaturalWorldBaselineRuntime:load}=await import(${JSON.stringify(loader)});
    const original=process.cwd(),foreign=path.join(original,'foreign');
    ${code}
    console.log('fixture passed');`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', driver], {cwd: root,
    encoding: 'utf8', windowsHide: true, timeout: 10000})
  assert.equal(result.status, 0, result.stderr)
}

test('a successful cached load cannot bypass validation of a later foreign root', t => {
  runFixture(t, "await load(); await assert.rejects(load(foreign), /baseline_loader_cwd/);")
})

test('an invalid first root does not poison a subsequent valid call', t => {
  runFixture(t, "await assert.rejects(load(foreign), /baseline_loader_cwd/); assert.equal((await load()).bootstrap.marker,'original');")
})

test('a pending cached load cannot bypass validation of another root', t => {
  runFixture(t, "const pending=load(); await assert.rejects(load(foreign), /baseline_loader_cwd/); assert.equal((await pending).bootstrap.marker,'original');")
})

test('equivalent physical roots share the same concurrent loaded result', t => {
  runFixture(t, "const [a,b]=await Promise.all([load(),load(original+'/src/..')]); assert.strictEqual(a,b);")
})

test('changing the working directory never returns modules cached for a different root', t => {
  runFixture(t, `const a=await load(); process.chdir(foreign); const b=await load();
    assert.equal(b.bootstrap.marker,'foreign'); assert.notStrictEqual(a,b);
    await assert.rejects(load(original), /baseline_loader_cwd/);
    process.chdir(original); assert.strictEqual(await load(),a);`)
})

test('a failed import can be retried explicitly after the missing source is restored', t => {
  runFixture(t, `await assert.rejects(load(), {code:'ERR_MODULE_NOT_FOUND'});
    const bootstrap=path.join(original,'src/world/runtime/natural-world-bootstrap.ts');
    assert.equal(fs.existsSync(bootstrap),false);
    fs.writeFileSync(bootstrap,"export const marker='restored';\\n");
    assert.equal((await load()).bootstrap.marker,'restored');`, {missingBootstrap: true})
})


test('actual baseline runtime imports its complete current module graph without writes or dispatch', () => {
  const project = new URL('../../', import.meta.url);
  const driver = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs';
    import fsp from 'node:fs/promises';
    import cp from 'node:child_process';
    import {syncBuiltinESMExports} from 'node:module';
    let forbiddenCalls = 0;
    const deny = () => { forbiddenCalls++; throw new Error('import_only_side_effect'); };
    for (const name of ['writeFile','appendFile','mkdir','rename','rm','rmdir','unlink','copyFile','cp',
      'truncate','chmod','chown','link','symlink','utimes']) {
      if (name in fs) fs[name] = deny;
      if (name+'Sync' in fs) fs[name+'Sync'] = deny;
      if (name in fsp) fsp[name] = deny;
    }
    fs.createWriteStream = deny;
    const readOnly = flags => flags === 'r' || flags === fs.constants.O_RDONLY;
    for (const [target,name] of [[fs,'open'],[fs,'openSync'],[fsp,'open']]) {
      const original=target[name];
      target[name]=function(file,flags,...rest) {
        if (!readOnly(flags)) return deny();
        return original.call(this,file,flags,...rest);
      };
    }
    for (const name of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']) cp[name]=deny;
    syncBuiltinESMExports();
    const {loadNaturalWorldBaselineRuntime:load}=await import(${JSON.stringify(loader)});
    const loaded=await load();
    assert.equal(typeof loaded.bootstrap.createInitialNaturalWorld,'function');
    assert.equal(typeof loaded.facade.readNaturalWorldRuntimeSaveRecord,'function');
    assert.equal(typeof loaded.facade.writeNaturalWorldRuntimeSaveRecord,'function');
    assert.equal(typeof loaded.validation.sealNaturalWorldRuntimeRecord,'function');
    assert.strictEqual(await load(),loaded);
    assert.equal(forbiddenCalls,0);
    console.log('actual runtime import passed with zero write or dispatch attempts');
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',driver],
    {cwd:project,encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/zero write or dispatch attempts/);
});

for (const [label,specifier,relative] of [
  ['unregistered same-directory module','./rogue','src/world/runtime/rogue.ts'],
  ['parent-directory escape','../rogue','src/world/rogue.ts'],
]) test('baseline native loader still rejects '+label,t=>{
  const bootstrapSource = 'import ' + JSON.stringify(specifier) + '; export const marker="original";\n';
  runFixture(t,`
    fs.writeFileSync(path.join(original,${JSON.stringify(relative)}),"export const marker='not-approved';\\n");
    fs.writeFileSync(path.join(original,'src/world/runtime/natural-world-bootstrap.ts'),
      ${JSON.stringify(bootstrapSource)});
    await assert.rejects(load(),/baseline_loader_dependency/);
  `);
});
