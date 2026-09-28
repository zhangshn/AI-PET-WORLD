import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import sharp from "sharp"

import { auditMvp256DetailSufficiency } from "../lib/ai-painter-mvp-detail-sufficiency-v1.mjs"

const contract = JSON.parse(fs.readFileSync(
  "data/ai-painter/system-governance/stage4-mvp-256-detail-sufficiency-review-v1-contract.json",
  "utf8",
))

test("rejects a severely blurred candidate and accepts an identical readable candidate", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mvp-detail-"))
  const reference = path.join(root, "reference.png")
  const blurred = path.join(root, "blurred.png")
  const width = 256
  const height = 192
  const detailed = Buffer.alloc(width * height * 3)
  const flat = Buffer.alloc(width * height * 3)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3
      const value = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 220 : 30
      detailed[offset] = value
      detailed[offset + 1] = 255 - value
      detailed[offset + 2] = value
      flat[offset] = 80
      flat[offset + 1] = 100
      flat[offset + 2] = 60
    }
  }
  await sharp(detailed, { raw: { width, height, channels: 3 } }).png().toFile(reference)
  await sharp(flat, { raw: { width, height, channels: 3 } }).png().toFile(blurred)
  const failed = await auditMvp256DetailSufficiency({ candidatePath: blurred, referencePath: reference, contract })
  assert.equal(failed.passed, false)
  assert.deepEqual(failed.issueCodes, ["professional_reference_relative_detail_insufficient"])
  const passed = await auditMvp256DetailSufficiency({ candidatePath: reference, referencePath: reference, contract })
  assert.equal(passed.passed, true)
  assert.deepEqual(passed.issueCodes, [])
})
