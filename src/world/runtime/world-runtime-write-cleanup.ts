import type { NaturalWorldRuntimeWriteResult } from "./world-runtime-schema"

// Report cleanup separately from publication: a committed save is not rolled back.
// A failed close retains the lock; retrying close or deleting it could release an
// owner whose handle state is unknown.
export async function finishWorldRuntimeWrite(
  result: NaturalWorldRuntimeWriteResult,
  handle: { close(): Promise<void> } | null,
  release: () => Promise<void>,
  recordReplaced: boolean,
): Promise<NaturalWorldRuntimeWriteResult> {
  if (!handle) return result
  let stage = "close"
  try {
    await handle.close()
    stage = "release"
    await release()
    return result
  } catch (error) {
    return {
      ...result,
      ok: false,
      code: result.ok ? "persistence_error" : result.code ?? "persistence_error",
      message: result.ok
        ? recordReplaced
          ? "Runtime save record was replaced; write lock cleanup failed."
          : "Runtime write lock cleanup failed."
        : result.message,
      warnings: [...result.warnings, `runtime_write_lock_${stage}_failed:${error instanceof Error ? error.message : String(error)}`],
      tags: [...result.tags.filter(tag => tag !== "ok"), "runtime_write_lock_cleanup_failed",
        ...(!result.tags.includes("failed") ? ["failed"] : []),
        ...(recordReplaced && !result.tags.includes("runtime_save_record_replaced") ? ["runtime_save_record_replaced"] : [])],
    }
  }
}
