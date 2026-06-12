import { execFile } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import { NextResponse } from "next/server"

import { DATASET_DOMAINS, DATASET_LAYERS } from "@/app/ai-painter-lab/dataset-taxonomy"

const runFile = promisify(execFile)
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const SAMPLE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/u

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return response(false, "生产环境禁止上传训练数据。", 403)
  }

  try {
    const form = await request.formData()
    const image = form.get("image")
    const sampleId = textField(form, "sampleId")
    const layer = textField(form, "sampleLayer")
    const domain = textField(form, "domain")
    const subtype = textField(form, "subtype")
    const errors = validateInput({ image, sampleId, layer, domain, subtype, form })
    if (errors.length) return response(false, errors.join("；"), 422)

    const root = path.join(process.cwd(), "data", "ai-painter-datasets")
    const incoming = path.join(root, "incoming", sampleId)
    await rm(incoming, { recursive: true, force: true })
    await mkdir(incoming, { recursive: true })

    await writeFile(path.join(incoming, "target.png"), Buffer.from(await (image as File).arrayBuffer()))
    const structure = buildStructure(form, sampleId, layer)
    const structureName = layer === "scene" ? "blueprint.json" : "annotation.json"
    await writeFile(path.join(incoming, structureName), JSON.stringify(structure, null, 2), "utf8")
    await writeFile(
      path.join(incoming, "metadata.json"),
      JSON.stringify(buildMetadata(form, sampleId, layer, domain, subtype, structureName), null, 2),
      "utf8"
    )

    const python = path.join(process.cwd(), "ml", "ai-painter", ".venv", "Scripts", "python.exe")
    const script = path.join(process.cwd(), "ml", "ai-painter", "scripts", "import_dataset.py")
    try {
      const result = await runFile(python, [script, sampleId, "--dataset-root", root], {
        cwd: process.cwd(),
        windowsHide: true,
        timeout: 30_000,
      })
      return NextResponse.json({ ok: true, message: "训练样本已校验并归档。", result: JSON.parse(result.stdout) })
    } catch (error) {
      const output = extractProcessOutput(error)
      return response(false, output || "本地数据校验失败。", 422)
    }
  } catch (error) {
    return response(false, error instanceof Error ? error.message : "上传处理失败。", 500)
  }
}

function validateInput(input: { image: FormDataEntryValue | null; sampleId: string; layer: string; domain: string; subtype: string; form: FormData }) {
  const errors: string[] = []
  if (!(input.image instanceof File) || input.image.size === 0) errors.push("请选择 PNG 图片")
  else if (input.image.type !== "image/png") errors.push("训练图片必须是 PNG")
  else if (input.image.size > MAX_IMAGE_BYTES) errors.push("图片不能超过 12MB")
  if (!SAMPLE_ID_PATTERN.test(input.sampleId)) errors.push("样本 ID 只能使用小写字母、数字和连字符")
  if (!DATASET_LAYERS.some((item) => item.id === input.layer)) errors.push("训练层级无效")
  if (!DATASET_DOMAINS.some((item) => item.id === input.domain)) errors.push("数据领域无效")
  if (!input.subtype) errors.push("必须填写具体类型")
  for (const key of ["rightsApproved", "blueprintApproved", "visualQualityApproved", "directCopyProhibited"]) {
    if (input.form.get(key) !== "true") errors.push(`必须确认 ${key}`)
  }
  return errors
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
  const blueprintText = textField(form, "blueprint")
  const blueprint = JSON.parse(blueprintText) as Record<string, unknown>
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
