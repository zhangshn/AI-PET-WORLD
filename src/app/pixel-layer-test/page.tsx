/**
 * 当前文件负责：展示 pixel-ui 图层和组件的开发测试页面。
 */

import type { ComponentType } from "react"

import {
  GroundTile,
  DirtPatch,
  GroundEdge,
} from "../world/components/pixel-ui/ground"
import {
  GrassTile,
  GrassBlade,
  GrassCluster,
  FlowerPatch,
  WeedPatch,
  TrampledGrass,
} from "../world/components/pixel-ui/grass"
import {
  TreeTrunk,
  TreeCanopy,
  TreeLeafCluster,
  TreeShadow,
  StoneSmall,
  FallenLeaf,
} from "../world/components/pixel-ui/nature"
import {
  FoundationBlock,
  WallPanel,
  RoofPiece,
  DoorPanel,
  WindowPanel,
  DoorHandle,
  WindowLight,
  FenceSegment,
  BuildingShadow,
  SignBoard,
} from "../world/components/pixel-ui/buildings"
import {
  FoodBowl,
  WaterBowl,
  PetBed,
  StorageBox,
  ObservationSpot,
  GardenPatch,
  WelcomeMat,
} from "../world/components/pixel-ui/facilities"
import {
  AdoptionCenterBody,
  AdoptionCenterRoof,
  AdoptionCenterSign,
  AdoptionCounter,
  NoticeBoard,
  WaitingBench,
  ArrivalPoint,
  TownServiceMarker,
} from "../world/components/pixel-ui/adoption-center"
import {
  ActorAnchor,
  ActorBodyBase,
  ActorShadow,
  ButlerActor,
  ButlerBody,
  ButlerHead,
  ButlerHands,
  ButlerFeet,
  PetActor,
  PetBody,
  PetHead,
  PetLegs,
  PixelEye,
  PixelMouth,
  PixelHandDetail,
  PixelFootDetail,
  ButlerEye,
  ButlerMouth,
  ButlerHair,
  ButlerHat,
  ButlerOutfit,
  ButlerSleeve,
  ButlerShoe,
  ButlerToolHammer,
  ButlerToolClipboard,
  ButlerToolFoodTray,
  PetEye,
  PetNose,
  PetMouth,
  PetEar,
  PetTail,
  PetPaw,
  PetWhisker,
  PetBellyPatch,
  PetBackMark,
} from "../world/components/pixel-ui/actors"
import type {
  PixelPartProps,
  PixelPartVariant,
} from "../world/components/pixel-ui/pixel-ui.types"

import {
  PixelButlerPrototype,
  PixelHousePrototype,
  PixelPetPrototype,
  PixelTreePrototype,
} from "./pixel-art-prototypes"
import styles from "./pixel-layer-test.module.css"

type ComponentPreviewItem = {
  label: string
  name: string
  Component: ComponentType<PixelPartProps>
  variant?: PixelPartVariant
}

type ComponentGroup = {
  title: string
  items: ComponentPreviewItem[]
}

const planItems = [
  ["UI-00", "PIXEL-UI-DIRECTORY-PLAN", "已完成"],
  ["UI-01", "PIXEL-UI-LAYER-COMPONENTS", "已完成"],
  ["UI-02", "GROUND-GRASS-NATURE-COMPONENTS", "已完成"],
  ["UI-03", "BUILDING-FACILITY-COMPONENTS", "已完成"],
  ["UI-04", "ACTOR-BASIC-COMPONENTS", "已完成"],
  ["UI-05", "ACTOR-DETAIL-COMPONENTS", "已完成"],
  ["RULE-00", "WORLD-TIME-AND-RESOURCE-RULES", "已完成"],
  ["DEV-UI-01", "PIXEL-LAYER-TEST-PAGE", "当前页面"],
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

const componentGroups: ComponentGroup[] = [
  {
    title: "Ground / 地面组件",
    items: [
      { label: "地面基础块", name: "GroundTile", Component: GroundTile },
      { label: "泥地区块", name: "DirtPatch", Component: DirtPatch },
      { label: "地面边界", name: "GroundEdge", Component: GroundEdge },
    ],
  },
  {
    title: "Grass / 草地组件",
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
    title: "Nature / 树木自然组件",
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
    title: "Buildings / 建筑组件",
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
    title: "Facilities / 设施组件",
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
    title: "Adoption Center / 领养中心组件",
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
    title: "Actors / 角色组件",
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

function ComponentCard({
  item,
}: {
  item: ComponentPreviewItem
}) {
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

export default function PixelLayerTestPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>AI-PET-WORLD Pixel Layer Test</p>
        <h1>像素图层测试页</h1>
        <p>
          此页面用于查看 pixel-ui 图层、组件和低保真组合效果，不属于正式玩家主世界。
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
        <h2>组件展示</h2>
        <div className={styles.groupStack}>
          {componentGroups.map((group) => (
            <section className={styles.componentGroup} key={group.title}>
              <h3>{group.title}</h3>
              <div className={styles.componentGrid}>
                {group.items.map((item) => (
                  <ComponentCard item={item} key={item.name} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Pixel-art prototype / 像素美术原型</h2>
        <p className={styles.prototypeIntro}>
          以下原型不是最终美术，而是用于验证 AI-PET-WORLD 的宠物、管家、房屋和树木是否具备清晰可识别的像素风格。
        </p>
        <div className={styles.prototypeBoard}>
          <article className={styles.prototypeCard}>
            <h3>PixelPetPrototype</h3>
            <PixelPetPrototype />
          </article>
          <article className={styles.prototypeCard}>
            <h3>PixelButlerPrototype</h3>
            <PixelButlerPrototype />
          </article>
          <article className={styles.prototypeCard}>
            <h3>PixelHousePrototype</h3>
            <PixelHousePrototype />
          </article>
          <article className={styles.prototypeCard}>
            <h3>PixelTreePrototype</h3>
            <PixelTreePrototype />
          </article>
        </div>
      </section>
    </main>
  )
}
