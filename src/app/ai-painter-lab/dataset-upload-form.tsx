"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { DATASET_DOMAINS, DATASET_LAYERS } from "./dataset-taxonomy"
import styles from "./page.module.css"

const DEFAULT_BLUEPRINT = `{
  "schemaVersion": "world-blueprint-v0",
  "sceneId": "自动生成",
  "width": 256,
  "height": 192,
  "seed": 101,
  "styleId": "bright-healing-topdown-pixel-v0",
  "terrainRegions": [
    {"id":"grass-main","terrain":"grass","polygon":[[0,0],[255,0],[255,191],[0,191]]}
  ],
  "roads": [{"id":"road-entry","width":10,"points":[[30,191],[90,130],[150,105]]}],
  "objects": [{"id":"shelter-1","kind":"shelter","x":120,"y":82,"width":42,"height":34,"stage":1}]
}`

type BatchUploadResponse = {
  ok: boolean
  message: string
  results?: Array<{ fileName: string; sampleId?: string; ok: boolean; message: string }>
}

export function DatasetUploadForm() {
  const router = useRouter()
  const [layer, setLayer] = useState("scene")
  const [selectedCount, setSelectedCount] = useState(0)
  const [status, setStatus] = useState("")
  const [details, setDetails] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus(`正在校验并导入 ${selectedCount} 张本地图片...`)
    setDetails([])
    const form = event.currentTarget
    try {
      const response = await fetch("/api/ai-painter/dataset/upload", {
        method: "POST", body: new FormData(form),
      })
      const result = await response.json() as BatchUploadResponse
      setStatus(result.message)
      setDetails(result.results?.map((item) =>
        `${item.ok ? "成功" : "失败"}｜${item.fileName}${item.sampleId ? ` → ${item.sampleId}` : ""}${item.ok ? "" : `｜${item.message}`}`
      ) ?? [])
      if (result.ok) {
        form.reset()
        setLayer("scene")
        setSelectedCount(0)
        router.refresh()
      }
    } catch {
      setStatus("上传请求失败，请检查本地开发服务。")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.uploadForm} onSubmit={submit}>
      <p className={styles.batchNotice}>
        支持一次选择最多 20 张同类 PNG。样本 ID 将根据层级、领域、文件名和随机短码自动生成，无需手工填写。
      </p>
      <div className={styles.formGrid}>
        <label>训练层级<select name="sampleLayer" value={layer} onChange={(event) => setLayer(event.target.value)}>{DATASET_LAYERS.map((item) => <option value={item.id} key={item.id}>{item.zh} / {item.size}</option>)}</select></label>
        <label>数据领域<select name="domain" defaultValue="world">{DATASET_DOMAINS.map((item) => <option value={item.id} key={item.id}>{item.zh}</option>)}</select></label>
        <label>具体类型<input name="subtype" required placeholder="early_settlement / grassland" /></label>
        <label>标签<input name="tags" required placeholder="bright, healing, top_down" /></label>
        <label>组成部分<input name="components" required placeholder="grass, path, shelter, trees" /></label>
        <label>部件材质映射<input name="componentMaterials" required placeholder="shelter:wood, path:soil" /></label>
        <label>观察视角<input name="viewpoint" required defaultValue="fixed_three_quarter_top_down" /></label>
        <label>制作工具<input name="toolName" required defaultValue="OpenAI image generation via Codex" /></label>
        <label>审核人<input name="reviewer" required defaultValue="project-owner" /></label>
      </div>
      <label className={styles.wideField}>训练 PNG（可多选）<input type="file" name="images" accept="image/png" multiple required onChange={(event) => setSelectedCount(event.currentTarget.files?.length ?? 0)} /></label>
      <p className={styles.fileCount}>已选择 {selectedCount} 张图片。</p>
      <label className={styles.wideField}>许可依据<textarea name="licenseBasis" required placeholder="说明图片归属、商业训练与使用权。" /></label>
      <label className={styles.wideField}>备注<textarea name="notes" placeholder="说明本批画面内容、风格和用途。" /></label>
      {layer === "scene" && <>
        <p className={styles.batchWarning}>本批完整场景会共用下方 Blueprint。只有主要地形、道路与对象结构标注一致的图片才能放在同一批。</p>
        <label className={styles.wideField}>Scene Blueprint<textarea className={styles.blueprintInput} name="blueprint" required defaultValue={DEFAULT_BLUEPRINT} /></label>
      </>}
      <div className={styles.confirmations}>
        <label><input type="checkbox" name="rightsApproved" value="true" required />版权与商业训练权已确认</label>
        <label><input type="checkbox" name="blueprintApproved" value="true" required />图片内容与结构标注一致</label>
        <label><input type="checkbox" name="visualQualityApproved" value="true" required />视觉质量已人工确认</label>
        <label><input type="checkbox" name="directCopyProhibited" value="true" required />不是对第三方作品的直接复制</label>
      </div>
      <div className={styles.submitRow}><button disabled={busy || selectedCount === 0} type="submit">{busy ? "正在批量导入" : "校验并批量导入本地数据集"}</button><span>{status}</span></div>
      {details.length > 0 && <ul className={styles.batchResults}>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
    </form>
  )
}
