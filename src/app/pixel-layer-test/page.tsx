/**
 * 当前文件负责：展示 pixel-ui 原子组件、像素原型、组合对象和测试场景。
 */

import type { ComponentType, ReactNode } from "react"

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
  DirtPatch,
  GroundEdge,
  GroundTile,
} from "../world/components/pixel-ui/ground"
import {
  FallenLeaf,
  StoneSmall,
  TreeCanopy,
  TreeLeafCluster,
  TreeShadow,
  TreeTrunk,
} from "../world/components/pixel-ui/nature"
import {
  FlowerPatch,
  GrassBlade,
  GrassCluster,
  GrassTile,
  TrampledGrass,
  WeedPatch,
} from "../world/components/pixel-ui/grass"
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
  PixelAdoptionCenterPrototype,
  PixelArrivalPointPrototype,
  PixelBasicHousePrototype,
  PixelButlerPrototype,
  PixelCareCornerPrototype,
  PixelPetPrototype,
  PixelTemporaryShelterPrototype,
  PixelTreePrototype,
} from "../world/components/pixel-ui/pixel-art-prototypes"
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
import type {
  PixelPartProps,
  PixelPartVariant,
} from "../world/components/pixel-ui/pixel-ui.types"

import styles from "./pixel-layer-test.module.css"

type PrimitiveItem = {
  label: string
  name: string
  Component: ComponentType<PixelPartProps>
  variant?: PixelPartVariant
}

type PrimitiveGroup = {
  title: string
  items: PrimitiveItem[]
}

type VisualCard = {
  label: string
  name: string
  meaning: string
  preview: ReactNode
}

type SceneCardProps = {
  title: string
  phase: string
  modules: string[]
  children: ReactNode
}

const planItems = [
  ["UI-00", "PIXEL-UI-DIRECTORY-PLAN", "已完成"],
  ["UI-01", "PIXEL-UI-LAYER-COMPONENTS", "已完成"],
  ["UI-02", "GROUND-GRASS-NATURE-COMPONENTS", "已完成"],
  ["UI-03", "BUILDING-FACILITY-COMPONENTS", "已完成"],
  ["UI-04", "ACTOR-BASIC-COMPONENTS", "已完成"],
  ["UI-05", "ACTOR-DETAIL-COMPONENTS", "已完成"],
  ["RULE-00", "WORLD-TIME-AND-RESOURCE-RULES", "已完成"],
  ["DEV-UI-01", "PIXEL-LAYER-TEST-PAGE", "已完成"],
  ["ART-00", "PIXEL-ART-MODULE-RULES", "当前已完成"],
  ["ART-01", "PIXEL-SPRITE-PROTOTYPES", "当前已完成"],
  ["ART-02", "LOW-FI-PREFABS", "当前已完成"],
  ["UI-06", "LOW-FI-PIXEL-STAGE", "未开始"],
] as const

const layerItems = [
  ["GroundLayer", "地面层"],
  ["GrassLayer", "草地层"],
  ["TreeNatureLayer", "树木自然层"],
  ["PathLayer", "路径层"],
  ["BuildingBaseLayer", "建筑基础层"],
  ["BuildingBodyLayer", "建筑主体层"],
  ["BuildingDetailLayer", "建筑细节层"],
  ["FacilityLayer", "家具设施层"],
  ["ActorShadowLayer", "角色阴影层"],
  ["ActorBodyLayer", "角色身体层"],
  ["ActorDetailLayer", "角色细节层"],
  ["ActorMotionLayer", "角色动作层"],
  ["EffectLayer", "情绪状态特效层"],
  ["InteractionLayer", "交互反馈层"],
  ["AtmosphereLayer", "时间天气氛围层"],
] as const

const primitiveGroups: PrimitiveGroup[] = [
  {
    title: "Ground / 地面 Primitive",
    items: [
      { label: "地面基础块", name: "GroundTile", Component: GroundTile },
      { label: "泥地区块", name: "DirtPatch", Component: DirtPatch },
      { label: "地面边界", name: "GroundEdge", Component: GroundEdge },
    ],
  },
  {
    title: "Grass / 草地 Primitive",
    items: [
      { label: "草地基础块", name: "GrassTile", Component: GrassTile },
      { label: "单簇小草", name: "GrassBlade", Component: GrassBlade },
      { label: "草丛", name: "GrassCluster", Component: GrassCluster },
      { label: "小花", name: "FlowerPatch", Component: FlowerPatch, variant: "warm" },
      { label: "杂草", name: "WeedPatch", Component: WeedPatch, variant: "wild" },
      { label: "踩踏草痕", name: "TrampledGrass", Component: TrampledGrass, variant: "quiet" },
    ],
  },
  {
    title: "Nature / 自然 Primitive",
    items: [
      { label: "树干", name: "TreeTrunk", Component: TreeTrunk },
      { label: "树冠", name: "TreeCanopy", Component: TreeCanopy },
      { label: "树叶簇", name: "TreeLeafCluster", Component: TreeLeafCluster },
      { label: "树影", name: "TreeShadow", Component: TreeShadow, variant: "quiet" },
      { label: "小石头", name: "StoneSmall", Component: StoneSmall },
      { label: "落叶", name: "FallenLeaf", Component: FallenLeaf, variant: "warm" },
    ],
  },
  {
    title: "Buildings / 建筑 Primitive",
    items: [
      { label: "地基块", name: "FoundationBlock", Component: FoundationBlock, variant: "structured" },
      { label: "墙体面板", name: "WallPanel", Component: WallPanel },
      { label: "屋顶部件", name: "RoofPiece", Component: RoofPiece, variant: "warm" },
      { label: "门板", name: "DoorPanel", Component: DoorPanel },
      { label: "窗", name: "WindowPanel", Component: WindowPanel },
      { label: "门把手", name: "DoorHandle", Component: DoorHandle, variant: "light" },
      { label: "窗光", name: "WindowLight", Component: WindowLight, variant: "light" },
      { label: "围栏段", name: "FenceSegment", Component: FenceSegment, variant: "structured" },
      { label: "建筑阴影", name: "BuildingShadow", Component: BuildingShadow, variant: "dark" },
      { label: "通用招牌", name: "SignBoard", Component: SignBoard },
    ],
  },
  {
    title: "Facilities / 设施 Primitive",
    items: [
      { label: "食物碗", name: "FoodBowl", Component: FoodBowl, variant: "warm" },
      { label: "饮水碗", name: "WaterBowl", Component: WaterBowl, variant: "light" },
      { label: "宠物床", name: "PetBed", Component: PetBed, variant: "soft" },
      { label: "储物箱", name: "StorageBox", Component: StorageBox, variant: "structured" },
      { label: "观察点", name: "ObservationSpot", Component: ObservationSpot, variant: "quiet" },
      { label: "庭院地块", name: "GardenPatch", Component: GardenPatch, variant: "wild" },
      { label: "家园欢迎垫", name: "WelcomeMat", Component: WelcomeMat, variant: "warm" },
    ],
  },
  {
    title: "Adoption Center / 领养中心 Primitive",
    items: [
      { label: "领养中心主体", name: "AdoptionCenterBody", Component: AdoptionCenterBody },
      { label: "领养中心屋顶", name: "AdoptionCenterRoof", Component: AdoptionCenterRoof, variant: "warm" },
      { label: "领养中心招牌", name: "AdoptionCenterSign", Component: AdoptionCenterSign },
      { label: "领养登记柜台", name: "AdoptionCounter", Component: AdoptionCounter, variant: "structured" },
      { label: "领养公告板", name: "NoticeBoard", Component: NoticeBoard },
      { label: "等待区长椅", name: "WaitingBench", Component: WaitingBench, variant: "quiet" },
      { label: "宠物抵达点", name: "ArrivalPoint", Component: ArrivalPoint, variant: "warm" },
      { label: "小镇服务点", name: "TownServiceMarker", Component: TownServiceMarker, variant: "light" },
    ],
  },
  {
    title: "Actors / 角色 Primitive",
    items: [
      { label: "角色定位锚点", name: "ActorAnchor", Component: ActorAnchor },
      { label: "角色身体基础", name: "ActorBodyBase", Component: ActorBodyBase },
      { label: "角色阴影", name: "ActorShadow", Component: ActorShadow, variant: "dark" },
      { label: "管家主体", name: "ButlerActor", Component: ButlerActor, variant: "structured" },
      { label: "管家身体", name: "ButlerBody", Component: ButlerBody, variant: "structured" },
      { label: "管家头部", name: "ButlerHead", Component: ButlerHead },
      { label: "管家手部", name: "ButlerHands", Component: ButlerHands },
      { label: "管家脚部", name: "ButlerFeet", Component: ButlerFeet },
      { label: "宠物主体", name: "PetActor", Component: PetActor, variant: "soft" },
      { label: "宠物身体", name: "PetBody", Component: PetBody, variant: "soft" },
      { label: "宠物头部", name: "PetHead", Component: PetHead, variant: "soft" },
      { label: "宠物腿部", name: "PetLegs", Component: PetLegs },
      { label: "通用眼睛", name: "PixelEye", Component: PixelEye },
      { label: "通用嘴巴", name: "PixelMouth", Component: PixelMouth },
      { label: "通用手部细节", name: "PixelHandDetail", Component: PixelHandDetail },
      { label: "通用脚部细节", name: "PixelFootDetail", Component: PixelFootDetail },
      { label: "管家眼睛", name: "ButlerEye", Component: ButlerEye },
      { label: "管家嘴巴", name: "ButlerMouth", Component: ButlerMouth },
      { label: "管家头发", name: "ButlerHair", Component: ButlerHair },
      { label: "管家帽子", name: "ButlerHat", Component: ButlerHat },
      { label: "管家衣服", name: "ButlerOutfit", Component: ButlerOutfit, variant: "structured" },
      { label: "管家袖子", name: "ButlerSleeve", Component: ButlerSleeve },
      { label: "管家鞋子", name: "ButlerShoe", Component: ButlerShoe, variant: "dark" },
      { label: "管家小锤子", name: "ButlerToolHammer", Component: ButlerToolHammer, variant: "warm" },
      { label: "管家记录板", name: "ButlerToolClipboard", Component: ButlerToolClipboard },
      { label: "管家食物托盘", name: "ButlerToolFoodTray", Component: ButlerToolFoodTray, variant: "warm" },
      { label: "宠物眼睛", name: "PetEye", Component: PetEye },
      { label: "宠物鼻子", name: "PetNose", Component: PetNose },
      { label: "宠物嘴巴", name: "PetMouth", Component: PetMouth },
      { label: "宠物耳朵", name: "PetEar", Component: PetEar },
      { label: "宠物尾巴", name: "PetTail", Component: PetTail },
      { label: "宠物爪子", name: "PetPaw", Component: PetPaw },
      { label: "宠物胡须", name: "PetWhisker", Component: PetWhisker },
      { label: "宠物腹部花纹", name: "PetBellyPatch", Component: PetBellyPatch, variant: "light" },
      { label: "宠物背部花纹", name: "PetBackMark", Component: PetBackMark, variant: "dark" },
    ],
  },
]

const prototypeCards: VisualCard[] = [
  {
    label: "宠物像素原型",
    name: "PixelPetPrototype",
    meaning: "验证宠物身体、头、耳朵、眼睛、鼻子、嘴巴、尾巴和爪子的可识别轮廓。",
    preview: <PixelPetPrototype />,
  },
  {
    label: "管家像素原型",
    name: "PixelButlerPrototype",
    meaning: "验证管家的头、身体、衣服、手、脚、简单表情和头发轮廓。",
    preview: <PixelButlerPrototype />,
  },
  {
    label: "树木像素原型",
    name: "PixelTreePrototype",
    meaning: "验证树干、树冠层次和地面阴影。",
    preview: <PixelTreePrototype />,
  },
  {
    label: "临时住所像素原型",
    name: "PixelTemporaryShelterPrototype",
    meaning: "验证 HOME-02 阶段的简单遮蔽、支撑结构、临时墙体、小入口和屋顶。",
    preview: <PixelTemporaryShelterPrototype />,
  },
  {
    label: "基础小屋像素原型",
    name: "PixelBasicHousePrototype",
    meaning: "验证 HOME-03 阶段的地基、墙、门、窗、屋顶和窗光。",
    preview: <PixelBasicHousePrototype />,
  },
  {
    label: "照护区像素原型",
    name: "PixelCareCornerPrototype",
    meaning: "验证食物碗、饮水碗、宠物床、欢迎垫和照护区边界。",
    preview: <PixelCareCornerPrototype />,
  },
  {
    label: "小镇宠物领养中心像素原型",
    name: "PixelAdoptionCenterPrototype",
    meaning: "验证功能建筑主体、屋顶、招牌、登记柜台、公告板和等待区暗示。",
    preview: <PixelAdoptionCenterPrototype />,
  },
  {
    label: "宠物抵达点像素原型",
    name: "PixelArrivalPointPrototype",
    meaning: "验证宠物抵达点、欢迎垫、光圈和开发测试标记。",
    preview: <PixelArrivalPointPrototype />,
  },
]

const prefabCards: VisualCard[] = [
  {
    label: "树木组合对象",
    name: "LowFiTreePrefab",
    meaning: "占地 2x3，用于未来家园自然对象摆放。",
    preview: <LowFiTreePrefab debug />,
  },
  {
    label: "宠物组合对象",
    name: "LowFiPetPrefab",
    meaning: "占地 2x2，用于未来宠物在世界网格中的摆放。",
    preview: <LowFiPetPrefab debug />,
  },
  {
    label: "管家组合对象",
    name: "LowFiButlerPrefab",
    meaning: "占地 2x3，用于未来管家在世界网格中的摆放。",
    preview: <LowFiButlerPrefab debug />,
  },
  {
    label: "临时住所组合对象",
    name: "LowFiTemporaryShelterPrefab",
    meaning: "占地 4x3，对应 HOME-02 临时住所。",
    preview: <LowFiTemporaryShelterPrefab debug />,
  },
  {
    label: "基础小屋组合对象",
    name: "LowFiBasicHousePrefab",
    meaning: "占地 5x4，对应 HOME-03 基础小屋。",
    preview: <LowFiBasicHousePrefab debug />,
  },
  {
    label: "照护区组合对象",
    name: "LowFiCareCornerPrefab",
    meaning: "占地 4x2，用于宠物食物、水、休息和欢迎点。",
    preview: <LowFiCareCornerPrefab debug />,
  },
  {
    label: "领养中心组合对象",
    name: "LowFiAdoptionCenterPrefab",
    meaning: "占地 6x4，用于小镇宠物领养中心低保真摆放。",
    preview: <LowFiAdoptionCenterPrefab debug />,
  },
  {
    label: "宠物抵达点组合对象",
    name: "LowFiArrivalPointPrefab",
    meaning: "占地 2x2，用于宠物送达家园的开发测试点位。",
    preview: <LowFiArrivalPointPrefab debug />,
  },
]

function PrimitiveCard({ item }: { item: PrimitiveItem }) {
  const PreviewComponent = item.Component

  return (
    <article className={styles.componentCard}>
      <div className={styles.componentMeta}>
        <span>{item.label}</span>
        <strong>{item.name}</strong>
      </div>
      <div className={styles.componentPreview}>
        <PreviewComponent
          className={styles.pixelPart}
          variant={item.variant ?? "default"}
          state="idle"
          debug={false}
        />
      </div>
    </article>
  )
}

function VisualCardPanel({ item }: { item: VisualCard }) {
  return (
    <article className={styles.visualCard}>
      <div className={styles.visualPreview}>{item.preview}</div>
      <div className={styles.visualMeta}>
        <span>{item.label}</span>
        <strong>{item.name}</strong>
        <p>{item.meaning}</p>
      </div>
    </article>
  )
}

function SceneCard({
  title,
  phase,
  modules,
  children,
}: SceneCardProps) {
  return (
    <article className={styles.sceneCard}>
      <div className={styles.sceneHeader}>
        <span>{phase}</span>
        <h3>{title}</h3>
      </div>
      <div className={styles.sceneCanvas}>{children}</div>
      <div className={styles.moduleList}>
        {modules.map((module) => (
          <span key={module}>{module}</span>
        ))}
      </div>
    </article>
  )
}

export default function PixelLayerTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>AI-PET-WORLD Pixel Layer Test</p>
        <h1>像素图层测试页</h1>
        <p>
          此页面用于查看 Primitive 原子定义、Pixel Sprite 原型、Low-Fi Prefab
          和场景组合效果，不属于正式玩家主世界。
        </p>
      </section>

      <section className={styles.section}>
        <h2>计划状态</h2>
        <div className={styles.planGrid}>
          {planItems.map(([id, title, status]) => (
            <div className={styles.planItem} key={id}>
              <span>{id}</span>
              <strong>{title}</strong>
              <em>{status}</em>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>图层顺序</h2>
        <p className={styles.sectionNote}>
          世界图层负责对象前后关系；Sprite 内部图层负责宠物眼睛、鼻子、衣服等内部结构；二者不能混用。
        </p>
        <ol className={styles.layerList}>
          {layerItems.map(([name, label]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>Primitive Components / 原子定义组件</h2>
        <p className={styles.sectionNote}>
          这些组件用于定义世界有哪些语义部件，不代表最终美术。它们未来可被资源系统、建设系统和 AI 管家引用。
        </p>
        <div className={styles.groupStack}>
          {primitiveGroups.map((group) => (
            <section className={styles.componentGroup} key={group.title}>
              <h3>{group.title}</h3>
              <div className={styles.componentGrid}>
                {group.items.map((item) => (
                  <PrimitiveCard item={item} key={item.name} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Pixel-art Prototypes / 像素美术原型</h2>
        <p className={styles.sectionNote}>
          以下原型不是最终美术，而是用于验证 AI-PET-WORLD 的宠物、管家、住所、树木、照护区和领养中心是否具备清晰可识别的像素风格。
        </p>
        <div className={styles.visualGrid}>
          {prototypeCards.map((item) => (
            <VisualCardPanel item={item} key={item.name} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Low-Fi Prefabs / 低保真组合对象</h2>
        <p className={styles.sectionNote}>
          Prefab 是未来世界场景应优先摆放的对象，Primitive 不应直接作为最终场景对象使用。
        </p>
        <div className={styles.visualGrid}>
          {prefabCards.map((item) => (
            <VisualCardPanel item={item} key={item.name} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Scene Preview / 场景组合预览</h2>
        <div className={styles.sceneGrid}>
          <SceneCard
            title="初始家园预览"
            phase="HOME-00 空地"
            modules={[
              "LowFiTreePrefab",
              "LowFiButlerPrefab",
              "LowFiArrivalPointPrefab",
              "StorageBox",
              "ObservationSpot",
            ]}
          >
            <GrassTile className={`${styles.primitiveInScene} ${styles.sceneGrass}`} variant="wild" />
            <DirtPatch className={`${styles.primitiveInScene} ${styles.scenePath}`} variant="warm" />
            <StoneSmall className={`${styles.primitiveInScene} ${styles.sceneStone}`} />
            <GrassCluster className={`${styles.primitiveInScene} ${styles.sceneCluster}`} variant="wild" />
            <LowFiTreePrefab className={styles.sceneTree} />
            <LowFiButlerPrefab className={styles.sceneButler} />
            <LowFiArrivalPointPrefab className={styles.sceneArrival} />
            <StorageBox className={`${styles.primitiveInScene} ${styles.sceneStorage}`} variant="structured" />
            <ObservationSpot className={`${styles.primitiveInScene} ${styles.sceneObserve}`} variant="quiet" />
          </SceneCard>

          <SceneCard
            title="临时住所建设预览"
            phase="HOME-02 临时住所"
            modules={[
              "LowFiTemporaryShelterPrefab",
              "FoundationBlock",
              "BuildingShadow",
              "LowFiButlerPrefab",
            ]}
          >
            <BuildingShadow className={`${styles.primitiveInScene} ${styles.sceneBuildShadow}`} variant="dark" />
            <FoundationBlock className={`${styles.primitiveInScene} ${styles.sceneBuildFoundation}`} variant="structured" />
            <LowFiTemporaryShelterPrefab className={styles.sceneShelter} />
            <LowFiButlerPrefab className={styles.sceneBuilder} />
            <StoneSmall className={`${styles.primitiveInScene} ${styles.sceneMaterialA}`} />
            <StoneSmall className={`${styles.primitiveInScene} ${styles.sceneMaterialB}`} />
          </SceneCard>

          <SceneCard
            title="宠物生活区预览"
            phase="HOME-01 照护点"
            modules={[
              "LowFiPetPrefab",
              "LowFiCareCornerPrefab",
              "FoodBowl",
              "WaterBowl",
              "PetBed",
              "GardenPatch",
              "ObservationSpot",
            ]}
          >
            <GardenPatch className={`${styles.primitiveInScene} ${styles.sceneGarden}`} variant="wild" />
            <LowFiCareCornerPrefab className={styles.sceneCare} />
            <LowFiPetPrefab className={styles.scenePet} />
            <FoodBowl className={`${styles.primitiveInScene} ${styles.sceneFood}`} variant="warm" />
            <WaterBowl className={`${styles.primitiveInScene} ${styles.sceneWater}`} variant="light" />
            <PetBed className={`${styles.primitiveInScene} ${styles.sceneBed}`} variant="soft" />
            <ObservationSpot className={`${styles.primitiveInScene} ${styles.sceneCareObserve}`} variant="quiet" />
          </SceneCard>

          <SceneCard
            title="领养中心预览"
            phase="小镇服务原型"
            modules={[
              "LowFiAdoptionCenterPrefab",
              "LowFiArrivalPointPrefab",
              "AdoptionCenterSign",
              "NoticeBoard",
              "WaitingBench",
            ]}
          >
            <LowFiAdoptionCenterPrefab className={styles.sceneAdoptionCenter} />
            <LowFiArrivalPointPrefab className={styles.sceneTownArrival} />
            <AdoptionCenterSign className={`${styles.primitiveInScene} ${styles.sceneTownSign}`} variant="light" />
            <NoticeBoard className={`${styles.primitiveInScene} ${styles.sceneNotice}`} />
            <WaitingBench className={`${styles.primitiveInScene} ${styles.sceneBench}`} variant="quiet" />
          </SceneCard>
        </div>
      </section>
    </main>
  )
}
