import {
  ZIWEI_SOURCE_REFERENCE_LAYER_INDEX,
  type ZiweiSourceReferenceLayerIndexItem
} from "./source-reference-index"
import { getAllTheorySourceReferenceContentDetails } from "./theory-source-reference-catalog"

export type ZiweiSourceReferenceReviewTier =
  | "hard-rule"
  | "dictionary-baseline"
  | "lineage-reference"
  | "synthesis-boundary"
  | "manual-review"
  | "metadata-only"

export type ZiweiSourceReferenceReviewPriority = "P0" | "P1" | "P2" | "P3"

export interface ZiweiSourceReferenceReviewQueueItem {
  queueId: string
  sourceId: string
  sourceTitle: string
  sourceKind: string
  sourceReliability: "high" | "medium" | "low"
  reviewTier: ZiweiSourceReferenceReviewTier
  priority: ZiweiSourceReferenceReviewPriority
  canActAsHardRule: boolean
  citedByLayerIds: string[]
  citedRecordCount: number
  reviewFocus: string[]
  downgradeBoundary: string[]
  nextAction: string
}

const hardRuleSourceIds = new Set([
  "project.star-catalog",
  "project.pattern-catalog",
  "project.transformation-rules",
  "project.brightness-table",
  "project.dynamic-flow-rules"
])

const dictionaryBaselineSourceIds = new Set(["project.content-dictionary"])

const lineageReferenceSourceIds = new Set([
  "classic.ziwei-doushu-quanshu",
  "classic.ziwei-doushu-quanshu-shuge-index",
  "classic.ziwei-doushu-lineage-ctext-index"
])

const synthesisBoundarySourceIds = new Set(["internal.synthesis-reading-order"])
const manualReviewSourceIds = new Set(["human.calibration-notes"])
const metadataOnlySourceIds = new Set(["external.modern-reference-metadata"])

export const ZIWEI_SOURCE_REFERENCE_REVIEW_QUEUE: ZiweiSourceReferenceReviewQueueItem[] =
  getAllTheorySourceReferenceContentDetails().map((source) => {
    const citedLayers = findCitedLayers(source.sourceId)
    const citedRecordCount = citedLayers.reduce((total, layer) => {
      return total + layer.recordCount
    }, 0)

    return {
      queueId: `source-reference-review.${source.sourceId}`,
      sourceId: source.sourceId,
      sourceTitle: source.title,
      sourceKind: source.sourceKind,
      sourceReliability: source.sourceReliability,
      reviewTier: getReviewTier(source.sourceId),
      priority: getReviewPriority(source.sourceId, citedRecordCount),
      canActAsHardRule: hardRuleSourceIds.has(source.sourceId),
      citedByLayerIds: citedLayers.map((layer) => layer.layerId),
      citedRecordCount,
      reviewFocus: getReviewFocus(source.sourceId),
      downgradeBoundary: getDowngradeBoundary(source.sourceId),
      nextAction: getNextAction(source.sourceId, citedRecordCount)
    }
  })

export function getAllZiweiSourceReferenceReviewQueueItems(): ZiweiSourceReferenceReviewQueueItem[] {
  return ZIWEI_SOURCE_REFERENCE_REVIEW_QUEUE
}

export function getZiweiSourceReferenceReviewQueueItem(
  sourceId: string
): ZiweiSourceReferenceReviewQueueItem | undefined {
  return ZIWEI_SOURCE_REFERENCE_REVIEW_QUEUE.find((item) => {
    return item.sourceId === sourceId
  })
}

function findCitedLayers(sourceId: string): ZiweiSourceReferenceLayerIndexItem[] {
  return ZIWEI_SOURCE_REFERENCE_LAYER_INDEX.filter((layer) => {
    return layer.sourceIds.includes(sourceId)
  })
}

function getReviewTier(sourceId: string): ZiweiSourceReferenceReviewTier {
  if (hardRuleSourceIds.has(sourceId)) {
    return "hard-rule"
  }

  if (dictionaryBaselineSourceIds.has(sourceId)) {
    return "dictionary-baseline"
  }

  if (lineageReferenceSourceIds.has(sourceId)) {
    return "lineage-reference"
  }

  if (synthesisBoundarySourceIds.has(sourceId)) {
    return "synthesis-boundary"
  }

  if (manualReviewSourceIds.has(sourceId)) {
    return "manual-review"
  }

  if (metadataOnlySourceIds.has(sourceId)) {
    return "metadata-only"
  }

  return "metadata-only"
}

function getReviewPriority(
  sourceId: string,
  citedRecordCount: number
): ZiweiSourceReferenceReviewPriority {
  if (hardRuleSourceIds.has(sourceId)) {
    return "P0"
  }

  if (sourceId === "project.content-dictionary" || sourceId === "internal.synthesis-reading-order") {
    return "P1"
  }

  if (sourceId === "classic.ziwei-doushu-quanshu" || citedRecordCount > 0) {
    return "P2"
  }

  return "P3"
}

function getReviewFocus(sourceId: string): string[] {
  if (hardRuleSourceIds.has(sourceId)) {
    return [
      "确认该来源是否仍是对应算法的唯一结构来源。",
      "确认资料字典没有重复定义该算法表。",
      "确认检查脚本覆盖该来源被引用的资料层。"
    ]
  }

  if (sourceId === "project.content-dictionary") {
    return [
      "确认解释内容为项目原创整理。",
      "确认解释不直接生成当前盘结论。",
      "确认新增资料不会复制现代书籍、课程、网站或软件成套表达。"
    ]
  }

  if (sourceId === "classic.ziwei-doushu-quanshu") {
    return [
      "确认古籍只作为术语、名称和脉络参考。",
      "确认没有复制长段赋文或整段断语。",
      "确认版本差异进入 medium confidence 或人工复核。"
    ]
  }

  if (lineageReferenceSourceIds.has(sourceId)) {
    return [
      "确认该来源只作为古籍目录、版本或查书入口。",
      "确认不把索引条目当作具体断法。",
      "确认需要人工二次核验的条目已标记。"
    ]
  }

  if (sourceId === "internal.synthesis-reading-order") {
    return [
      "确认优先级、降权、隐藏和复核规则能回到字段证据。",
      "确认项目归纳没有伪装成古籍原文。",
      "确认高风险或证据不足的结论不会被硬输出。"
    ]
  }

  if (sourceId === "human.calibration-notes") {
    return [
      "确认人工结论包含样例、日期、差异点和复核状态。",
      "确认单一样例不会被写成通用理论。",
      "确认第三方案例只存元信息和项目自有摘要。"
    ]
  }

  return [
    "确认只保存元信息、主题索引和复核状态。",
    "确认不复制受版权保护正文、截图、图标、商标或成套排版。",
    "确认现代资料不能直接作为项目规则唯一来源。"
  ]
}

function getDowngradeBoundary(sourceId: string): string[] {
  if (hardRuleSourceIds.has(sourceId)) {
    return [
      "项目算法来源可作为命中、落点、四化、庙旺落陷或动态层级的硬规则。",
      "若与人工解释冲突，优先保留算法结果，解释进入复核。"
    ]
  }

  if (sourceId === "project.content-dictionary") {
    return [
      "数据字典是解释基线，不等于当前盘结论。",
      "当前盘输出必须同时满足盘中证据和展示门槛。"
    ]
  }

  if (lineageReferenceSourceIds.has(sourceId)) {
    return [
      "古籍或索引来源只能提供脉络、术语和人工复核方向。",
      "未被项目算法或人工校验承接前，不作为当前盘硬规则。"
    ]
  }

  if (sourceId === "internal.synthesis-reading-order") {
    return [
      "项目归纳只决定排序、降权、隐藏和复核，不制造新的命中事实。",
      "涉及短周期、风险主题或证据不足时必须降权。"
    ]
  }

  if (sourceId === "human.calibration-notes") {
    return [
      "人工校盘结论用于校正和补缺，不直接覆盖项目算法。",
      "未复核样例只能进入待确认队列。"
    ]
  }

  return [
    "现代资料元信息只作为查证入口。",
    "未完成版权和内容复核前，不进入解释输出。"
  ]
}

function getNextAction(sourceId: string, citedRecordCount: number): string {
  if (hardRuleSourceIds.has(sourceId)) {
    return "保持检查脚本覆盖；算法改动时同步更新来源引用索引和样例。"
  }

  if (sourceId === "project.content-dictionary") {
    return "继续补充原创结构化解释，并为新增资料登记 sourceReferences。"
  }

  if (sourceId === "classic.ziwei-doushu-quanshu") {
    return "补充篇目、术语和主题索引，避免复制长段原文。"
  }

  if (lineageReferenceSourceIds.has(sourceId) && citedRecordCount === 0) {
    return "作为待核验索引保留，后续人工查书后再挂入具体资料层。"
  }

  if (sourceId === "internal.synthesis-reading-order") {
    return "继续把优先级、降权和隐藏规则落到字段标准、门槛和证据域对照。"
  }

  if (sourceId === "human.calibration-notes") {
    return "后续补人工样例和差异摘要，禁止把单一样例写成通用理论。"
  }

  return "只登记元信息和复核状态，等待人工确认版权与内容边界。"
}
