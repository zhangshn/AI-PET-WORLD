// 当前文件作用：定义真实本地图像模型 worker；只调用外部真实推理命令、校验真实位图文件，不生成假图或程序绘图。

import { spawn } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"

import { validateRealImageExecutionStdoutPayload } from "./real-image-execution-contract.mjs"
import { validateLocalImageOutputFileName } from "./output-storage.mjs"

const WORKER_NAME = "ai-pet-world-real-image-model-worker"
const WORKER_VERSION = "real-model-worker-command-bridge-1"
const MAX_STDOUT_BYTES = 1024 * 1024
const MAX_STDERR_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 600_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 3_600_000
const KILL_GRACE_MS = 1_000

const ENV = {
  command: "AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND",
  argsJson: "AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON",
  timeoutMs: "AI_PET_WORLD_REAL_IMAGE_INFERENCE_TIMEOUT_MS",
  outputDirectory: "AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR",
}

main().catch((error) => {
  writeFailureAndExit({
    status: "real_image_model_worker_unhandled_error",
    message: error instanceof Error ? error.message : String(error),
  })
})

async function main() {
  const stdinResult = await readStdinJson()

  if (!stdinResult.ok) {
    writeFailureAndExit(stdinResult)
    return
  }

  const payload = stdinResult.payload
  const config = readWorkerConfig()

  if (!config.command) {
    writeFailureAndExit({
      status: "real_image_model_worker_inference_command_missing",
      message:
        "缺少 AI_PET_WORLD_REAL_IMAGE_INFERENCE_COMMAND，worker 不能自行生成图片。",
    })
    return
  }

  if (!config.argsValid) {
    writeFailureAndExit({
      status: "real_image_model_worker_inference_args_invalid",
      message: "AI_PET_WORLD_REAL_IMAGE_INFERENCE_ARGS_JSON 必须是字符串数组 JSON。",
    })
    return
  }

  if (!config.outputDirectory) {
    writeFailureAndExit({
      status: "real_image_model_worker_output_directory_missing",
      message: "缺少 AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR。",
    })
    return
  }

  const outputFileNameValidation = validateLocalImageOutputFileName({
    fileName: payload.outputFileName,
  })

  if (!outputFileNameValidation.ok) {
    writeFailureAndExit({
      status: "real_image_model_worker_output_file_name_invalid",
      message: "真实模型输出文件名不安全。",
      detail: outputFileNameValidation,
    })
    return
  }

  const commandResult = await runInferenceCommand({
    config,
    payload,
  })

  if (!commandResult.ok) {
    writeFailureAndExit(commandResult)
    return
  }

  const stdoutResult = parseStdoutJson(commandResult.stdoutText)

  if (!stdoutResult.ok) {
    writeFailureAndExit(stdoutResult)
    return
  }

  const stdoutValidation = validateRealImageExecutionStdoutPayload(
    stdoutResult.payload
  )

  if (!stdoutValidation.ok) {
    writeFailureAndExit({
      status: "real_image_model_worker_stdout_contract_invalid",
      detail: stdoutValidation,
    })
    return
  }

  if (stdoutValidation.imageFileName !== outputFileNameValidation.fileName) {
    writeFailureAndExit({
      status: "real_image_model_worker_output_file_name_mismatch",
      message: "真实模型 stdout imageFileName 必须等于 stdin outputFileName。",
    })
    return
  }

  const bitmapResult = await verifyGeneratedBitmapFile({
    outputDirectory: config.outputDirectory,
    outputFileName: stdoutValidation.imageFileName,
    imageFormat: stdoutValidation.imageFormat,
    width: stdoutValidation.width,
    height: stdoutValidation.height,
  })

  if (!bitmapResult.ok) {
    writeFailureAndExit(bitmapResult)
    return
  }

  writeSuccess({
    imageFileName: stdoutValidation.imageFileName,
    imageFormat: stdoutValidation.imageFormat,
    width: stdoutValidation.width,
    height: stdoutValidation.height,
    license: stdoutValidation.license,
    originalityConfirmed: stdoutValidation.originalityConfirmed,
  })
}

async function readStdinJson() {
  const chunks = []

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
  }

  const text = Buffer.concat(chunks).toString("utf8").trim()

  if (!text) {
    return {
      ok: false,
      status: "real_image_model_worker_stdin_empty",
      message: "真实模型 worker stdin 不能为空。",
    }
  }

  try {
    const payload = JSON.parse(text)

    if (!isRecord(payload)) {
      return {
        ok: false,
        status: "real_image_model_worker_stdin_not_object",
        message: "真实模型 worker stdin 必须是 JSON 对象。",
      }
    }

    return { ok: true, payload }
  } catch {
    return {
      ok: false,
      status: "real_image_model_worker_stdin_json_invalid",
      message: "真实模型 worker stdin 不是合法 JSON。",
    }
  }
}

function readWorkerConfig() {
  const argsResult = readArgsJson(process.env[ENV.argsJson])

  return {
    command: readOptionalString(process.env[ENV.command]),
    args: argsResult.args,
    argsValid: argsResult.ok,
    timeoutMs: readTimeoutMs(process.env[ENV.timeoutMs]),
    outputDirectory: readOptionalString(process.env[ENV.outputDirectory]),
  }
}

function readArgsJson(value) {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: true, args: [] }
  }

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return { ok: false, args: [] }
    }

    return { ok: true, args: parsed }
  } catch {
    return { ok: false, args: [] }
  }
}

function readTimeoutMs(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return DEFAULT_TIMEOUT_MS
  }

  return Math.min(Math.max(Math.floor(numeric), MIN_TIMEOUT_MS), MAX_TIMEOUT_MS)
}

async function runInferenceCommand(input) {
  const stdoutCapture = createTextCapture(MAX_STDOUT_BYTES)
  const stderrCapture = createTextCapture(MAX_STDERR_BYTES)
  let childProcess
  let timeoutHandle
  let killHandle
  let timedOut = false
  let settled = false

  return new Promise((resolve) => {
    function finish(result) {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      clearTimeout(killHandle)
      resolve(result)
    }

    try {
      childProcess = spawn(input.config.command, input.config.args, {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          AI_PET_WORLD_LOCAL_IMAGE_OUTPUT_DIR: input.config.outputDirectory,
        },
      })
    } catch {
      finish({
        ok: false,
        status: "real_image_model_worker_spawn_failed",
      })
      return
    }

    timeoutHandle = setTimeout(() => {
      timedOut = true
      childProcess.kill("SIGTERM")
      killHandle = setTimeout(() => childProcess.kill("SIGKILL"), KILL_GRACE_MS)
    }, input.config.timeoutMs)

    childProcess.stdout.on("data", (chunk) => appendTextCapture(stdoutCapture, chunk))
    childProcess.stderr.on("data", (chunk) => appendTextCapture(stderrCapture, chunk))

    childProcess.on("error", () => {
      finish({ ok: false, status: "real_image_model_worker_spawn_error" })
    })

    childProcess.on("close", (exitCode, signal) => {
      if (timedOut) {
        finish({
          ok: false,
          status: "real_image_model_worker_timeout",
          exitCode,
          signal,
          stdoutTruncated: stdoutCapture.truncated,
          stderrCaptured: stderrCapture.text.length > 0,
          stderrTruncated: stderrCapture.truncated,
        })
        return
      }

      if (exitCode !== 0) {
        finish({
          ok: false,
          status: "real_image_model_worker_exit_non_zero",
          exitCode,
          signal,
          stderrCaptured: stderrCapture.text.length > 0,
          stderrTruncated: stderrCapture.truncated,
        })
        return
      }

      if (stdoutCapture.truncated) {
        finish({ ok: false, status: "real_image_model_worker_stdout_too_large" })
        return
      }

      finish({
        ok: true,
        status: "real_image_model_worker_process_completed",
        stdoutText: stdoutCapture.text,
      })
    })

    childProcess.stdin.on("error", () => {})
    childProcess.stdin.end(JSON.stringify(input.payload))
  })
}

function parseStdoutJson(stdoutText) {
  const text = typeof stdoutText === "string" ? stdoutText.trim() : ""

  if (!text) {
    return { ok: false, status: "real_image_model_worker_stdout_empty" }
  }

  try {
    const payload = JSON.parse(text)
    return isRecord(payload)
      ? { ok: true, payload }
      : { ok: false, status: "real_image_model_worker_stdout_not_object" }
  } catch {
    return { ok: false, status: "real_image_model_worker_stdout_json_invalid" }
  }
}

async function verifyGeneratedBitmapFile(input) {
  const outputDirectory = path.resolve(input.outputDirectory)
  const outputFilePath = path.resolve(outputDirectory, input.outputFileName)

  if (!isPathInsideDirectory(outputFilePath, outputDirectory)) {
    return {
      ok: false,
      status: "real_image_model_worker_output_path_escape_forbidden",
    }
  }

  let fileStat

  try {
    fileStat = await fs.stat(outputFilePath)
  } catch {
    return { ok: false, status: "real_image_model_worker_output_file_missing" }
  }

  if (!fileStat.isFile()) {
    return { ok: false, status: "real_image_model_worker_output_not_file" }
  }

  if (fileStat.size <= 0) {
    return { ok: false, status: "real_image_model_worker_output_file_empty" }
  }

  const buffer = await fs.readFile(outputFilePath)
  const metadata = readBitmapMetadata(buffer)

  if (!metadata.ok) {
    return metadata
  }

  if (metadata.imageFormat !== input.imageFormat) {
    return { ok: false, status: "real_image_model_worker_bitmap_format_mismatch" }
  }

  if (metadata.width !== input.width || metadata.height !== input.height) {
    return { ok: false, status: "real_image_model_worker_bitmap_size_mismatch" }
  }

  return {
    ok: true,
    status: "real_image_model_worker_bitmap_verified",
    imageFormat: metadata.imageFormat,
    width: metadata.width,
    height: metadata.height,
  }
}

function readBitmapMetadata(buffer) {
  return (
    readPngMetadata(buffer) ??
    readWebpMetadata(buffer) ??
    readJpegMetadata(buffer) ?? {
      ok: false,
      status: "real_image_model_worker_bitmap_signature_invalid",
    }
  )
}

function readPngMetadata(buffer) {
  const signature = "89504e470d0a1a0a"

  if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== signature) {
    return null
  }

  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") {
    return { ok: false, status: "real_image_model_worker_png_ihdr_missing" }
  }

  return {
    ok: true,
    imageFormat: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

function readWebpMetadata(buffer) {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return null
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii")

  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      ok: true,
      imageFormat: "webp",
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    }
  }

  if (chunkType === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21)
    return {
      ok: true,
      imageFormat: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      ok: true,
      imageFormat: "webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  }

  return { ok: false, status: "real_image_model_worker_webp_header_invalid" }
}

function readJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null
  }

  let offset = 2

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    const segmentLength = buffer.readUInt16BE(offset + 2)

    if (segmentLength < 2) {
      return { ok: false, status: "real_image_model_worker_jpeg_segment_invalid" }
    }

    if (isJpegStartOfFrameMarker(marker)) {
      return {
        ok: true,
        imageFormat: "jpg",
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      }
    }

    offset += 2 + segmentLength
  }

  return { ok: false, status: "real_image_model_worker_jpeg_sof_missing" }
}

function isJpegStartOfFrameMarker(marker) {
  return [
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ].includes(marker)
}

function writeSuccess(input) {
  process.stdout.write(
    JSON.stringify({
      ok: true,
      status: "real_image_generated",
      imageFileName: input.imageFileName,
      imageFormat: input.imageFormat,
      width: input.width,
      height: input.height,
      license: input.license,
      originalityConfirmed: input.originalityConfirmed,
      canShowToPlayer: false,
      worker: WORKER_NAME,
      version: WORKER_VERSION,
    })
  )
}

function writeFailureAndExit(input) {
  process.stderr.write(
    JSON.stringify({
      ok: false,
      status: input.status,
      message: input.message ?? null,
      detail: input.detail ?? null,
      worker: WORKER_NAME,
      version: WORKER_VERSION,
      canShowToPlayer: false,
    })
  )
  process.exitCode = 1
}

function createTextCapture(maxBytes) {
  return { text: "", bytes: 0, maxBytes, truncated: false }
}

function appendTextCapture(capture, chunk) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
  const remaining = capture.maxBytes - capture.bytes

  if (remaining <= 0) {
    capture.truncated = true
    return
  }

  const piece = buffer.subarray(0, remaining)
  capture.text += piece.toString("utf8")
  capture.bytes += piece.length

  if (piece.length < buffer.length) {
    capture.truncated = true
  }
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : ""
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPathInsideDirectory(targetPath, directory) {
  const relative = path.relative(directory, targetPath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}
