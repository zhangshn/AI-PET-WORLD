"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { DATASET_DOMAINS, DATASET_LAYERS } from "./dataset-taxonomy"
import styles from "./page.module.css"

const DEFAULT_BLUEPRINT = `{
  "schemaVersion": "world-blueprint-v0",
  "sceneId": "replaced-on-upload",
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

export function DatasetUploadForm() {
  const router = useRouter()
  const [layer, setLayer] = useState("scene")
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setStatus("正在执行本地校验与归档...")
    const form = event.currentTarget
    try {
      const response = await fetch("/api/ai-painter/dataset/upload", {
        method: "POST", body: new FormData(form),
      })
      const result = await response.json() as { ok: boolean; message: string }
      setStatus(result.message)
      if (result.ok) { form.reset(); setLayer("scene"); router.refresh() }
    } catch { setStatus("上传请求失败，请检查本地开发服务。") }
    finally { setBusy(false) }
  }

  return (
    <form className={styles.uploadForm} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label>样本 ID<input name="sampleId" required pattern="[a-z0-9][a-z0-9-]{2,63}" placeholder="forest-scene-001" /></label>
        <label>训练层级<select name="sampleLayer" value={layer} onChange={(event) => setLayer(event.target.value)}>{DATASET_LAYERS.map((item) => <option value={item.id} key={item.id}>{item.zh} / {item.size}</option>)}</select></label>
        <label>数据领域<select name="domain" defaultValue="world">{DATASET_DOMAINS.map((item) => <option value={item.id} key={item.id}>{item.zh}</option>)}</select></label>
        <label>具体类型<input name="subtype" required placeholder="wood_house / butler / grassland" /></label>
        <label>标签<input name="tags" required placeholder="bright, healing, top_down" /></label>
        <label>组成部分<input name="components" required placeholder="roof, wall, door / head, hair" /></label>
        <label>部件材质映射<input name="componentMaterials" required placeholder="roof:wood, wall:wood, foundation:stone" /></label>
        <label>观察视角<input name="viewpoint" required defaultValue="fixed_top_down" /></label>
        <label>制作工具<input name="toolName" required placeholder="人工使用的图片制作工具" /></label>
        <label>审核人<input name="reviewer" required defaultValue="project-owner" /></label>
      </div>
      <label className={styles.wideField}>训练 PNG<input type="file" name="image" accept="image/png" required /></label>
      <label className={styles.wideField}>许可依据<textarea name="licenseBasis" required placeholder="说明图片归属、商业训练与使用权。" /></label>
      <label className={styles.wideField}>备注<textarea name="notes" placeholder="说明画面内容、风格和用途。" /></label>
      {layer === "scene" && <label className={styles.wideField}>Scene Blueprint<textarea className={styles.blueprintInput} name="blueprint" required defaultValue={DEFAULT_BLUEPRINT} /></label>}
      <div className={styles.confirmations}>
        <label><input type="checkbox" name="rightsApproved" value="true" required />版权与商业训练权已确认</label>
        <label><input type="checkbox" name="blueprintApproved" value="true" required />图片内容与结构标注一致</label>
        <label><input type="checkbox" name="visualQualityApproved" value="true" required />视觉质量已人工确认</label>
        <label><input type="checkbox" name="directCopyProhibited" value="true" required />不是对第三方作品的直接复制</label>
      </div>
      <div className={styles.submitRow}><button disabled={busy} type="submit">{busy ? "正在导入" : "校验并导入本地数据集"}</button><span>{status}</span></div>
    </form>
  )
}
