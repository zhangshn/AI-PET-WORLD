import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const ROOT = process.cwd()
const failures = []
const pointer = readJson("data/world-runtime/latest-world.json")
const world = pointer?.path ? readJson(pointer.path) : null
const migration = readJson(".runtime/world-profile-migrations/latest.json")
check(Boolean(pointer), "latest_world_pointer_missing")
check(Boolean(world), "latest_world_missing")
check(Boolean(migration), "migration_report_missing")
if (pointer && world && migration) {
  check(pointer.worldProfileId === "mainland-southeast-asia-tropical-monsoon-natural-home-v1", "pointer_profile_mismatch")
  check(world.worldProfileId === pointer.worldProfileId, "world_profile_mismatch")
  check(world.tick === pointer.tick && migration.targetTick === world.tick, "migration_tick_mismatch")
  check(world.homeMapState?.ecologyState?.biomeType === "tropical_monsoon_lowland_foothill_natural_home", "world_biome_mismatch")
  check(!/oasis/i.test(JSON.stringify(world)), "legacy_oasis_token_present")
  check((world.homeMapState?.constructionPlans ?? []).length === 0, "construction_plans_not_empty")
  check(!(world.homeMapState?.placements ?? []).some((item) => item.layer === "actor" || /butler|animal|building/i.test(`${item.id}:${item.tags?.join(":")}`)), "forbidden_visible_placement_present")
  check(migration.historicalSourcePreserved === true && exists(migration.sourceWorldPath), "historical_source_not_preserved")
  check(exists(migration.targetWorldPath), "migration_target_missing")
  if (exists(migration.targetWorldPath)) check(sha256File(migration.targetWorldPath) === migration.targetWorldSha256, "migration_target_hash_mismatch")
}
const result = { ok: failures.length === 0, status: failures.length === 0 ? "current_world_profile_migration_check_passed" : "current_world_profile_migration_check_failed", worldId: world?.worldId ?? null, tick: world?.tick ?? null, worldProfileId: world?.worldProfileId ?? null, migrationId: migration?.migrationId ?? null, failures }
console[failures.length === 0 ? "log" : "error"](JSON.stringify(result, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
function readJson(value) { try { return JSON.parse(fs.readFileSync(path.resolve(ROOT, value), "utf8")) } catch { return null } }
function exists(value) { return typeof value === "string" && fs.existsSync(path.resolve(ROOT, value)) }
function sha256File(value) { return crypto.createHash("sha256").update(fs.readFileSync(path.resolve(ROOT, value))).digest("hex") }
function check(condition, code) { if (!condition) failures.push(code) }
