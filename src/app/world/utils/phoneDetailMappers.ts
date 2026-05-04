/**
 * 当前文件负责：整理未来手机详情页所需的数据。
 */

import type {
  ButlerHudData,
  HomeHudData,
  HudMeter,
  PetHudData,
  WorldHudBundle,
} from "./worldHudMappers"

export type PhoneDetailSection = {
  title: string
  description?: string
  rows: PhoneDetailRow[]
}

export type PhoneDetailRow = {
  label: string
  value: string
  helperText?: string
  meter?: HudMeter
}

export type PhoneDetailPageData = {
  routeKey: "phone.pet.detail" | "phone.butler.detail" | "phone.home.detail"
  title: string
  subtitle: string
  statusLabel: string
  summary: string
  tags: string[]
  sections: PhoneDetailSection[]
}

export type PhonePetDetailData = PhoneDetailPageData & {
  routeKey: "phone.pet.detail"
  petName: string
}

export type PhoneButlerDetailData = PhoneDetailPageData & {
  routeKey: "phone.butler.detail"
  butlerName: string
}

export type PhoneHomeDetailData = PhoneDetailPageData & {
  routeKey: "phone.home.detail"
  levelLabel: string
}

export type PhoneDetailBundle = {
  pet: PhonePetDetailData
  butler: PhoneButlerDetailData
  home: PhoneHomeDetailData
}

function buildMeterRow(label: string, meter: HudMeter): PhoneDetailRow {
  return {
    label,
    value: meter.valueLabel,
    meter,
  }
}

function buildPetDetail(pet: PetHudData): PhonePetDetailData {
  return {
    routeKey: "phone.pet.detail",
    title: "宠物详情",
    subtitle: pet.available ? pet.name : "等待新的生命反应",
    statusLabel: pet.available ? pet.actionLabel : "未出生",
    summary: pet.available
      ? `${pet.name} 当前处于「${pet.actionLabel}」状态，情绪表现为「${pet.moodLabel}」。`
      : "宠物尚未诞生，生命倾向会在出生后逐步进入世界表现。",
    tags: [
      pet.lifePhaseLabel,
      pet.genderPerspectiveLabel,
      pet.temperamentLabel,
      ...pet.traitTags,
    ].filter(Boolean),
    sections: [
      {
        title: "当前状态",
        rows: [
          {
            label: "当前行为",
            value: pet.actionLabel,
          },
          {
            label: "情绪状态",
            value: pet.moodLabel,
          },
          {
            label: "生命阶段",
            value: pet.lifePhaseLabel,
          },
          buildMeterRow("能量", pet.meters.energy),
          buildMeterRow("饥饿", pet.meters.hunger),
        ],
      },
      {
        title: "生命倾向",
        description: "这里显示的是正式用户可理解的生命表现，不显示底层命理结构。",
        rows: [
          {
            label: "生命视角",
            value: pet.genderPerspectiveLabel,
          },
          {
            label: "天生气质",
            value: pet.temperamentLabel,
          },
          {
            label: "当前倾向",
            value: pet.currentTendencyLabel,
          },
          {
            label: "行为偏置",
            value: pet.behaviorBiasSummary,
          },
        ],
      },
    ],
    petName: pet.name,
  }
}

function buildButlerDetail(butler: ButlerHudData): PhoneButlerDetailData {
  return {
    routeKey: "phone.butler.detail",
    title: "管家详情",
    subtitle: butler.available ? butler.name : "管家未就位",
    statusLabel: butler.available ? butler.taskLabel : "未就位",
    summary: butler.available
      ? `${butler.name} 当前任务是「${butler.taskLabel}」，情绪状态为「${butler.moodLabel}」。`
      : "世界还没有读取到管家状态。",
    tags: [butler.taskLabel, butler.moodLabel, `机会 ${butler.opportunityCount}`],
    sections: [
      {
        title: "当前任务",
        rows: [
          {
            label: "任务",
            value: butler.taskLabel,
          },
          {
            label: "情绪",
            value: butler.moodLabel,
          },
          {
            label: "待处理机会",
            value: `${butler.opportunityCount}`,
          },
        ],
      },
      {
        title: "角色边界",
        description: "管家是机会提供者，不是宠物控制器。",
        rows: [
          {
            label: "说明",
            value: butler.note,
          },
          {
            label: "控制边界",
            value: "管家可以维护环境、提供机会，但不能替宠物做决定。",
          },
        ],
      },
    ],
    butlerName: butler.name,
  }
}

function buildHomeDetail(home: HomeHudData): PhoneHomeDetailData {
  return {
    routeKey: "phone.home.detail",
    title: "家园详情",
    subtitle: home.available ? home.levelLabel : "家园未生成",
    statusLabel: home.available ? home.statusLabel : "未知",
    summary: home.available
      ? `家园当前为「${home.stageLabel}」，成长方向偏向「${home.focusLabel}」。`
      : "世界还没有读取到家园状态。",
    tags: [home.statusLabel, home.stageLabel, home.focusLabel],
    sections: [
      {
        title: "建设状态",
        rows: [
          {
            label: "等级",
            value: home.levelLabel,
          },
          {
            label: "状态",
            value: home.statusLabel,
          },
          {
            label: "阶段",
            value: home.stageLabel,
          },
          {
            label: "成长方向",
            value: home.focusLabel,
          },
          buildMeterRow("建设进度", home.meters.progress),
          buildMeterRow("庭院进度", home.meters.garden),
        ],
      },
      {
        title: "空间属性",
        rows: [
          buildMeterRow("舒适", home.meters.comfort),
          buildMeterRow("稳定", home.meters.stability),
          buildMeterRow("扩展", home.meters.expansion),
        ],
      },
    ],
    levelLabel: home.levelLabel,
  }
}

export function buildPhoneDetailBundle(hud: WorldHudBundle): PhoneDetailBundle {
  return {
    pet: buildPetDetail(hud.pet),
    butler: buildButlerDetail(hud.butler),
    home: buildHomeDetail(hud.home),
  }
}