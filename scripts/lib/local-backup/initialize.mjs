import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeStore, safeFile, checkDirectory } from '../../../src/server/local-backup/store.mjs'
import { hash, need, ModuleError } from '../../../src/server/local-backup/contracts.mjs'

// Explicit one-time local operation. GET routes never import or call this initializer.
export function initializeLocalModule(projectRoot = process.cwd()) {
  const expected = path.resolve(process.env.AI_PET_WORLD_DATA_ROOT ?? (process.platform === 'win32' ? 'D:/AI-PET-WORLD-DATA' : path.join(projectRoot, '.ai-pet-world-data')), 'hot/runtime')
  const runtime = path.join(projectRoot, '.runtime')
  need(fs.realpathSync(runtime).toLowerCase() === fs.realpathSync(expected).toLowerCase(), 'runtime_mapping_conflict', 409)
  checkDirectory(expected)
  const reportDirectory = path.join(expected, 'ai-painter/controller-repair-reviews/backup-manual-20261022')
  checkDirectory(reportDirectory)
  const reportPath = path.join(reportDirectory, 'phase-b-report-v2.json')
  safeFile(reportPath, 128 * 1024)
  const bytes = fs.readFileSync(reportPath)
  const expectedSha = '27283d605aca869565ea7f8be975cc01bec233e657f8487b209f257baa2ff47e'
  need(hash(bytes) === expectedSha, 'inventory_source_hash_conflict', 409)
  const report = JSON.parse(bytes.toString())
  const sources = new Map()
  for (const binding of report.evidence) {
    need(/^[a-z0-9-]+\.json$/.test(binding.path), 'inventory_binding_invalid')
    const file = path.join(reportDirectory, binding.path); safeFile(file, 256 * 1024)
    const b = fs.readFileSync(file); need(hash(b) === binding.sha256, 'inventory_binding_conflict', 409)
    sources.set(binding.path, JSON.parse(b.toString().replace(/^\uFEFF/, '')))
  }
  const focused = sources.get('focused-inventory.json')
  const initial = sources.get('phase-a-report.json')
  const inventory = {
    schemaVersion: 'local_backup_inventory_v1',
    sourceReport: { logicalPath: '.runtime/ai-painter/controller-repair-reviews/backup-manual-20261022/phase-b-report-v2.json', sha256: expectedSha, observedAtUtc: report.observedAtUtc },
    observedAtUtc: focused.at,
    coverageComplete: false, categoriesOverlap: true, totalFiles: null, totalBytes: null,
    roots: report.roots.map(r => ({ sourceRootId:r.id, logicalRoot:r.logical, physicalRoot:r.physical, handling:r.handling, coverage:r.coverage })),
    categories: report.categories.map(c => ({ id:c.id,title:c.title,sourceRootIds:c.roots,counts:c.counts,bytes:c.bytes,coverage:c.coverage,policy:c.policy })),
    coverage: report.coverage,
    networkObservation: { unc: initial.network[0].RemotePath, freeBytes:initial.capacity.Free, observedAtUtc:initial.observedAtUtc, writable:null, capacitySufficient:null },
    gaps: ['热层清点不完整，计数不能代表全量。','分类存在重叠，不可相加。','SQLite、WAL、SHM及测试夹具路径数不是生产数据库数。','总容量、远端写入权限及恢复能力未验证。','受保护配置和跨文件一致性尚未取得资格。','外部Git工作树不在本次项目内容覆盖范围内。'],
  }
  initializeStore(path.join(expected, 'local-backup'), inventory)
  return { initialized:true, logicalPath:'.runtime/local-backup/module.sqlite', sourceReportSha256:expectedSha, productionBackupConnected:false, workProducersConnected:false }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { need(process.argv.length === 2, 'initializer_does_not_accept_arguments'); console.log(JSON.stringify(initializeLocalModule())) }
  catch (error) { console.error(error instanceof ModuleError ? error.message : 'local_backup_initialization_failed'); process.exitCode = 1 }
}
