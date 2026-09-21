import { listTrainingHistory, readTrainingRun } from './training-history-store.mjs'
import { createUnknownOrStaleProjection, type AiConsoleProjectionResult } from './projection-contract'

export async function queryTrainingHistoryProjection(checkpoints = false): Promise<AiConsoleProjectionResult> {
  try {
    const result = await listTrainingHistory()
    if (checkpoints) {
      const records: Record<string, unknown>[] = []
      const unavailableFields = ['sourceStage', 'parentCheckpointIdentity', 'qualificationStatus', 'reusePolicy']
      for (const run of result.records) {
        const detail = await readTrainingRun(run.runId)
        if (detail.dataStatus === 'partial') unavailableFields.push(`${run.runId}:${detail.reasonCode}`)
        for (const cp of detail.record.checkpoints) records.push({ checkpointIdentity: cp.sha256, sourceRunId: run.runId, sourceStage: null, parentCheckpointIdentity: null, qualificationStatus: null, reusePolicy: null, artifactId: cp.artifactId, logicalPath: cp.logicalPath, byteLength: cp.byteLength, verificationStatus: cp.verificationStatus })
      }
      return { ...result, records, total: null, dataStatus: result.dataStatus === 'unknown_or_stale' ? 'unknown_or_stale' : 'partial', reasonCode: result.reasonCode ?? 'checkpoint_metadata_coverage_partial', unavailableFields, provenance: { ...result.provenance, trustStatus: 'verified_registry' } }
    }
    return { ...result, dataStatus: result.dataStatus as AiConsoleProjectionResult['dataStatus'], provenance: { ...result.provenance, trustStatus: 'verified_registry' } }
  } catch (error) {
    return createUnknownOrStaleProjection({ sourceIdentity: 'ai-painter-training-history', writerIdentity: 'ai_console_training_history_reader_v1', reasonCode: error instanceof Error ? error.message : 'history_source_unreadable' })
  }
}
