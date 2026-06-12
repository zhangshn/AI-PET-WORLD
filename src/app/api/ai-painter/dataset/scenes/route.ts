import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const SCENE_ROOT = path.join(process.cwd(), "data", "ai-painter-datasets", "accepted", "dataset_v0", "scene", "world")

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, message: "生产环境禁止访问训练数据。" }, { status: 403 })
  }
  try {
    const directories = (await readdir(SCENE_ROOT, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const scenes = await Promise.all(directories.map(async (sampleId) => {
      const directory = path.join(SCENE_ROOT, sampleId)
      const [metadata, blueprint] = await Promise.all([
        readJson(path.join(directory, "metadata.json")),
        readJson(path.join(directory, "blueprint.json")),
      ])
      return {
        sampleId,
        subtype: typeof metadata.subtype === "string" ? metadata.subtype : "world_scene",
        imageUrl: `/api/ai-painter/dataset/scenes/${sampleId}/image`,
        blueprint,
      }
    }))
    return NextResponse.json({ ok: true, scenes })
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "读取场景失败。" }, { status: 500 })
  }
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>
}
