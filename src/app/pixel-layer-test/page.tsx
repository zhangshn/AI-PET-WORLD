/**
 * 当前文件负责：展示 pixel-ui 原子组件、像素原型、组合对象和测试场景。
 */

import type { ComponentType, ReactNode } from "react"

import {
  mockVisualArchetypeLabels,
  mockVisualGenerationResults,
} from "../../visual-system/visual-system.mock"
import type {
  PrefabVariant,
  SceneLayoutVariant,
  SpriteVariant,
  VisualDNA,
  VisualGenerationResult,
} from "../../visual-system/visual-system-gateway"
import {
  AdoptionCenterBody,
  AdoptionCenterRoof,
  AdoptionCenterSign,
  AdoptionCounter,
  ArrivalPoint,
  NoticeBoard,
  TownServiceMarker,
  WaitingBench,
} from "../world/components/pixel-ui/adoption-center"
import {
  ActorAnchor,
  ActorBodyBase,
  ActorShadow,
  ButlerActor,
  ButlerBody,
  ButlerEye,
  ButlerFeet,
  ButlerHair,
  ButlerHands,
  ButlerHat,
  ButlerHead,
  ButlerMouth,
  ButlerOutfit,
  ButlerShoe,
  ButlerSleeve,
  ButlerToolClipboard,
  ButlerToolFoodTray,
  ButlerToolHammer,
  PetActor,
  PetBackMark,
  PetBellyPatch,
  PetBody,
  PetEar,
  PetEye,
  PetHead,
  PetLegs,
  PetMouth,
  PetNose,
  PetPaw,
  PetTail,
  PetWhisker,
  PixelEye,
  PixelFootDetail,
  PixelHandDetail,
  PixelMouth,
} from "../world/components/pixel-ui/actors"
import {
  BuildingShadow,
  DoorHandle,
  DoorPanel,
  FenceSegment,
  FoundationBlock,
  RoofPiece,
  SignBoard,
  WallPanel,
  WindowLight,
  WindowPanel,
} from "../world/components/pixel-ui/buildings"
import {
  FoodBowl,
  GardenPatch,
  ObservationSpot,
  PetBed,
  StorageBox,
  WaterBowl,
  WelcomeMat,
} from "../world/components/pixel-ui/facilities"
import {
  FlowerPatch,
  GrassBlade,
  GrassCluster,
  GrassTile,
  TrampledGrass,
  WeedPatch,
} from "../world/components/pixel-ui/grass"
import {
  DirtPatch,
  GroundEdge,
  GroundTile,
} from "../world/components/pixel-ui/ground"
import {
  LowFiAdoptionCenterPrefab,
  LowFiArrivalPointPrefab,
  LowFiBasicHousePrefab,
  LowFiButlerPrefab,
  LowFiCareCornerPrefab,
  LowFiPetPrefab,
  LowFiTemporaryShelterPrefab,
  LowFiTreePrefab,
} from "../world/components/pixel-ui/low-fi-prefabs"
import {
  FallenLeaf,
  StoneSmall,
  TreeCanopy,
  TreeLeafCluster,
  TreeShadow,
  TreeTrunk,
} from "../world/components/pixel-ui/nature"
import {
  PixelAdoptionCenterPrototype,
  PixelArrivalPointPrototype,
  PixelBasicHousePrototype,
  PixelButlerPrototype,
  PixelCareCornerPrototype,
  PixelPetPrototype,
  PixelTemporaryShelterPrototype,
  PixelTreePrototype,
} from "../world/components/pixel-ui/pixel-art-prototypes"
import type {
  PixelPartProps,
  PixelPartVariant,
} from "../world/components/pixel-ui/pixel-ui.types"

import styles from "./pixel-layer-test.module.css"

type PrimitiveComponentItem = {
  cn: string
  en: string
  Component: ComponentType<PixelPartProps>
  previewClass: string
  variant?: PixelPartVariant
}

type PrimitiveComponentGroup = {
  title: string
  description: string
  items: PrimitiveComponentItem[]
}

type VisualCard = {
  cn: string
  en: string
  meaning: string
  preview: ReactNode
}

const coreRequirements = [
  "紫微斗数是产品第一核心，不是装饰功能。",
  "八字不是并列核心，只是出生时间缺失时的辅助补全机制。",
  "用户真实出生信息生成管家源头人格 / 初始形象。",
  "宠物不是随机宠物，而是根据用户紫微人格倾向匹配。",
  "宠物性格用真实抵达时间映射，不用游戏加速时间。",
  "UI 世界不是普通像素地图，而是紫微驱动生成的世界。",
  "世界资源像真实地球，有生成、消耗、恢复、循环。",
  "世界显示 24 小时制，命理映射走真实时间。",
  "管家自主建设家园，玩家不直接点击建造。",
  "管家根据紫微人格、资源、宠物需求建设房子 / 花园 / 照护点。",
  "现有小组件是 Primitive 语义零件，不是最终视觉。",
  "最终视觉应走 Sprite / Prefab / Scene，而不是色块拼接。",
  "房屋要有阶段：空地 → 照护点 → 临时住所 → 基础小屋 → 稳定家园。",
  "临时领养中心可以作为 MVP 临时设施，未来小镇有大型领养中心。",
  "社区规则本阶段不定义，未来由 AI 自发发起，人类不参与。",
  "每次继续开发前都必须打印此 MVP 核心表。",
]

const pipelineSteps = [
  "真实出生信息",
  "紫微斗数主算法",
  "出生时间缺失时，八字辅助补全",
  "DestinyProfile",
  "VisualDNA",
  "SpriteVariant",
  "PrefabVariant",
  "SceneLayout",
  "Pixel World",
]

const planItems = [
  "UI-00：PIXEL-UI-DIRECTORY-PLAN ✅ 已完成",
  "UI-01：PIXEL-UI-LAYER-COMPONENTS ✅ 已完成",
  "UI-02：GROUND-GRASS-NATURE-COMPONENTS ✅ 已完成",
  "UI-03：BUILDING-FACILITY-COMPONENTS ✅ 已完成",
  "UI-04：ACTOR-BASIC-COMPONENTS ✅ 已完成",
  "UI-05：ACTOR-DETAIL-COMPONENTS ✅ 已完成",
  "RULE-00：WORLD-TIME-AND-RESOURCE-RULES ✅ 已完成",
  "DEV-UI-01：PIXEL-LAYER-TEST-PAGE ✅ 已有",
  "CORE-00：MVP-CORE-REQUIREMENTS-LOCK ✅ 当前页面展示",
  "CORE-01：DESTINY-TO-VISUAL-RULES ✅ 文档锁定",
  "CORE-02：VISUAL-GENERATION-PIPELINE ✅ 文档锁定",
  "ART-00：PIXEL-ART-STYLE-GUIDE ✅ 文档锁定",
  "UI-06：LOW-FI-PIXEL-STAGE 暂不做",
]

const layerItems = [
  "GroundLayer：地面层",
  "GrassLayer：草地层",
  "TreeNatureLayer：树木自然层",
  "PathLayer：路径层",
  "BuildingBaseLayer：建筑基础层",
  "BuildingBodyLayer：建筑主体层",
  "BuildingDetailLayer：建筑细节层",
  "FacilityLayer：家具设施层",
  "ActorShadowLayer：角色阴影层",
  "ActorBodyLayer：角色身体层",
  "ActorDetailLayer：角色细节层",
  "ActorMotionLayer：角色动作层",
  "EffectLayer：情绪状态特效层",
  "InteractionLayer：交互反馈层",
  "AtmosphereLayer：时间天气氛围层",
]

const componentGroups: PrimitiveComponentGroup[] = [
  {
    title: "Ground / 地面",
    description: "地表、泥地区块和地面过渡边界。",
    items: [
      { cn: "地面基础块", en: "GroundTile", Component: GroundTile, previewClass: styles.primitiveGroundTile },
      { cn: "泥地区块", en: "DirtPatch", Component: DirtPatch, previewClass: styles.primitiveDirtPatch },
      { cn: "地面边界", en: "GroundEdge", Component: GroundEdge, previewClass: styles.primitiveGroundEdge },
    ],
  },
  {
    title: "Grass / 草地",
    description: "草皮、小草、草丛、小花、杂草和踩踏草痕。",
    items: [
      { cn: "草地基础块", en: "GrassTile", Component: GrassTile, previewClass: styles.primitiveGrassTile },
      { cn: "单簇小草", en: "GrassBlade", Component: GrassBlade, previewClass: styles.primitiveGrassBlade },
      { cn: "草丛组件", en: "GrassCluster", Component: GrassCluster, previewClass: styles.primitiveGrassCluster },
      { cn: "小花组件", en: "FlowerPatch", Component: FlowerPatch, previewClass: styles.primitiveFlowerPatch },
      { cn: "杂草组件", en: "WeedPatch", Component: WeedPatch, previewClass: styles.primitiveWeedPatch },
      { cn: "踩踏草痕", en: "TrampledGrass", Component: TrampledGrass, previewClass: styles.primitiveTrampledGrass },
    ],
  },
  {
    title: "Nature / 树木自然",
    description: "树干、树冠、树叶簇、树影、小石头和落叶。",
    items: [
      { cn: "树干", en: "TreeTrunk", Component: TreeTrunk, previewClass: styles.primitiveTreeTrunk },
      { cn: "树冠", en: "TreeCanopy", Component: TreeCanopy, previewClass: styles.primitiveTreeCanopy },
      { cn: "树叶簇", en: "TreeLeafCluster", Component: TreeLeafCluster, previewClass: styles.primitiveTreeLeafCluster },
      { cn: "树影", en: "TreeShadow", Component: TreeShadow, previewClass: styles.primitiveTreeShadow },
      { cn: "小石头", en: "StoneSmall", Component: StoneSmall, previewClass: styles.primitiveStoneSmall },
      { cn: "落叶", en: "FallenLeaf", Component: FallenLeaf, previewClass: styles.primitiveFallenLeaf },
    ],
  },
  {
    title: "Buildings / 建筑",
    description: "地基、墙体、屋顶、门窗、围栏、阴影和招牌。",
    items: [
      { cn: "地基块", en: "FoundationBlock", Component: FoundationBlock, previewClass: styles.primitiveFoundationBlock },
      { cn: "墙体面板", en: "WallPanel", Component: WallPanel, previewClass: styles.primitiveWallPanel },
      { cn: "屋顶部件", en: "RoofPiece", Component: RoofPiece, previewClass: styles.primitiveRoofPiece },
      { cn: "门板", en: "DoorPanel", Component: DoorPanel, previewClass: styles.primitiveDoorPanel },
      { cn: "窗组件", en: "WindowPanel", Component: WindowPanel, previewClass: styles.primitiveWindowPanel },
      { cn: "门把手", en: "DoorHandle", Component: DoorHandle, previewClass: styles.primitiveDoorHandle },
      { cn: "窗光", en: "WindowLight", Component: WindowLight, previewClass: styles.primitiveWindowLight },
      { cn: "围栏段", en: "FenceSegment", Component: FenceSegment, previewClass: styles.primitiveFenceSegment },
      { cn: "建筑阴影", en: "BuildingShadow", Component: BuildingShadow, previewClass: styles.primitiveBuildingShadow },
      { cn: "通用招牌", en: "SignBoard", Component: SignBoard, previewClass: styles.primitiveSignBoard },
    ],
  },
  {
    title: "Facilities / 设施",
    description: "食物、饮水、宠物床、储物、观察点、庭院和欢迎垫。",
    items: [
      { cn: "食物碗", en: "FoodBowl", Component: FoodBowl, previewClass: styles.primitiveFoodBowl },
      { cn: "饮水碗", en: "WaterBowl", Component: WaterBowl, previewClass: styles.primitiveWaterBowl },
      { cn: "宠物床", en: "PetBed", Component: PetBed, previewClass: styles.primitivePetBed },
      { cn: "储物箱", en: "StorageBox", Component: StorageBox, previewClass: styles.primitiveStorageBox },
      { cn: "观察点", en: "ObservationSpot", Component: ObservationSpot, previewClass: styles.primitiveObservationSpot },
      { cn: "庭院地块", en: "GardenPatch", Component: GardenPatch, previewClass: styles.primitiveGardenPatch },
      { cn: "欢迎垫", en: "WelcomeMat", Component: WelcomeMat, previewClass: styles.primitiveWelcomeMat },
    ],
  },
  {
    title: "Adoption Center / 领养中心",
    description: "小镇宠物领养中心、登记柜台、公告板、等待区和抵达点。",
    items: [
      { cn: "领养中心主体", en: "AdoptionCenterBody", Component: AdoptionCenterBody, previewClass: styles.primitiveAdoptionCenterBody },
      { cn: "领养中心屋顶", en: "AdoptionCenterRoof", Component: AdoptionCenterRoof, previewClass: styles.primitiveAdoptionCenterRoof },
      { cn: "领养中心招牌", en: "AdoptionCenterSign", Component: AdoptionCenterSign, previewClass: styles.primitiveAdoptionCenterSign },
      { cn: "领养登记柜台", en: "AdoptionCounter", Component: AdoptionCounter, previewClass: styles.primitiveAdoptionCounter },
      { cn: "领养公告板", en: "NoticeBoard", Component: NoticeBoard, previewClass: styles.primitiveNoticeBoard },
      { cn: "等待区长椅", en: "WaitingBench", Component: WaitingBench, previewClass: styles.primitiveWaitingBench },
      { cn: "宠物抵达点", en: "ArrivalPoint", Component: ArrivalPoint, previewClass: styles.primitiveArrivalPoint },
      { cn: "小镇服务点", en: "TownServiceMarker", Component: TownServiceMarker, previewClass: styles.primitiveTownServiceMarker },
    ],
  },
  {
    title: "Actors / 角色",
    description: "管家、宠物、通用身体、角色细节和工具语义零件。",
    items: [
      { cn: "角色锚点", en: "ActorAnchor", Component: ActorAnchor, previewClass: styles.primitiveActorAnchor },
      { cn: "通用身体", en: "ActorBodyBase", Component: ActorBodyBase, previewClass: styles.primitiveActorBodyBase },
      { cn: "通用阴影", en: "ActorShadow", Component: ActorShadow, previewClass: styles.primitiveActorShadow },
      { cn: "管家主体", en: "ButlerActor", Component: ButlerActor, previewClass: styles.primitiveButlerActor },
      { cn: "管家身体", en: "ButlerBody", Component: ButlerBody, previewClass: styles.primitiveButlerBody },
      { cn: "管家头部", en: "ButlerHead", Component: ButlerHead, previewClass: styles.primitiveButlerHead },
      { cn: "管家手部", en: "ButlerHands", Component: ButlerHands, previewClass: styles.primitiveButlerHands },
      { cn: "管家脚部", en: "ButlerFeet", Component: ButlerFeet, previewClass: styles.primitiveButlerFeet },
      { cn: "宠物主体", en: "PetActor", Component: PetActor, previewClass: styles.primitivePetActor },
      { cn: "宠物身体", en: "PetBody", Component: PetBody, previewClass: styles.primitivePetBody },
      { cn: "宠物头部", en: "PetHead", Component: PetHead, previewClass: styles.primitivePetHead },
      { cn: "宠物腿部", en: "PetLegs", Component: PetLegs, previewClass: styles.primitivePetLegs },
      { cn: "通用眼睛", en: "PixelEye", Component: PixelEye, previewClass: styles.primitivePixelEye },
      { cn: "通用嘴巴", en: "PixelMouth", Component: PixelMouth, previewClass: styles.primitivePixelMouth },
      { cn: "通用手部细节", en: "PixelHandDetail", Component: PixelHandDetail, previewClass: styles.primitivePixelHandDetail },
      { cn: "通用脚部细节", en: "PixelFootDetail", Component: PixelFootDetail, previewClass: styles.primitivePixelFootDetail },
      { cn: "管家眼睛", en: "ButlerEye", Component: ButlerEye, previewClass: styles.primitiveButlerEye },
      { cn: "管家嘴巴", en: "ButlerMouth", Component: ButlerMouth, previewClass: styles.primitiveButlerMouth },
      { cn: "管家头发", en: "ButlerHair", Component: ButlerHair, previewClass: styles.primitiveButlerHair },
      { cn: "管家帽子", en: "ButlerHat", Component: ButlerHat, previewClass: styles.primitiveButlerHat },
      { cn: "管家衣服", en: "ButlerOutfit", Component: ButlerOutfit, previewClass: styles.primitiveButlerOutfit },
      { cn: "管家袖子", en: "ButlerSleeve", Component: ButlerSleeve, previewClass: styles.primitiveButlerSleeve },
      { cn: "管家鞋子", en: "ButlerShoe", Component: ButlerShoe, previewClass: styles.primitiveButlerShoe },
      { cn: "建设工具小锤子", en: "ButlerToolHammer", Component: ButlerToolHammer, previewClass: styles.primitiveButlerToolHammer },
      { cn: "记录板", en: "ButlerToolClipboard", Component: ButlerToolClipboard, previewClass: styles.primitiveButlerToolClipboard },
      { cn: "食物托盘", en: "ButlerToolFoodTray", Component: ButlerToolFoodTray, previewClass: styles.primitiveButlerToolFoodTray },
      { cn: "宠物眼睛", en: "PetEye", Component: PetEye, previewClass: styles.primitivePetEye },
      { cn: "宠物鼻子", en: "PetNose", Component: PetNose, previewClass: styles.primitivePetNose },
      { cn: "宠物嘴巴", en: "PetMouth", Component: PetMouth, previewClass: styles.primitivePetMouth },
      { cn: "宠物耳朵", en: "PetEar", Component: PetEar, previewClass: styles.primitivePetEar },
      { cn: "宠物尾巴", en: "PetTail", Component: PetTail, previewClass: styles.primitivePetTail },
      { cn: "宠物爪子", en: "PetPaw", Component: PetPaw, previewClass: styles.primitivePetPaw },
      { cn: "宠物胡须", en: "PetWhisker", Component: PetWhisker, previewClass: styles.primitivePetWhisker },
      { cn: "宠物腹部花纹", en: "PetBellyPatch", Component: PetBellyPatch, previewClass: styles.primitivePetBellyPatch },
      { cn: "宠物背部花纹", en: "PetBackMark", Component: PetBackMark, previewClass: styles.primitivePetBackMark },
    ],
  },
]

const prototypeCards: VisualCard[] = [
  {
    cn: "宠物像素原型",
    en: "PixelPetPrototype",
    meaning: "验证宠物身体、头、耳朵、眼睛、鼻子、嘴巴、尾巴是否可识别。",
    preview: <PixelPetPrototype />,
  },
  {
    cn: "管家像素原型",
    en: "PixelButlerPrototype",
    meaning: "验证管家头、身体、衣服、手、脚和简单表情是否可识别。",
    preview: <PixelButlerPrototype />,
  },
  {
    cn: "树木像素原型",
    en: "PixelTreePrototype",
    meaning: "验证树干、树冠、层次和树影是否可识别。",
    preview: <PixelTreePrototype />,
  },
  {
    cn: "临时住所原型",
    en: "PixelTemporaryShelterPrototype",
    meaning: "验证简单遮蔽、支撑结构、临时墙体和小入口。",
    preview: <PixelTemporaryShelterPrototype />,
  },
  {
    cn: "基础小屋原型",
    en: "PixelBasicHousePrototype",
    meaning: "验证地基、墙、门、窗、屋顶和窗光。",
    preview: <PixelBasicHousePrototype />,
  },
  {
    cn: "照护角原型",
    en: "PixelCareCornerPrototype",
    meaning: "验证食物碗、饮水碗、宠物床、欢迎垫和照护区边界。",
    preview: <PixelCareCornerPrototype />,
  },
  {
    cn: "领养中心原型",
    en: "PixelAdoptionCenterPrototype",
    meaning: "验证小镇宠物领养中心主体、招牌、柜台、公告板和等待区。",
    preview: <PixelAdoptionCenterPrototype />,
  },
  {
    cn: "宠物抵达点原型",
    en: "PixelArrivalPointPrototype",
    meaning: "验证宠物抵达点、欢迎垫、光圈和小标记。",
    preview: <PixelArrivalPointPrototype />,
  },
]

const prefabCards: VisualCard[] = [
  {
    cn: "树木组合对象",
    en: "LowFiTreePrefab",
    meaning: "2x3 世界网格对象，用于自然资源和场景层次。",
    preview: <LowFiTreePrefab />,
  },
  {
    cn: "宠物组合对象",
    en: "LowFiPetPrefab",
    meaning: "2x2 世界网格对象，用于未来宠物站位。",
    preview: <LowFiPetPrefab />,
  },
  {
    cn: "管家组合对象",
    en: "LowFiButlerPrefab",
    meaning: "2x3 世界网格对象，用于未来管家站位。",
    preview: <LowFiButlerPrefab />,
  },
  {
    cn: "临时住所组合对象",
    en: "LowFiTemporaryShelterPrefab",
    meaning: "4x3 世界网格对象，用于 HOME-02 阶段。",
    preview: <LowFiTemporaryShelterPrefab />,
  },
  {
    cn: "基础小屋组合对象",
    en: "LowFiBasicHousePrefab",
    meaning: "5x4 世界网格对象，用于 HOME-03 阶段。",
    preview: <LowFiBasicHousePrefab />,
  },
  {
    cn: "照护角组合对象",
    en: "LowFiCareCornerPrefab",
    meaning: "4x2 世界网格对象，用于食物、饮水、宠物床和欢迎垫。",
    preview: <LowFiCareCornerPrefab />,
  },
  {
    cn: "领养中心组合对象",
    en: "LowFiAdoptionCenterPrefab",
    meaning: "6x4 世界网格对象，用于小镇宠物领养中心占位。",
    preview: <LowFiAdoptionCenterPrefab />,
  },
  {
    cn: "宠物抵达点组合对象",
    en: "LowFiArrivalPointPrefab",
    meaning: "2x2 世界网格对象，用于宠物抵达家园的低保真点位。",
    preview: <LowFiArrivalPointPrefab />,
  },
]

function renderPrimitiveCard(item: PrimitiveComponentItem) {
  const PreviewComponent = item.Component

  return (
    <article key={item.en} className={styles.componentCard}>
      <div className={styles.componentMeta}>
        <strong>{item.cn}</strong>
        <span>{item.en}</span>
      </div>
      <div className={styles.componentPreview}>
        <PreviewComponent
          className={`${styles.pixelPart} ${item.previewClass}`}
          variant={item.variant ?? "default"}
          state="active"
          debug
        />
      </div>
    </article>
  )
}

function renderVisualCard(card: VisualCard) {
  return (
    <article key={card.en} className={styles.visualCard}>
      <div className={styles.visualPreview}>{card.preview}</div>
      <div className={styles.visualMeta}>
        <strong>{card.cn}</strong>
        <span>{card.en}</span>
        <p>{card.meaning}</p>
      </div>
    </article>
  )
}

function renderKeyValueList(
  values: Array<[string, string | number]>
) {
  return (
    <dl className={styles.variantList}>
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function getVisualDNAItems(visualDNA: VisualDNA) {
  return [
    ["colorTone", visualDNA.colorTone],
    ["butlerSilhouette", visualDNA.butlerSilhouette],
    ["petMatchType", visualDNA.petMatchType],
    ["homeStyle", visualDNA.homeStyle],
    ["gardenStyle", visualDNA.gardenStyle],
    ["shelterStyle", visualDNA.shelterStyle],
    ["carePriority", visualDNA.carePriority],
    ["orderVsNature", visualDNA.orderVsNature],
    ["warmthVsDistance", visualDNA.warmthVsDistance],
    ["protectionNeed", visualDNA.protectionNeed],
    ["decorationNeed", visualDNA.decorationNeed],
  ] satisfies Array<[string, string | number]>
}

function getSpriteVariantItems(spriteVariant: SpriteVariant) {
  return [
    ["butlerSprite", spriteVariant.butlerSprite],
    ["petSprite", spriteVariant.petSprite],
    ["shelterSprite", spriteVariant.shelterSprite],
    ["houseSprite", spriteVariant.houseSprite],
  ] satisfies Array<[string, string]>
}

function getPrefabVariantItems(prefabVariant: PrefabVariant) {
  return [
    ["butlerPrefab", prefabVariant.butlerPrefab],
    ["petPrefab", prefabVariant.petPrefab],
    ["careCornerPrefab", prefabVariant.careCornerPrefab],
    ["shelterPrefab", prefabVariant.shelterPrefab],
    ["basicHousePrefab", prefabVariant.basicHousePrefab],
    ["gardenPrefab", prefabVariant.gardenPrefab],
  ] satisfies Array<[string, string]>
}

function getSceneLayoutVariantItems(
  sceneLayoutVariant: SceneLayoutVariant
) {
  return [
    ["initialHomeScene", sceneLayoutVariant.initialHomeScene],
    ["carePointScene", sceneLayoutVariant.carePointScene],
    ["temporaryShelterScene", sceneLayoutVariant.temporaryShelterScene],
    ["basicHomeScene", sceneLayoutVariant.basicHomeScene],
  ] satisfies Array<[string, string]>
}

function renderVisualVariantCard(result: VisualGenerationResult) {
  const archetype = result.visualDNA.archetype

  return (
    <article key={archetype} className={styles.variantCard}>
      <header className={styles.variantHeader}>
        <div>
          <strong>{mockVisualArchetypeLabels[archetype]}</strong>
          <span>{archetype}</span>
        </div>
        <b>{result.visualDNA.colorTone}</b>
      </header>

      <div className={styles.variantColumns}>
        <section className={styles.variantColumn}>
          <h3>VisualDNA</h3>
          {renderKeyValueList(getVisualDNAItems(result.visualDNA))}
        </section>

        <section className={styles.variantColumn}>
          <h3>SpriteVariant</h3>
          {renderKeyValueList(getSpriteVariantItems(result.spriteVariant))}
        </section>

        <section className={styles.variantColumn}>
          <h3>PrefabVariant</h3>
          {renderKeyValueList(getPrefabVariantItems(result.prefabVariant))}
        </section>

        <section className={styles.variantColumn}>
          <h3>SceneLayoutVariant</h3>
          {renderKeyValueList(
            getSceneLayoutVariantItems(result.sceneLayoutVariant)
          )}
        </section>
      </div>
    </article>
  )
}

export default function PixelLayerTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.kicker}>AI-PET-WORLD</div>
        <h1>Pixel Layer Test / 像素图层测试页</h1>
        <p>
          此页面用于查看 pixel-ui 图层、组件、像素原型和低保真组合效果，不属于正式玩家主世界。
        </p>
      </section>

      <section className={styles.section}>
        <h2>MVP Core Lock / MVP 核心需求锁定表 v1.1</h2>
        <p className={styles.sectionNote}>
          每次继续开发前都必须对照这张表。紫微斗数是第一核心，八字仅作为出生时间缺失时的辅助补全机制。
        </p>
        <ol className={styles.coreList}>
          {coreRequirements.map((item, index) => (
            <li key={item} className={styles.coreItem}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{item}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Visual Generation Pipeline / 视觉生成管线</h2>
        <div className={styles.pipeline}>
          {pipelineSteps.map((step, index) => (
            <div key={step} className={styles.pipelineStep}>
              <span>{step}</span>
              {index < pipelineSteps.length - 1 && <b>↓</b>}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Ziwei Visual Variants / 紫微视觉变体</h2>
        <p className={styles.sectionNote}>
          这里展示的是不同紫微视觉类型如何生成不同管家、宠物、家园风格和场景变体。
          这一步不接真实紫微算法，但证明系统不是固定 UI，而是可以根据不同玩家生成不同视觉结果。
        </p>
        <div className={styles.variantGrid}>
          {mockVisualGenerationResults.map(renderVisualVariantCard)}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Plan Status / 计划状态</h2>
        <div className={styles.planGrid}>
          {planItems.map((item) => (
            <span key={item} className={styles.planItem}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Layer Order / 图层顺序</h2>
        <p className={styles.sectionNote}>
          世界图层负责对象前后关系；Sprite 内部图层负责宠物眼睛、鼻子、衣服等内部结构；二者不能混用。
        </p>
        <ol className={styles.layerList}>
          {layerItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Primitive Components / 原子定义组件</h2>
        <p className={styles.sectionNote}>
          这些组件用于定义世界有哪些语义部件，不代表最终美术。它们未来可被资源系统、建设系统和 AI 管家引用。
          本区域展示的是 Primitive Debug Preview：用于区分语义零件，不代表最终 Sprite / Prefab 视觉质量。
        </p>
        <div className={styles.groupStack}>
          {componentGroups.map((group) => (
            <article key={group.title} className={styles.componentGroup}>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
              <div className={styles.componentGrid}>
                {group.items.map(renderPrimitiveCard)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Pixel-art Prototypes / 像素美术原型</h2>
        <p className={styles.sectionNote}>
          以下原型不是最终美术，而是用于验证 AI-PET-WORLD 的宠物、管家、住所、树木、照护区和领养中心是否具备清晰可识别的像素风格。
        </p>
        <div className={styles.visualGrid}>
          {prototypeCards.map(renderVisualCard)}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Low-Fi Prefabs / 低保真组合对象</h2>
        <p className={styles.sectionNote}>
          Prefab 是未来管家建设和世界场景优先使用的组合对象。Primitive 不应直接作为最终场景对象使用。
        </p>
        <div className={styles.visualGrid}>
          {prefabCards.map(renderVisualCard)}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Scene Preview / 场景组合预览</h2>
        <p className={styles.sectionNote}>
          场景应该由 Prefab 组合，而不是由 Primitive 色块直接拼接。下面只是开发测试预览，不接真实世界状态。
        </p>
        <div className={styles.sceneGrid}>
          <article className={styles.sceneCard}>
            <div className={styles.sceneHeader}>
              <h3>初始家园预览</h3>
              <span>HOME-00 / 空地</span>
            </div>
            <div className={styles.sceneCanvas}>
              <div className={styles.sceneGrass} />
              <div className={styles.scenePath} />
              <LowFiTreePrefab className={styles.sceneTree} />
              <LowFiButlerPrefab className={styles.sceneButler} />
              <LowFiArrivalPointPrefab className={styles.sceneArrival} />
              <StorageBox className={`${styles.primitiveInScene} ${styles.sceneStorage}`} />
              <ObservationSpot className={`${styles.primitiveInScene} ${styles.sceneObserve}`} />
              <GrassCluster className={`${styles.primitiveInScene} ${styles.sceneCluster}`} />
              <StoneSmall className={`${styles.primitiveInScene} ${styles.sceneStone}`} />
            </div>
            <p className={styles.moduleList}>
              使用模块：LowFiTreePrefab / LowFiButlerPrefab / LowFiArrivalPointPrefab / StorageBox / ObservationSpot
            </p>
          </article>

          <article className={styles.sceneCard}>
            <div className={styles.sceneHeader}>
              <h3>临时住所建设预览</h3>
              <span>HOME-02 / 临时住所</span>
            </div>
            <div className={styles.sceneCanvas}>
              <div className={styles.sceneBuildShadow} />
              <FoundationBlock className={`${styles.primitiveInScene} ${styles.sceneBuildFoundation}`} />
              <LowFiTemporaryShelterPrefab className={styles.sceneShelter} />
              <LowFiButlerPrefab className={styles.sceneBuilder} />
              <DirtPatch className={`${styles.primitiveInScene} ${styles.sceneMaterialA}`} />
              <DirtPatch className={`${styles.primitiveInScene} ${styles.sceneMaterialB}`} />
            </div>
            <p className={styles.moduleList}>
              使用模块：LowFiTemporaryShelterPrefab / LowFiButlerPrefab / FoundationBlock / DirtPatch
            </p>
          </article>

          <article className={styles.sceneCard}>
            <div className={styles.sceneHeader}>
              <h3>宠物生活区预览</h3>
              <span>HOME-01 / 照护点</span>
            </div>
            <div className={styles.sceneCanvas}>
              <LowFiCareCornerPrefab className={styles.sceneCare} />
              <LowFiPetPrefab className={styles.scenePet} />
              <FoodBowl className={`${styles.primitiveInScene} ${styles.sceneFood}`} />
              <WaterBowl className={`${styles.primitiveInScene} ${styles.sceneWater}`} />
              <PetBed className={`${styles.primitiveInScene} ${styles.sceneBed}`} />
              <GardenPatch className={`${styles.primitiveInScene} ${styles.sceneGarden}`} />
              <ObservationSpot className={`${styles.primitiveInScene} ${styles.sceneCareObserve}`} />
            </div>
            <p className={styles.moduleList}>
              使用模块：LowFiPetPrefab / LowFiCareCornerPrefab / FoodBowl / WaterBowl / PetBed / GardenPatch
            </p>
          </article>

          <article className={styles.sceneCard}>
            <div className={styles.sceneHeader}>
              <h3>领养中心预览</h3>
              <span>Town / 临时设施</span>
            </div>
            <div className={styles.sceneCanvas}>
              <LowFiAdoptionCenterPrefab className={styles.sceneAdoptionCenter} />
              <LowFiArrivalPointPrefab className={styles.sceneTownArrival} />
              <AdoptionCenterSign className={`${styles.primitiveInScene} ${styles.sceneTownSign}`} />
              <NoticeBoard className={`${styles.primitiveInScene} ${styles.sceneNotice}`} />
              <WaitingBench className={`${styles.primitiveInScene} ${styles.sceneBench}`} />
            </div>
            <p className={styles.moduleList}>
              使用模块：LowFiAdoptionCenterPrefab / LowFiArrivalPointPrefab / AdoptionCenterSign / NoticeBoard / WaitingBench
            </p>
          </article>
        </div>
      </section>
    </main>
  )
}
