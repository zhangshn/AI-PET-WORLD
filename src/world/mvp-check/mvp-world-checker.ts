/**
 * 当前文件负责：生成 MVP 世界全链路检查报告。
 */

import type {
  TimeState,
} from "@/engine/timeSystem"
import type {
  WorldStimulus,
} from "@/ai/ai-system-gateway"
import type {
  ButlerState,
} from "@/systems/butler/butler-schema"
import type {
  WorldEvent,
} from "@/types/event"
import type {
  HomeState,
} from "@/types/home"
import type {
  PetState,
} from "@/types/pet"
import type {
  WorldEcologyState,
} from "@/world/ecology/ecology-engine"
import type {
  WorldProgressionState,
} from "@/world/progression/world-progression-gateway"
import type {
  WorldRuntimeState,
} from "@/world/runtime/world-runtime"
import type {
  AdoptionState,
} from "@/world/adoption/adoption-center-schema"

import type {
  MvpCheckItem,
  MvpCheckReport,
  MvpCheckStatus,
} from "./mvp-check-schema"

export type BuildMvpWorldCheckReportInput = {
  tick: number
  time: TimeState | null
  pet: PetState | null
  butler: ButlerState | null
  home: HomeState | null
  adoptionState: AdoptionState | null
  worldRuntime: WorldRuntimeState | null
  ecology: WorldEcologyState | null
  worldProgression: WorldProgressionState | null
  events: WorldEvent[]
  stimuli: WorldStimulus[]
}

function buildItem(input: MvpCheckItem): MvpCheckItem {
  return input
}

function getOverallStatus(items: MvpCheckItem[]): MvpCheckStatus {
  if (items.some((item) => item.status === "fail")) return "fail"
  if (items.some((item) => item.status === "warn")) return "warn"

  return "pass"
}

function countByStatus(
  items: MvpCheckItem[],
  status: MvpCheckStatus
): number {
  return items.filter((item) => item.status === status).length
}

function hasValidNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value)
}

function formatAdoptionStatus(adoption: AdoptionState | null): string {
  if (!adoption) return "missing"

  return `${adoption.status} / ${adoption.progress}% / readiness ${adoption.readiness}%`
}

export function buildMvpWorldCheckReport(
  input: BuildMvpWorldCheckReportInput
): MvpCheckReport {
  const items: MvpCheckItem[] = [
    buildItem({
      id: "world_initialized",
      title: "世界初始化",
      status: input.time && input.home && input.adoptionState ? "pass" : "fail",
      message:
        input.time && input.home && input.adoptionState
          ? "世界基础状态已经可读取。"
          : "世界基础状态缺失，MVP 主循环无法可靠运行。",
      tags: ["mvp", "world", "initialization"],
    }),
    buildItem({
      id: "time_available",
      title: "时间状态",
      status:
        input.time &&
        hasValidNumber(input.time.day) &&
        hasValidNumber(input.time.hour)
          ? "pass"
          : "fail",
      message: input.time
        ? `当前 Day ${input.time.day} / Hour ${input.time.hour}。`
        : "时间状态不可读取。",
      tags: ["mvp", "time"],
    }),
    buildItem({
      id: "tick_valid",
      title: "Tick 有效",
      status: hasValidNumber(input.tick) && input.tick >= 0 ? "pass" : "fail",
      message: `当前 tick=${input.tick}。`,
      tags: ["mvp", "tick"],
    }),
    buildItem({
      id: "butler_available",
      title: "管家状态",
      status: input.butler ? "pass" : "fail",
      message: input.butler
        ? `管家存在，当前任务 ${input.butler.task}。`
        : "管家状态缺失。",
      tags: ["mvp", "butler"],
    }),
    buildItem({
      id: "home_available",
      title: "家园状态",
      status: input.home ? "pass" : "fail",
      message: input.home
        ? `家园阶段 ${input.home.constructionStage}，进度 ${Math.round(input.home.progress)}%。`
        : "家园状态缺失。",
      tags: ["mvp", "home"],
    }),
    buildItem({
      id: "adoption_available",
      title: "领养 / 抵达状态",
      status: input.adoptionState ? "pass" : "fail",
      message: input.adoptionState
        ? `领养状态 ${formatAdoptionStatus(input.adoptionState)}。`
        : "领养 / 抵达状态缺失。",
      tags: ["mvp", "adoption", "arrival"],
    }),
    buildItem({
      id: "pre_arrival_adoption_valid",
      title: "后置生命关系状态有效",
      status:
        input.pet || input.adoptionState?.status === "accepted_applied"
          ? "pass"
          : input.adoptionState?.hasOpportunityObservation
            ? "pass"
            : "warn",
      message:
        input.pet || input.adoptionState?.status === "accepted_applied"
          ? "Pet has entered after adoption review and safe apply."
          : input.adoptionState?.hasOpportunityObservation
            ? "Adoption center has an observable candidate, not a pet world fact."
            : "Adoption center has no observable observation yet.",
      tags: ["mvp", "adoption", "adoption_deferred"],
    }),
    buildItem({
      id: "pet_runtime_valid",
      title: "宠物运行状态",
      status:
        !input.pet ||
        (
          Boolean(input.pet.action) &&
          Boolean(input.pet.mood) &&
          hasValidNumber(input.pet.energy) &&
          hasValidNumber(input.pet.hunger)
        )
          ? "pass"
          : "fail",
      message: input.pet
        ? `宠物 ${input.pet.name}：${input.pet.action} / ${input.pet.mood}。`
        : "Pet has not entered through accepted adoption yet; runtime check is skipped.",
      tags: ["mvp", "pet"],
    }),
    buildItem({
      id: "world_runtime_available",
      title: "世界运行状态",
      status: input.worldRuntime ? "pass" : "fail",
      message: input.worldRuntime
        ? "worldRuntime 已经可读取。"
        : "worldRuntime 缺失。",
      tags: ["mvp", "world_runtime"],
    }),
    buildItem({
      id: "ecology_available",
      title: "生态状态",
      status: input.ecology ? "pass" : "warn",
      message: input.ecology
        ? `生态区域数量 ${input.ecology.zones.length}。`
        : "生态状态暂不可读取。",
      tags: ["mvp", "ecology"],
    }),
    buildItem({
      id: "events_readable",
      title: "事件可读取",
      status: Array.isArray(input.events) ? "pass" : "fail",
      message: `当前事件数量 ${input.events.length}。`,
      tags: ["mvp", "events"],
    }),
    buildItem({
      id: "stimuli_readable",
      title: "世界刺激可读取",
      status: Array.isArray(input.stimuli) ? "pass" : "warn",
      message: `当前世界刺激数量 ${input.stimuli.length}。`,
      tags: ["mvp", "stimuli"],
    }),
    buildItem({
      id: "progression_available",
      title: "世界进度状态",
      status: input.worldProgression ? "pass" : "warn",
      message: input.worldProgression
        ? "世界进度状态已经可读取。"
        : "世界进度状态暂不可读取。",
      tags: ["mvp", "progression"],
    }),
    buildItem({
      id: "save_runtime_safe",
      title: "保存运行环境",
      status: typeof window === "undefined" || window.localStorage ? "pass" : "warn",
      message:
        typeof window === "undefined"
          ? "当前在非浏览器环境，跳过 localStorage 强依赖检查。"
          : "浏览器 localStorage 可访问。",
      tags: ["mvp", "save"],
    }),
  ]

  const overallStatus = getOverallStatus(items)
  const passCount = countByStatus(items, "pass")
  const warnCount = countByStatus(items, "warn")
  const failCount = countByStatus(items, "fail")

  return {
    generatedAt: Date.now(),
    overallStatus,
    items,
    summary: `MVP Check：pass ${passCount} / warn ${warnCount} / fail ${failCount}。`,
    tags: [
      "mvp_check",
      `overall_${overallStatus}`,
      `pass_${passCount}`,
      `warn_${warnCount}`,
      `fail_${failCount}`,
    ],
  }
}
