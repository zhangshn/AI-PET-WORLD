import { execFile } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

import { DATASET_DOMAINS, DATASET_LAYERS } from "@/app/ai-painter-lab/dataset-taxonomy"
import { createDatasetSampleId } from "../dataset-sample-id"

const runFile = promisify(execFile)
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_BATCH_FILES = 20

type ImportResult = {
  fileName: string
  sampleId?: string
  ok: boolean
  message: string
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return response(false, "生产环境禁止上传训练数据。", 403)
  }

  try {
    const form = await request.formData()
    const images = form.getAll("images").filter((value): value is File => value instanceof File && value.size > 0)
    const layer = textField(form, "sampleLayer")
    const domain = textField(form, "domain")
    const subtype = textField(form, "subtype")
    const sharedErrors = validateSharedInput({ images, layer, domain, subtype, form })
    if (sharedErrors.length) return response(false, sharedErrors.join("；"), 422)

    const root = path.join(process.cwd(), "data", "ai-painter-datasets")
    const results: ImportResult[] = []
    for (const image of images) {
      results.push(await importImage({ form, image, layer, domain, subtype, root }))
    }

    const accepted = results.filter((item) => item.ok).length
    const rejected = results.length - accepted
    const message = `批量导入完成：成功 ${accepted} 张，失败 ${rejected} 张。`
    return NextResponse.json(
      { ok: accepted > 0, message, accepted, rejected, results },
      { status: accepted > 0 ? 200 : 422 }
    )
  } catch (error) {
    return response(false, error instanceof Error ? error.message : "上传处理失败。", 500)
  }
}

async function importImage(input: {
  form: FormData
  image: File
  layer: string
  domain: string
  subtype: string
  root: string
}): Promise<ImportResult> {
  const imageError = validateImage(input.image)
  if (imageError) return { fileName: input.image.name, ok: false, message: imageError }

  const sampleId = createDatasetSampleId({
    fileName: input.image.name,
    layer: input.layer,
    domain: input.domain,
  })
  const incoming = path.join(input.root, "incoming", sampleId)
  try {
    await rm(incoming, { recursive: true, force: true })
    await mkdir(incoming, { recursive: true })
    await writeFile(path.join(incoming, "target.png"), Buffer.from(await input.image.arrayBuffer()))

    const structure = buildStructure(input.form, sampleId, input.layer)
    const structureName = input.layer === "scene" ? "blueprint.json" : "annotation.json"
    await writeFile(path.join(incoming, structureName), JSON.stringify(structure, null, 2), "utf8")
    await writeFile(
      path.join(incoming, "metadata.json"),
      JSON.stringify(buildMetadata(input.form, sampleId, input.layer, input.domain, input.subtype, structureName), null, 2),
      "utf8"
    )

    const result = await runImporter(input.root, sampleId)
    return { fileName: input.image.name, sampleId, ok: true, message: result.status ?? "accepted" }
  } catch (error) {
    const output = extractProcessOutput(error)
    return {
      fileName: input.image.name,
      sampleId,
      ok: false,
      message: output || (error instanceof Error ? error.message : "本地数据校验失败。"),
    }
  }
}

async function runImporter(root: string, sampleId: string) {
  const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
  const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "import_dataset.py")
  const result = await runFile(python, [script, sampleId, "--dataset-root", root], {
    cwd: process.cwd(),
    windowsHide: true,
    timeout: 30_000,
  })
  return JSON.parse(result.stdout) as { status?: string }
}

function validateSharedInput(input: {
  images: File[]
  layer: string
  domain: string
  subtype: string
  form: FormData
}) {
  const errors: string[] = []
  if (!input.images.length) errors.push("请至少选择一张 PNG 图片")
  if (input.images.length > MAX_BATCH_FILES) errors.push(`每批最多上传 ${MAX_BATCH_FILES} 张图片`)
  if (!DATASET_LAYERS.some((item) => item.id === input.layer)) errors.push("训练层级无效")
  if (!DATASET_DOMAINS.some((item) => item.id === input.domain)) errors.push("数据领域无效")
  if (!input.subtype) errors.push("必须填写具体类型")
  for (const key of ["rightsApproved", "blueprintApproved", "visualQualityApproved", "directCopyProhibited"]) {
    if (input.form.get(key) !== "true") errors.push(`必须确认 ${key}`)
  }
  return errors
}

function validateImage(image: File) {
  if (image.type !== "image/png") return `${image.name} 不是 PNG 图片`
  if (image.size > MAX_IMAGE_BYTES) return `${image.name} 超过 12MB`
  return ""
}

function buildStructure(form: FormData, sampleId: string, layer: string) {
  if (layer !== "scene") {
    return {
      schemaVersion: "training-asset-annotation-v0",
      sampleId,
      subject: textField(form, "subtype"),
      components: csvField(form, "components"),
      componentMaterials: componentMaterialField(form),
      viewpoint: textField(form, "viewpoint"),
      tags: csvField(form, "tags"),
    }
  }
  const blueprint = JSON.parse(textField(form, "blueprint")) as Record<string, unknown>
  return { ...blueprint, sceneId: sampleId }
}

function buildMetadata(form: FormData, sampleId: string, layer: string, domain: string, subtype: string, structureName: string) {
  const today = new Date().toISOString().slice(0, 10)
  return {
    schemaVersion: "training-sample-metadata-v0", sampleId,
    datasetVersion: "ai-painter-dataset-v0", sampleLayer: layer, domain, subtype,
    tags: csvField(form, "tags"), components: csvField(form, "components"),
    componentMaterials: componentMaterialField(form), viewpoint: textField(form, "viewpoint"),
    targetImage: "target.png",
    ...(layer === "scene" ? { blueprintFile: structureName } : { annotationFile: structureName }),
    source: {
      kind: "ai_assisted_manual_creation", toolName: textField(form, "toolName"),
      createdAt: today, licenseBasis: textField(form, "licenseBasis"),
      humanApproved: true, directCopyProhibited: true,
    },
    review: {
      reviewer: textField(form, "reviewer"), reviewedAt: today,
      rightsApproved: true, blueprintApproved: true, visualQualityApproved: true,
    },
    notes: textField(form, "notes"),
  }
}

function textField(form: FormData, key: string) { const value = form.get(key); return typeof value === "string" ? value.trim() : "" }
function csvField(form: FormData, key: string) { return textField(form, key).split(/[,，]/u).map((item) => item.trim()).filter(Boolean) }
function componentMaterialField(form: FormData) {
  return csvField(form, "componentMaterials").map((entry) => {
    const [component, material] = entry.split(":").map((item) => item.trim())
    return { component, material }
  }).filter((item) => item.component && item.material)
}
function response(ok: boolean, message: string, status: number) { return NextResponse.json({ ok, message }, { status }) }
function extractProcessOutput(error: unknown) {
  if (!error || typeof error !== "object") return ""
  const value = error as { stdout?: string; stderr?: string }
  try { return value.stdout ? JSON.parse(value.stdout).errors?.join("；") ?? value.stdout : value.stderr ?? "" } catch { return value.stderr ?? value.stdout ?? "" }
}
