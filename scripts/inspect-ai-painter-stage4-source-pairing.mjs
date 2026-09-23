import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {inspectSourcePairing} from './lib/ai-painter-stage4-source-pairing.mjs';
import {persistAudit} from './audit-ai-painter-stage4-split-release.mjs';

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const {values} = parseArgs({options: {manifest: {type: 'string'}, sha256: {type: 'string'},
      sourcePlan: {type: 'string'}, sourcePlanSha256: {type: 'string'}}});
    assert(values.manifest && /^[a-f0-9]{64}$/u.test(values.sha256 ?? ''),
      'exact --manifest and --sha256 required');
    assert(values.sourcePlan && /^[a-f0-9]{64}$/u.test(values.sourcePlanSha256 ?? ''),
      'exact --sourcePlan and --sourcePlanSha256 required');
    const report = await inspectSourcePairing(process.cwd(),
      {path: values.manifest, sha256: values.sha256},
      {path: values.sourcePlan, sha256: values.sourcePlanSha256});
    const evidence = persistAudit(process.cwd(), report);
    console.log(JSON.stringify({status: report.status, evidence, sampleCount: report.sampleCount,
      shortestConditionToPromptGapMs: report.shortestConditionToPromptGapMs,
      trainingAllowed: false, gpuAllowed: false}));
  } catch (error) {
    console.error(JSON.stringify({status: 'source_pairing_failed', reason: error.message,
      trainingAllowed: false, gpuAllowed: false}));
    process.exitCode = 1;
  }
}
