import path from 'node:path';
import { bytes as readSafeBytes } from './training-history-safe-bytes.mjs';

const PACKAGE_SCHEMA = 'ai-painter-learning-capacity-experiment-package-v1';
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const positive = v => Number.isSafeInteger(v) && v > 0 ? v : null;
const count = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
const string = v => typeof v === 'string' && v.length > 0 ? v : null;
const empty = (runId, reasonCode) => ({availability:'unavailable', reasonCode, runId,
  scope:null, resolution:null, targetEpochs:null, targetOptimizerSteps:null, completedEpochs:null,
  actualOptimizerSteps:null, errorCode:null, packagePath:null, packageSha256:null});

// Read only the package explicitly present in the already verified task capsule.
// No directory discovery, mutable progress reads, writes, or historical fallback.
export async function readBoundTrainingPresentation(projectRoot, registry, capsule, terminal) {
  const runId = string(registry?.runId);
  try {
    if (!runId || !record(capsule) || !Array.isArray(capsule.evidence)) return empty(runId, 'training_package_not_bound');
    const bindings = capsule.evidence.filter(b => record(b) && typeof b.path === 'string'
      && b.path.replaceAll('\\', '/').endsWith('/package.json'));
    if (bindings.length !== 1) return empty(runId, 'training_package_binding_unavailable');
    const binding = bindings[0], logical = binding.path.replaceAll('\\', '/');
    if (!/^[a-f0-9]{64}$/u.test(binding.sha256) || path.posix.isAbsolute(logical)
      || /^[A-Za-z]:/u.test(logical) || logical.split('/').includes('..')) throw new Error('training_package_binding_invalid');
    let bytes;
    try { bytes = (await readSafeBytes(projectRoot, logical, MAX_PACKAGE_BYTES, binding.sha256)).value; }
    catch (error) {
      const mapped = {history_byte_limit:'training_package_size_limit', history_sha_mismatch:'training_package_sha256_mismatch',
        history_unregistered_mount:'training_package_boundary_violation', history_symlink_escape:'training_package_boundary_violation',
        history_path_outside_root:'training_package_binding_invalid'};
      throw new Error(mapped[error.message] ?? error.message);
    }
    const pkg = JSON.parse(bytes.toString('utf8'));
    if (!record(pkg) || pkg.schemaVersion !== PACKAGE_SCHEMA || pkg.evidenceContractVersion !== 1)
      return empty(runId, 'training_package_schema_unsupported');
    if (pkg.experimentIdentity !== runId) throw new Error('training_package_run_mismatch');
    const training = record(pkg.training) ? pkg.training : {};
    const resolution = Array.isArray(pkg.resolution) && pkg.resolution.length === 2
      && positive(pkg.resolution[0]) && positive(pkg.resolution[1])
      ? {width:pkg.resolution[0], height:pkg.resolution[1]} : null;
    const targetEpochs = positive(training.epochs);
    const targetOptimizerSteps = positive(training.maxGeneratorOptimizerSteps);
    const targetCriticSteps = positive(training.maxDiscriminatorOptimizerSteps);
    const ended = registry.activeExecution == null && record(terminal) && terminal.runId === runId;
    const steps = ended && record(terminal.actualFinalOptimizerSteps) ? terminal.actualFinalOptimizerSteps : null;
    const generator = count(steps?.generator), critic = count(steps?.discriminator);
    if (generator !== null && targetOptimizerSteps !== null && generator > targetOptimizerSteps)
      throw new Error('training_terminal_step_limit_conflict');
    if (critic !== null && targetCriticSteps !== null && critic > targetCriticSteps)
      throw new Error('training_terminal_step_limit_conflict');
    const complete = ended ? count(terminal.completedEpochs) : null;
    if (complete !== null && targetEpochs !== null && complete > targetEpochs)
      throw new Error('training_terminal_epoch_limit_conflict');
    return {availability:'available', reasonCode:resolution && targetEpochs && targetOptimizerSteps ? null : 'training_plan_fields_unavailable',
      runId, scope:string(pkg.scope), resolution, targetEpochs, targetOptimizerSteps,
      completedEpochs:complete, actualOptimizerSteps:generator !== null && critic !== null ? {generator, critic} : null,
      errorCode:ended ? string(terminal.errorCode) : null,
      packagePath:logical, packageSha256:binding.sha256};
  } catch (error) {
    return empty(runId, error instanceof Error ? error.message : 'training_presentation_unavailable');
  }
}
