import fs from "node:fs"
import crypto from "node:crypto"
import path from "node:path"
import { indexProgramEvent, openStorageCatalog, closeStorageCatalog, upsertStorageMeta } from "./lib/ai-pet-world-storage-catalog.mjs"
import { physicalRuntimeRoot } from "./lib/ai-pet-world-storage.mjs"

const ledgerPath = path.join(physicalRuntimeRoot, "ai-painter", "training-process-ledger", "events.jsonl")
let imported = 0
let invalid = 0
const invalidRecords = []

if (fs.existsSync(ledgerPath)) {
  const lines = fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean)
  openStorageCatalog().exec("BEGIN")
  try {
    for (const [index, sourceLine] of lines.entries()) {
      try {
        const line = sourceLine.replace(/^\uFEFF/, "")
        const parsed = JSON.parse(line)
        const event = parsed && typeof parsed === "object" ? parsed : {}
        if (typeof event.id !== "string" || event.id.length === 0) {
          event.id = `legacy-event-${crypto.createHash("sha256").update(`${index + 1}:${line}`).digest("hex")}`
          event.catalogBackfill = {
            syntheticId: true,
            sourceLine: index + 1,
            originalEventHadId: false,
          }
        }
        indexProgramEvent(event)
        imported += 1
      } catch (error) {
        invalid += 1
        invalidRecords.push({
          sourceLine: index + 1,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    openStorageCatalog().exec("COMMIT")
  } catch (error) {
    openStorageCatalog().exec("ROLLBACK")
    throw error
  }
}

upsertStorageMeta("program_event_backfill_at_utc", new Date().toISOString())
upsertStorageMeta("program_event_backfill_count", imported)
closeStorageCatalog()
console.log(JSON.stringify({ status: "storage_catalog_event_backfill_completed", ledgerPath, imported, invalid, invalidRecords }, null, 2))
