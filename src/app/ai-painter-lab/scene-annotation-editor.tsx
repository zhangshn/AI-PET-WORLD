"use client"

import { MouseEvent, useEffect, useMemo, useState } from "react"
import type { AnnotationTool, Point, SceneBlueprint, SceneDatasetItem, SceneObject } from "./scene-annotation-types"
import styles from "./page.module.css"

const TOOLS: Array<{ id: AnnotationTool; label: string }> = [
  { id: "grass", label: "草地区域" },
  { id: "water", label: "水域区域" },
  { id: "road", label: "道路" },
  { id: "tree", label: "树木" },
  { id: "rock", label: "石块" },
  { id: "shelter", label: "住所/建筑" },
]

export function SceneAnnotationEditor() {
  const [scenes, setScenes] = useState<SceneDatasetItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [blueprint, setBlueprint] = useState<SceneBlueprint | null>(null)
  const [tool, setTool] = useState<AnnotationTool>("water")
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [boxStart, setBoxStart] = useState<Point | null>(null)
  const [status, setStatus] = useState("正在读取已导入场景...")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadScenes()
  }, [])

  const scene = useMemo(() => scenes.find((item) => item.sampleId === selectedId) ?? null, [scenes, selectedId])

  async function loadScenes(preferredId?: string) {
    const response = await fetch("/api/ai-painter/dataset/scenes", { cache: "no-store" })
    const result = await response.json() as { ok: boolean; scenes?: SceneDatasetItem[]; message?: string }
    if (!result.ok || !result.scenes?.length) {
      setStatus(result.message ?? "当前没有可标注的完整场景。")
      return
    }
    setScenes(result.scenes)
    selectScene(result.scenes, preferredId ?? result.scenes[0].sampleId)
  }

  function selectScene(source: SceneDatasetItem[], sampleId: string) {
    const next = source.find((item) => item.sampleId === sampleId)
    if (!next) return
    setSelectedId(sampleId)
    setBlueprint(structuredClone(next.blueprint))
    setDraftPoints([])
    setBoxStart(null)
    setStatus("请选择工具并在画面上标注。")
  }

  function changeScene(sampleId: string) {
    selectScene(scenes, sampleId)
  }

  function changeTool(nextTool: AnnotationTool) {
    setTool(nextTool)
    setDraftPoints([])
    setBoxStart(null)
  }

  function canvasPoint(event: MouseEvent<SVGSVGElement>): Point {
    const rectangle = event.currentTarget.getBoundingClientRect()
    return [
      clamp(Math.round((event.clientX - rectangle.left) / rectangle.width * 256), 0, 255),
      clamp(Math.round((event.clientY - rectangle.top) / rectangle.height * 192), 0, 191),
    ]
  }

  function annotate(event: MouseEvent<SVGSVGElement>) {
    if (!blueprint) return
    const point = canvasPoint(event)
    if (tool === "grass" || tool === "water" || tool === "road") {
      setDraftPoints((current) => [...current, point])
      return
    }
    if (!boxStart) {
      setBoxStart(point)
      setStatus("已确定对象左上角，请点击右下角。")
      return
    }
    const object = createObject(tool, boxStart, point, blueprint.objects.length + 1)
    setBlueprint({ ...blueprint, objects: [...blueprint.objects, object] })
    setBoxStart(null)
    setStatus(`已添加${TOOLS.find((item) => item.id === tool)?.label ?? "对象"}。`)
  }

  function finishShape() {
    if (!blueprint) return
    if ((tool === "grass" || tool === "water") && draftPoints.length >= 3) {
      const terrainRegions = [...blueprint.terrainRegions, {
        id: `${tool}-${blueprint.terrainRegions.length + 1}`,
        terrain: tool,
        polygon: draftPoints,
      }]
      setBlueprint({ ...blueprint, terrainRegions })
      setDraftPoints([])
      return
    }
    if (tool === "road" && draftPoints.length >= 2) {
      setBlueprint({ ...blueprint, roads: [...blueprint.roads, {
        id: `road-${blueprint.roads.length + 1}`, width: 8, points: draftPoints,
      }] })
      setDraftPoints([])
      return
    }
    setStatus("区域至少需要 3 个点，道路至少需要 2 个点。")
  }

  function clearCurrentType() {
    if (!blueprint) return
    if (tool === "grass" || tool === "water") {
      setBlueprint({ ...blueprint, terrainRegions: blueprint.terrainRegions.filter((item) => item.terrain !== tool) })
    } else if (tool === "road") {
      setBlueprint({ ...blueprint, roads: [] })
    } else {
      setBlueprint({ ...blueprint, objects: blueprint.objects.filter((item) => item.kind !== tool) })
    }
    setDraftPoints([])
    setBoxStart(null)
  }

  function resetBlueprint() {
    if (!scene) return
    setBlueprint({
      schemaVersion: "world-blueprint-v0", sceneId: scene.sampleId,
      width: 256, height: 192, seed: scene.blueprint.seed,
      styleId: scene.blueprint.styleId,
      terrainRegions: [], roads: [], objects: [],
    })
    setDraftPoints([])
    setBoxStart(null)
    setStatus("已清空当前 Blueprint，请从草地区域开始重新标注。")
  }

  async function save() {
    if (!blueprint || !selectedId) return
    setSaving(true)
    setStatus("正在校验 Blueprint 并重新生成 8 通道 Mask...")
    try {
      const response = await fetch(`/api/ai-painter/dataset/scenes/${selectedId}/annotation`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(blueprint),
      })
      const result = await response.json() as { ok: boolean; message: string }
      setStatus(result.message)
      if (result.ok) await loadScenes(selectedId)
    } catch {
      setStatus("保存失败，请检查本地开发服务。")
    } finally {
      setSaving(false)
    }
  }

  if (!scene || !blueprint) return <p className={styles.annotationEmpty}>{status}</p>

  return (
    <div className={styles.annotationEditor}>
      <div className={styles.annotationToolbar}>
        <label>当前场景<select value={selectedId} onChange={(event) => changeScene(event.target.value)}>{scenes.map((item) => <option key={item.sampleId} value={item.sampleId}>{item.sampleId}</option>)}</select></label>
        <div className={styles.toolButtons}>{TOOLS.map((item) => <button className={tool === item.id ? styles.activeTool : ""} type="button" key={item.id} onClick={() => changeTool(item.id)}>{item.label}</button>)}</div>
        <button type="button" onClick={finishShape}>完成当前区域/道路</button>
        <button type="button" onClick={clearCurrentType}>清除当前类型</button>
        <button type="button" onClick={resetBlueprint}>清空全部标注</button>
      </div>
      <div className={styles.annotationWorkspace}>
        <div className={styles.annotationCanvas}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={scene.imageUrl} alt={`${scene.sampleId} 训练场景`} />
          <svg viewBox="0 0 256 192" onClick={annotate} aria-label="场景标注画布">
            {blueprint.terrainRegions.map((region) => <polygon key={region.id} points={pointsAttribute(region.polygon)} className={region.terrain === "water" ? styles.waterRegion : styles.grassRegion} />)}
            {blueprint.roads.map((road) => <polyline key={road.id} points={pointsAttribute(road.points)} className={styles.roadLine} style={{ strokeWidth: road.width }} />)}
            {blueprint.objects.map((item) => <rect key={item.id} x={item.x} y={item.y} width={item.width} height={item.height} className={styles[`${item.kind}Box`]} />)}
            {draftPoints.length > 0 && <polyline points={pointsAttribute(draftPoints)} className={styles.draftShape} />}
            {draftPoints.map((point, index) => <circle key={`${point[0]}-${point[1]}-${index}`} cx={point[0]} cy={point[1]} r="1.5" className={styles.draftPoint} />)}
            {boxStart && <circle cx={boxStart[0]} cy={boxStart[1]} r="2" className={styles.draftPoint} />}
          </svg>
        </div>
        <aside className={styles.annotationSummary}>
          <h3>当前标注</h3>
          <dl>
            <div><dt>草地区域</dt><dd>{countTerrain(blueprint, "grass")}</dd></div>
            <div><dt>水域区域</dt><dd>{countTerrain(blueprint, "water")}</dd></div>
            <div><dt>道路</dt><dd>{blueprint.roads.length}</dd></div>
            <div><dt>树木</dt><dd>{countObjects(blueprint, "tree")}</dd></div>
            <div><dt>石块</dt><dd>{countObjects(blueprint, "rock")}</dd></div>
            <div><dt>住所/建筑</dt><dd>{countObjects(blueprint, "shelter")}</dd></div>
          </dl>
          <p>{status}</p>
          <button type="button" disabled={saving} onClick={save}>{saving ? "正在保存" : "保存并重建 8 通道 Mask"}</button>
        </aside>
      </div>
    </div>
  )
}

function createObject(kind: SceneObject["kind"], start: Point, end: Point, number: number): SceneObject {
  const x = Math.min(start[0], end[0])
  const y = Math.min(start[1], end[1])
  return {
    id: `${kind}-${number}`, kind, x, y,
    width: Math.max(1, Math.abs(end[0] - start[0])),
    height: Math.max(1, Math.abs(end[1] - start[1])),
    ...(kind === "shelter" ? { stage: 1 } : {}),
  }
}

function pointsAttribute(points: Point[]) { return points.map((point) => point.join(",")).join(" ") }
function countTerrain(blueprint: SceneBlueprint, terrain: "grass" | "water") { return blueprint.terrainRegions.filter((item) => item.terrain === terrain).length }
function countObjects(blueprint: SceneBlueprint, kind: SceneObject["kind"]) { return blueprint.objects.filter((item) => item.kind === kind).length }
function clamp(value: number, minimum: number, maximum: number) { return Math.min(maximum, Math.max(minimum, value)) }
