// 该文件用于定义正式世界入口迁移到 PixelWorldView 前的清理计划。
export type WorldFormalEntryCleanupPriority = "high" | "medium" | "low";

export type WorldFormalEntryCleanupStepStatus = "planned" | "blocked" | "ready";

export type WorldFormalEntryCleanupStep = {
  id: string;
  title: string;
  priority: WorldFormalEntryCleanupPriority;
  status: WorldFormalEntryCleanupStepStatus;
  target: string;
  riskSource: string;
  action: string;
  destination: string;
  expectedOutcome: string;
  safetyRule: string;
};

export type WorldFormalEntryCleanupPlan = {
  id: string;
  title: string;
  status: "planned";
  summary: string;
  steps: WorldFormalEntryCleanupStep[];
  nextSafeAction: string;
};

export const WORLD_FORMAL_ENTRY_CLEANUP_PLAN_ID = "world_formal_entry_cleanup_plan";

export const WORLD_FORMAL_ENTRY_CLEANUP_TARGETS = [
  "src/app/world/**",
  "src/app/world/page.tsx",
];

export function createWorldFormalEntryCleanupPlan(): WorldFormalEntryCleanupPlan {
  return {
    id: WORLD_FORMAL_ENTRY_CLEANUP_PLAN_ID,
    title: "正式 /world 入口清理计划",
    status: "planned",
    summary:
      "把正式 /world 中的 SVG、Debug、手动 Tick、手动保存和视图模式切换迁移到 /world-debug，为 PixelWorldView 只读正式入口让路。",
    steps: [
      {
        id: "move_svg_preview_to_debug",
        title: "迁移 SVG 主视觉预览",
        priority: "high",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "data:image/svg / WorldPainterReadonlyPreview",
        action: "从正式 /world 移除 SVG data-uri 与 WorldPainterReadonlyPreview 主视觉依赖。",
        destination: "/world-debug",
        expectedOutcome: "正式 /world 不再以 SVG 预览作为主世界。",
        safetyRule: "正式 /world 禁止 buildSceneSvg 和 data:image/svg。",
      },
      {
        id: "move_procedural_renderer_to_debug",
        title: "迁移 procedural renderer",
        priority: "high",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "ProceduralRendererView",
        action: "保留 procedural renderer 作为调试工具，但只允许在 /world-debug 下出现。",
        destination: "/world-debug/procedural-renderer",
        expectedOutcome: "正式 /world 不再引用 ProceduralRendererView。",
        safetyRule: "正式 /world 不承载 procedural renderer。",
      },
      {
        id: "move_formal_geometry_to_debug",
        title: "迁移 FormalWorldView",
        priority: "high",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "FormalWorldView",
        action: "把 FormalWorldView 保留为几何验证工具，正式入口移除其引用。",
        destination: "/world-debug",
        expectedOutcome: "正式 /world 不再使用 formal geometry 作为主视觉。",
        safetyRule: "正式主世界不能是 SVG / polygon / geometry view。",
      },
      {
        id: "move_manual_tick_to_debug",
        title: "迁移手动 Tick",
        priority: "high",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "手动 Tick / runAndPersistOneRuntimeTick",
        action: "正式 /world 移除手动 Tick 操作，Tick 调试入口只保留在 /world-debug。",
        destination: "/world-debug/proposal-audit",
        expectedOutcome: "正式 /world 只读 runtime，不推进 Tick。",
        safetyRule: "正式 /world 不允许写 runtime。",
      },
      {
        id: "move_manual_save_to_debug",
        title: "迁移手动保存",
        priority: "high",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "手动保存 / writeWorldRuntimeSaveRecord",
        action: "正式 /world 移除手动保存入口，保存调试能力只保留在 /world-debug。",
        destination: "/world-debug",
        expectedOutcome: "正式 /world 不写入 runtime save record。",
        safetyRule: "正式 /world 只读世界事实。",
      },
      {
        id: "remove_view_mode_switch_from_formal_world",
        title: "移除正式页视图模式切换",
        priority: "medium",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "viewMode / debugView",
        action: "正式 /world 不再提供 Debug 双视图或模式切换。",
        destination: "/world-debug",
        expectedOutcome: "正式 /world 只有一个正式 PixelWorldView 入口。",
        safetyRule: "Debug 视图统一进入 /world-debug。",
      },
      {
        id: "reduce_card_dashboard_surface",
        title: "压缩卡片仪表盘倾向",
        priority: "medium",
        status: "planned",
        target: "src/app/world/**",
        riskSource: "Hero / summary card / resource list / audit card",
        action: "正式 /world 保留必要状态与 P-Phone 入口，不再用卡片堆叠替代主世界画面。",
        destination: "formal PixelWorldView overlay",
        expectedOutcome: "正式体验以像素主世界为中心。",
        safetyRule: "Hero、状态卡、资源表和审计信息不能替代主世界。",
      },
      {
        id: "prepare_pixel_worldview_readonly_entry",
        title: "准备 PixelWorldView 只读正式入口",
        priority: "high",
        status: "ready",
        target: "src/app/world/**",
        riskSource: "missing PixelWorldView entry",
        action: "下一阶段建立正式 PixelWorldView 只读入口，读取 WorldViewModel 或过渡 ViewModel，不写 runtime。",
        destination: "src/app/world/**",
        expectedOutcome: "正式 /world 开始走 PixelWorldView 链路。",
        safetyRule: "宠物不能默认生成，runtime 不能被正式页面写入。",
      },
    ],
    nextSafeAction:
      "先生成 WORLD-FORMAL-ENTRY-CLEANUP-PLAN-00，再进入 WORLD-FORMAL-ENTRY-CLEANUP-EXECUTION-00。",
  };
}
