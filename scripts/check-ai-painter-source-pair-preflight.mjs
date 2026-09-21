import fs from 'node:fs';
import path from 'node:path';
import { checkSourcePairPreflight } from './lib/ai-painter-source-pair-preflight-v1.mjs';

// stdout is the integration interface. Exit 2 = unresolved; 1 = rejection/error.
// v1 intentionally has no pass/qualification route. Optional output is create-only.
try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--project-root', '--manifest', '--manifest-sha256', '--output'].includes(args[i]) || !args[i + 1] || options[args[i]]) throw Error('Usage: node scripts/check-ai-painter-source-pair-preflight.mjs --project-root <root> --manifest <input JSON> --manifest-sha256 <SHA256> [--output <new JSON file>]');
    options[args[i]] = args[i + 1];
  }
  if (!options['--project-root'] || !options['--manifest'] || !options['--manifest-sha256']) throw Error('--project-root, --manifest and --manifest-sha256 are required');
  const report = { recordedAtUtc: new Date().toISOString(), ...checkSourcePairPreflight({ projectRoot: options['--project-root'],
    manifestPath: options['--manifest'], manifestSha256: options['--manifest-sha256'] }) };
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (options['--output']) {
    const target = path.resolve(options['--output']);
    if (path.extname(target) !== '.json') throw Error('Output must be a new .json evidence file');
    fs.writeFileSync(target, output, { flag: 'wx' });
  }
  process.stdout.write(output);
  process.exitCode = report.decision === 'rejected' ? 1 : 2;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
