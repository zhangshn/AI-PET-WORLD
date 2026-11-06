import { open } from "node:fs/promises"
import path from "node:path"
import { assertRuntimePath } from "./runtime-path-security"
import { decodeNaturalWorldRuntimeRecord, NATURAL_WORLD_MAX_BYTES } from "./world-runtime-record-validation"
import type { NaturalWorldEvolutionEvent, NaturalWorldJson, NaturalWorldRuntimeSaveRecord, NaturalWorldTransitionQuery, NaturalWorldTransitionReadResult } from "./world-runtime-schema"

const fields = {
  "environment.PRECTOTCORR": ["日降雨量", "mm/日"], "environment.RH2M": ["相对湿度", "%"],
  "environment.T2M": ["气温", "°C"], "environment.WS2M": ["风速", "m/s"],
} as const
function member(value: NaturalWorldJson | undefined, key: string) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return value[key]
}
function assertLink(ok: unknown): asserts ok {
  if (!ok) throw new Error("natural_player_history_link_invalid")
}
function summary(event: NaturalWorldEvolutionEvent) {
  return { cursor: event.cursor, tick: event.toTick, date: event.interval.logicalEndUtc.slice(0, 10),
    kind: event.eventKind, changeCount: event.changes.length, weather: event.changes.flatMap(change => {
      if (!Object.hasOwn(fields, change.fieldId) || typeof change.newValue !== "number" || !Number.isFinite(change.newValue)) return []
      const [label, unit] = fields[change.fieldId as keyof typeof fields]
      return [{ label, unit, value: change.newValue }]
    }) }
}
type Entry = ReturnType<typeof summary>
export type PlayerHistory = {
  status: "available" | "unavailable" | "stale_page" | "invalid_page"
  entries: Entry[]
  older?: string
  newer?: string
}

const pageSize = 3
// The original Store's ancestral verification is bounded to 32 predecessors.
const maxDistance = 32
const sha = /^[a-f0-9]{64}$/

export async function recentNaturalPlayerHistory(
  root: string, recordPath: string, head: NaturalWorldRuntimeSaveRecord, headSha: string,
  readTransition: (query: NaturalWorldTransitionQuery) => Promise<NaturalWorldTransitionReadResult>,
  cursor?: string | string[],
): Promise<PlayerHistory> {
  const {ownerId, playerId, worldId, worldSeed, worldProfileId, regionId} = head
  const identity = {ownerId, playerId, worldId, worldSeed, worldProfileId, regionId}
  let keys: string[] = []
  if (cursor !== undefined) {
    if (typeof cursor !== "string" || cursor.length > 65 * (1 + Math.floor(maxDistance / pageSize)))
      return {status:"invalid_page", entries:[]}
    const [anchor, ...pages] = cursor.split(".")
    if (!pages.length || ![anchor, ...pages].every(key => sha.test(key)) || new Set(pages).size !== pages.length)
      return {status:"invalid_page", entries:[]}
    if (anchor !== headSha) return {status:"stale_page", entries:[]}
    if (head.eventCursor <= pages.length * pageSize) return {status:"invalid_page", entries:[]}
    keys = pages
  }
  if (!head.eventCursor) return {status:"available", entries:[]}
  function commitOf(record: NaturalWorldRuntimeSaveRecord) {
    const commit = member(member(record.worldState.payload.environment, "evolution"), "commit")
    const key = member(commit, "businessKey")
    assertLink(typeof key === "string" && sha.test(key))
    return {key, eventSha:member(commit, "eventSha256")}
  }
  async function before(event: NaturalWorldEvolutionEvent) {
    const previous = event.before.expectedFileSha256
    assertLink(sha.test(previous) && sha.test(event.businessKey))
    const file = await assertRuntimePath(path.join(recordPath + ".evolution", event.businessKey + "." + previous + ".before.json"), root)
    const handle = await open(file, "r")
    try {
      const stat = await handle.stat()
      assertLink(stat.isFile() && stat.nlink === 1 && stat.size > 0 && stat.size <= NATURAL_WORLD_MAX_BYTES)
      const raw = Buffer.alloc(stat.size + 1)
      const {bytesRead} = await handle.read(raw, 0, raw.length, 0)
      assertLink(bytesRead === stat.size)
      const prior = decodeNaturalWorldRuntimeRecord(raw.subarray(0, bytesRead))
      assertLink(prior.fileSha256 === previous && prior.record.eventCursor === event.cursor - 1 &&
        prior.record.tick === event.fromTick && prior.record.stateVersion === event.fromStateVersion &&
        Object.entries(identity).every(([k,v]) => prior.record[k as keyof typeof identity] === v))
      assertLink(commitOf(prior.record).eventSha === event.previousEventSha256)
      return prior
    } finally { await handle.close() }
  }
  async function verifiedEvent(key: string, expectedCursor: number) {
    const {status, event, receipt} = await readTransition({identity, businessKey:key})
    assertLink(status === "found" && event && receipt && event.businessKey === key && receipt.businessKey === key &&
      receipt.eventSha256 === event.eventSha256 && event.cursor === expectedCursor)
    return {event, receipt}
  }
  try {
    // Earlier keys are navigation hints only. A key yields entries only when
    // the original Store verifies it at the expected cursor of this world.
    let hit: Awaited<ReturnType<typeof verifiedEvent>> | undefined
    if (keys.length)
      hit = await verifiedEvent(keys[keys.length-1], head.eventCursor - keys.length * pageSize)
    if (!hit) {
      const {key,eventSha} = commitOf(head)
      hit = await verifiedEvent(key,head.eventCursor)
      assertLink(hit.receipt.fileSha256 === headSha && hit.event.eventSha256 === eventSha &&
        hit.event.toTick === head.tick && hit.event.toStateVersion === head.stateVersion)
    }
    const page: PlayerHistory = {status:"available", entries:[]}
    if (keys.length) page.newer = keys.length === 1 ? "" : [headSha,...keys.slice(0,-1)].join(".")
    while (page.entries.length < pageSize) {
      const {event} = hit
      page.entries.push(summary(event))
      if (event.cursor === 1) break
      if (page.entries.length === pageSize && (keys.length + 1) * pageSize > maxDistance) break
      const prior = await before(event)
      const {key,eventSha} = commitOf(prior.record)
      if (page.entries.length === pageSize) {
        page.older = [headSha,...keys,key].join(".")
        break
      }
      hit = await verifiedEvent(key, prior.record.eventCursor)
      assertLink(hit.receipt.fileSha256 === prior.fileSha256 && hit.event.eventSha256 === eventSha &&
        hit.event.toTick === prior.record.tick && hit.event.toStateVersion === prior.record.stateVersion)
    }
    return page
  } catch { return {status:"unavailable", entries:[]} }
}
