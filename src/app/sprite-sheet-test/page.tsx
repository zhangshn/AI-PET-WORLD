/**
 * 当前文件负责：展示 Sprite Sheet 元数据与视觉变体映射。
 */

import type {
  SpriteFrameMetadata,
} from "../../sprite-system/sprite-system-gateway"
import {
  spriteFrames,
  spriteMetadataIndex,
} from "../../sprite-system/sprite-system-gateway"

import styles from "./sprite-sheet-test.module.css"

const coreRules = [
  "紫微斗数是第一核心，八字只在出生时间缺失时辅助补全。",
  "VisualDNA 决定 SpriteVariant，SpriteVariant 再绑定 Sprite Sheet 元数据。",
  "CSS 只用于测试页和占位，最终像素游戏质感必须依赖 Sprite Sheet。",
  "所有世界对象必须吸附 16px 网格，并保留尺寸、锚点、占地信息。",
  "领养中心替代孵化器，页面和资源命名不得出现孵化相关概念。",
]

const categoryLabels: Record<string, string> = {
  tile: "地面 Tile",
  nature: "自然物件",
  butler: "管家角色",
  pet: "宠物角色",
  building: "建筑物件",
  facility: "设施物件",
  effect: "特效物件",
}

function getCategoryLabel(category: string) {
  return categoryLabels[category] ?? category
}

function getPreviewClass(frame: SpriteFrameMetadata) {
  if (frame.category === "butler") return styles.previewButler
  if (frame.category === "pet") return styles.previewPet
  if (frame.category === "nature") return styles.previewTree
  if (frame.category === "facility") return styles.previewCare
  if (frame.category === "tile") return styles.previewTile
  if (frame.id.includes("adoption_center")) return styles.previewAdoption
  if (frame.id.includes("home_")) return styles.previewHouse

  return styles.previewShelter
}

function renderPreviewParts(frame: SpriteFrameMetadata) {
  if (frame.category === "butler") {
    return (
      <>
        <i className={styles.partHead} />
        <i className={styles.partBody} />
        <i className={styles.partArmLeft} />
        <i className={styles.partArmRight} />
        <i className={styles.partLegLeft} />
        <i className={styles.partLegRight} />
      </>
    )
  }

  if (frame.category === "pet") {
    return (
      <>
        <i className={styles.partPetBody} />
        <i className={styles.partPetEarLeft} />
        <i className={styles.partPetEarRight} />
        <i className={styles.partPetTail} />
        <i className={styles.partPetEye} />
      </>
    )
  }

  if (frame.category === "nature") {
    return (
      <>
        <i className={styles.partTreeTrunk} />
        <i className={styles.partTreeCrown} />
        <i className={styles.partTreeLeafA} />
        <i className={styles.partTreeLeafB} />
      </>
    )
  }

  if (frame.category === "facility") {
    return (
      <>
        <i className={styles.partMat} />
        <i className={styles.partFoodBowl} />
        <i className={styles.partWaterBowl} />
        <i className={styles.partStorage} />
      </>
    )
  }

  if (frame.category === "tile") {
    return (
      <>
        <i className={styles.partTileA} />
        <i className={styles.partTileB} />
        <i className={styles.partTileC} />
      </>
    )
  }

  return (
    <>
      <i className={styles.partRoof} />
      <i className={styles.partWall} />
      <i className={styles.partDoor} />
      <i className={styles.partWindow} />
    </>
  )
}

function renderFramePreview(frame: SpriteFrameMetadata) {
  return (
    <div className={styles.framePreview}>
      <span
        className={`${styles.previewSprite} ${getPreviewClass(frame)}`}
        style={{
          width: `${Math.max(24, frame.rect.width / 2)}px`,
          height: `${Math.max(24, frame.rect.height / 2)}px`,
        }}
      >
        {renderPreviewParts(frame)}
      </span>
    </div>
  )
}

export default function SpriteSheetTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>SPRITE-04</p>
        <h1>Sprite Sheet Metadata / 像素资源元数据测试页</h1>
        <p>
          本页面用于检查 AI-PET-WORLD 的 Sprite Sheet 规范是否已经可被系统读取：
          包括 sheet、frame、variant mapping、尺寸、锚点、占地网格和中文说明。当前预览是按分类生成的开发占位，不是最终美术。
        </p>
      </section>

      <section className={styles.section}>
        <h2>核心规则</h2>
        <div className={styles.ruleGrid}>
          {coreRules.map((rule, index) => (
            <article key={rule} className={styles.ruleCard}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{rule}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article>
          <strong>{spriteMetadataIndex.sheets.length}</strong>
          <span>Sprite Sheets</span>
        </article>
        <article>
          <strong>{spriteFrames.length}</strong>
          <span>Frames</span>
        </article>
        <article>
          <strong>{spriteMetadataIndex.variantMappings.length}</strong>
          <span>Variant Mappings</span>
        </article>
      </section>

      <section className={styles.section}>
        <h2>Sprite Sheets / 图集</h2>
        <div className={styles.sheetGrid}>
          {spriteMetadataIndex.sheets.map((sheet) => (
            <article key={sheet.id} className={styles.sheetCard}>
              <header>
                <div>
                  <p className={styles.eyebrow}>{getCategoryLabel(sheet.category)}</p>
                  <h3>{sheet.id}</h3>
                </div>
                <span>{sheet.frames.length} frames</span>
              </header>
              <p>路径：{sheet.imagePath}</p>
              <p>单帧：{sheet.frameWidth}x{sheet.frameHeight}px</p>
              <p>Tile：{sheet.tileSize}px / 放大倍率：{sheet.pixelScale}</p>
              <p>{sheet.notes}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Variant Mapping / 视觉变体映射</h2>
        <div className={styles.mappingGrid}>
          {spriteMetadataIndex.variantMappings.map((mapping) => (
            <article key={mapping.spriteVariantId} className={styles.mappingCard}>
              <h3>{mapping.spriteVariantId}</h3>
              <p>Sheet：{mapping.sheetId}</p>
              <p>Frame：{mapping.frameId}</p>
              <p>Animation：{mapping.animationId}</p>
              <p>{mapping.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Frames / 帧元数据</h2>
        <div className={styles.frameGrid}>
          {spriteFrames.map((frame) => (
            <article key={frame.id} className={styles.frameCard}>
              {renderFramePreview(frame)}
              <div>
                <p className={styles.eyebrow}>{getCategoryLabel(frame.category)}</p>
                <h3>{frame.name}</h3>
                <p>{frame.id}</p>
                <p>Sheet：{frame.sheetId}</p>
                <p>Rect：x{frame.rect.x} y{frame.rect.y} / {frame.rect.width}x{frame.rect.height}px</p>
                <p>Anchor：{frame.anchor.x}, {frame.anchor.y}</p>
                <p>占地：{frame.gridSize.columns}x{frame.gridSize.rows} tile</p>
                <p>{frame.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
