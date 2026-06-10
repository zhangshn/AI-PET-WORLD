import assert from "node:assert/strict"

import {
  buildRealImageExecutionContract,
  validateRealImageExecutionStdoutPayload,
} from "../services/local-image-model/real-image-execution-contract.mjs"

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

async function main() {
  const contract = buildRealImageExecutionContract()
  const validStdout = buildValidStdoutFixture()
  const validResult = validateRealImageExecutionStdoutPayload(validStdout)
  const badFileNameResult = validateRealImageExecutionStdoutPayload({
    ...validStdout,
    imageFileName: "../bad.png",
  })
  const badFormatResult = validateRealImageExecutionStdoutPayload({
    ...validStdout,
    imageFileName: "candidate-001.svg",
    imageFormat: "svg",
  })
  const badLicenseResult = validateRealImageExecutionStdoutPayload({
    ...validStdout,
    license: "unknown",
  })
  const badOriginalityResult = validateRealImageExecutionStdoutPayload({
    ...validStdout,
    originalityConfirmed: false,
  })

  assert.equal(contract.ok, true)
  assert.deepEqual(contract.requiredStdoutFields, [
    "ok",
    "status",
    "imageFileName",
    "imageFormat",
    "width",
    "height",
    "license",
    "originalityConfirmed",
  ])
  assert.equal(contract.stdoutContract.mustBeJsonObject, true)
  assert.equal(contract.stdoutContract.okMustBeTrue, true)
  assert.equal(contract.stdoutContract.statusMustBe, "real_image_generated")
  assert.equal(contract.stdoutContract.mustNotReturnImageUrlDirectly, true)
  assert.equal(contract.stdoutContract.mustNotReturnFileUrl, true)
  assert.equal(contract.stdoutContract.mustNotReturnLocalFilePath, true)
  assert.equal(validResult.ok, true)
  assert.equal(validResult.canShowToPlayer, false)
  assert.equal(badFileNameResult.ok, false)
  assert.equal(badFormatResult.ok, false)
  assert.equal(badLicenseResult.ok, false)
  assert.equal(badOriginalityResult.ok, false)

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(validStdout, null, 2))
    return
  }

  printTitle("AI-PET-WORLD real model command stdout contract")
  printCheck("execution contract can be built")
  printCheck("required stdout fields are stable")
  printCheck("valid stdout fixture passes")
  printCheck("unsafe file name is rejected")
  printCheck("wrong image format is rejected")
  printCheck("invalid license is rejected")
  printCheck("originalityConfirmed=false is rejected")

  console.log("")
  console.log("真实模型命令 stdout 只能返回一个 JSON 对象：")
  console.log(JSON.stringify(validStdout, null, 2))
  console.log("")
  console.log("字段含义：")
  console.log("ok: 必须是 true。")
  console.log("status: 必须是 real_image_generated。")
  console.log("imageFileName: 必须是安全文件名，只能是文件名，不能带目录。")
  console.log("imageFormat: 只能是 png / webp / jpg。")
  console.log("width / height: 必须达到最低尺寸要求。")
  console.log("license: 只能是 self_owned / cc0 / commercial_license。")
  console.log("originalityConfirmed: 必须是 true。")
  console.log("")
  console.log("真实图片文件必须已经写入 outputStorage 指定目录。")
  console.log("stdout 不负责返回玩家可见图片；它只声明隐藏候选图来源。")
  console.log("")
  console.log("查看纯 JSON 样例：")
  console.log("npm run inspect:local-image-model-real-command-output -- --json")
  console.log("")
  console.log("RESULT: real model command stdout contract inspection passed.")
}

function buildValidStdoutFixture() {
  return {
    ok: true,
    status: "real_image_generated",
    imageFileName: "candidate-001.png",
    imageFormat: "png",
    width: 1536,
    height: 1024,
    license: "self_owned",
    originalityConfirmed: true,
  }
}

function printTitle(title) {
  console.log("")
  console.log("=".repeat(title.length))
  console.log(title)
  console.log("=".repeat(title.length))
}

function printCheck(name) {
  console.log(`[passed] ${name}`)
}
