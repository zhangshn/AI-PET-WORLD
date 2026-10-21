import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getWorkRecordingContext,CODEX_REPORTERS } from '../src/server/local-backup/work-producers.mjs'

export const HELP='Usage: node scripts/record-work.mjs --reporter <registered-window-id> < bounded-structured-record.json\nSource is always codex. Reporter names/thread IDs come from the fixed registry. No machine sequence, runner, root or source override. Machine validation/acceptance remain unknown; attributedClaims carry external statements. Detailed workReport, evidence and the sole plan reference are checked locally.\nRegistered IDs: '+CODEX_REPORTERS.map(r=>r.id).join(', ')+'\n'
export async function readRecordInput(stream) {
  let size=0;const chunks=[]
  for await(const chunk of stream){size+=chunk.length;if(size>65536)throw Error('work_cli_input_limit');chunks.push(chunk)}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Error('work_cli_json_invalid')}
}
export async function runRecordWork(argv,stream=process.stdin) {
  if(argv.length===1&&argv[0]==='--help')return {help:HELP}
  if(argv.length!==2||argv[0]!=='--reporter'||!CODEX_REPORTERS.some(r=>r.id===argv[1]))throw Error('work_cli_arguments_invalid')
  const reporter=CODEX_REPORTERS.find(r=>r.id===argv[1])
  if(process.env.CODEX_THREAD_ID&&CODEX_REPORTERS.some(r=>r.threadId===process.env.CODEX_THREAD_ID)&&reporter.threadId!==process.env.CODEX_THREAD_ID)throw Error('work_cli_reporter_context_conflict')
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
  if(path.resolve(process.cwd())!==root)throw Error('work_cli_source_root_required')
  const input=await readRecordInput(stream)
  return getWorkRecordingContext().recordCodex(input,reporter.id)
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url) {
  try {
    const result=await runRecordWork(process.argv.slice(2))
    process.stdout.write(result.help??JSON.stringify(result)+'\n')
    if(!result.help&&!result.recorded)process.exitCode=1
  }catch(error){const reasonCode=/^work_[a-z0-9_]+$/.test(error?.message??'')?error.message:'work_cli_unavailable';process.stderr.write(JSON.stringify({recorded:false,sourceCategory:'codex',reasonCode})+'\n');process.exitCode=1}
}
