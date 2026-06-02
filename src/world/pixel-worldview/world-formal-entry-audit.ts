// 该文件用于审计正式世界入口接入 PixelWorldView 前的风险项。
export type WorldFormalEntryAuditRiskLevel = "pass" | "warn" | "fail";

export type WorldFormalEntryAuditItem = {
  id: string;
  label: string;
  level: WorldFormalEntryAuditRiskLevel;
  target: string;
  reason: string;
  recommendation: string;
};

export type WorldFormalEntryAuditReport = {
  status: WorldFormalEntryAuditRiskLevel;
  items: WorldFormalEntryAuditItem[];
  summary: string;
};

export const WORLD_FORMAL_ENTRY_AUDIT_TARGETS = [
  "src/app/world",
  "src/app/world/page.tsx",
  "src/world",
];

export const WORLD_FORMAL_ENTRY_FORBIDDEN_TOKENS = [
  "buildSceneSvg",
  "data:image/svg",
  "WorldPainterReadonlyPreview",
  "ProceduralRendererView",
  "FormalWorldView",
  "runAndPersistOneRuntimeTick",
  "writeWorldRuntimeSaveRecord",
  "Manual Tick",
  "manual tick",
  "手动 Tick",
  "手动保存",
  "审计",
  "audit",
  "viewMode",
  "debugView",
];

export const WORLD_FORMAL_ENTRY_EXPECTED_CHAIN = [
  "WorldViewModel",
  "PixelWorldView",
  "Tile Layer",
  "Trace Layer",
  "Object Layer",
  "Sprite Layer",
  "Atmosphere Layer",
  "UI Overlay",
];

export function createWorldFormalEntryAuditReport(input: {
  foundForbiddenTokens: string[];
  hasPixelWorldViewEntry: boolean;
  hasRuntimeWrite: boolean;
  hasDefaultPet: boolean;
}): WorldFormalEntryAuditReport {
  const items: WorldFormalEntryAuditItem[] = [];

  if (input.foundForbiddenTokens.length > 0) {
    items.push({
      id: "formal_entry_forbidden_tokens",
      label: "正式 /world 仍存在禁止项",
      level: "fail",
      target: "src/app/world/**",
      reason: `发现禁止项：${input.foundForbiddenTokens.join(", ")}`,
      recommendation:
        "把 SVG、procedural renderer、formal renderer、Debug 卡片、手动 Tick 和审计工具迁入 /world-debug。",
    });
  }

  if (!input.hasPixelWorldViewEntry) {
    items.push({
      id: "formal_entry_missing_pixel_worldview",
      label: "正式 /world 尚未接入 PixelWorldView",
      level: "warn",
      target: "src/app/world/**",
      reason: "正式入口还没有明确使用 PixelWorldView 链路。",
      recommendation: "下一阶段建立正式 PixelWorldView 只读入口。",
    });
  }

  if (input.hasRuntimeWrite) {
    items.push({
      id: "formal_entry_runtime_write",
      label: "正式 /world 存在 runtime 写入风险",
      level: "fail",
      target: "src/app/world/**",
      reason: "正式页面不应推进 Tick 或写入 runtime。",
      recommendation: "正式 /world 只能只读 runtime，写入和手动 Tick 迁入 /world-debug。",
    });
  }

  if (input.hasDefaultPet) {
    items.push({
      id: "formal_entry_default_pet",
      label: "正式 /world 存在默认宠物风险",
      level: "fail",
      target: "src/app/world/**",
      reason: "宠物不是默认资产，不能无出生事实进入世界。",
      recommendation: "只有经过出生和入场规则后才能显示宠物。",
    });
  }

  const status: WorldFormalEntryAuditRiskLevel = items.some((item) => item.level === "fail")
    ? "fail"
    : items.some((item) => item.level === "warn")
      ? "warn"
      : "pass";

  const summary =
    status === "pass"
      ? "正式 /world 入口当前未发现阻断风险。"
      : status === "warn"
        ? "正式 /world 入口仍有需要迁移前确认的风险。"
        : "正式 /world 入口仍存在阻断级风险，接入 PixelWorldView 前必须清理。";

  return {
    status,
    items,
    summary,
  };
}
