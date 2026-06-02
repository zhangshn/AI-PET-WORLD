// 该文件用于定义正式 PixelWorldView 渲染器接入计划。

export type WorldFormalPixelWorldRendererPlanStatus = "planned" | "blocked" | "ready";

export type WorldFormalPixelWorldRendererTarget =
  | "headless_pixel_buffer"
  | "formal_dom_boundary"
  | "future_pixi_renderer";

export type WorldFormalPixelWorldRendererSafetyRule = {
  id: string;
  label: string;
  required: boolean;
  reason: string;
};

export type WorldFormalPixelWorldRendererMilestone = {
  id: string;
  title: string;
  status: WorldFormalPixelWorldRendererPlanStatus;
  target: WorldFormalPixelWorldRendererTarget;
  input: string;
  output: string;
  action: string;
  safetyRules: string[];
};

export type WorldFormalPixelWorldRendererPlan = {
  id: string;
  title: string;
  status: "planned";
  summary: string;
  currentSafeChain: string[];
  rendererMilestones: WorldFormalPixelWorldRendererMilestone[];
  safetyRules: WorldFormalPixelWorldRendererSafetyRule[];
  nextSafeAction: string;
};

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_PLAN_ID = "world_formal_pixelworldview_renderer_plan";

export const WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SAFE_CHAIN = [
  "Runtime Readonly",
  "WorldViewModel",
  "PixelWorldSourceSnapshot",
  "PixelWorldViewModel",
  "PixelWorldRenderPlan",
  "PixelWorldRendererFrame",
  "PixelWorldPixelBufferFrame",
  "Formal PixelWorldView Renderer",
];

export function createWorldFormalPixelWorldRendererPlan(): WorldFormalPixelWorldRendererPlan {
  return {
    id: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_PLAN_ID,
    title: "正式 PixelWorldView 渲染器接入计划",
    status: "planned",
    summary:
      "在正式 /world 已清理为 PixelWorldView 只读入口后，下一阶段将从 PixelWorldPixelBufferFrame 接入真正的正式像素渲染器。渲染器必须只消费只读像素缓冲区，不写 runtime，不生成默认宠物，不回退到 SVG、canvas DOM 或 CSS 几何假渲染。",
    currentSafeChain: WORLD_FORMAL_PIXELWORLDVIEW_RENDERER_SAFE_CHAIN,
    safetyRules: [
      {
        id: "no_svg",
        label: "禁止 SVG 正式渲染",
        required: true,
        reason: "正式 PixelWorldView 不能回退到 buildSceneSvg、data:image/svg 或 <svg>。",
      },
      {
        id: "no_canvas_dom",
        label: "禁止 DOM canvas 正式入口",
        required: true,
        reason: "本阶段不使用 <canvas> / CanvasRenderingContext2D / getContext。",
      },
      {
        id: "no_css_geometry",
        label: "禁止 CSS 几何冒充主世界",
        required: true,
        reason: "正式主世界不能用 backgroundColor、gridTemplateColumns、absolute div 模拟世界渲染。",
      },
      {
        id: "runtime_readonly",
        label: "runtime 只读",
        required: true,
        reason: "正式 /world 不推进 Tick，不写入 runtime。",
      },
      {
        id: "no_default_pet",
        label: "禁止默认宠物生成",
        required: true,
        reason: "宠物必须来自出生事实与入场规则，renderer 不能生成宠物。",
      },
      {
        id: "buffer_is_source_of_truth",
        label: "PixelBufferFrame 是渲染输入",
        required: true,
        reason: "正式 renderer 只能消费 PixelWorldPixelBufferFrame 或其严格派生结构。",
      },
    ],
    rendererMilestones: [
      {
        id: "formal_renderer_contract",
        title: "建立正式 renderer contract",
        status: "ready",
        target: "formal_dom_boundary",
        input: "PixelWorldPixelBufferFrame",
        output: "WorldFormalPixelWorldRendererContract",
        action: "定义正式 renderer 输入、输出、安全边界和禁止项，不做真实绘制。",
        safetyRules: ["no_svg", "no_canvas_dom", "no_css_geometry", "runtime_readonly", "no_default_pet"],
      },
      {
        id: "formal_renderer_readonly_shell",
        title: "建立正式 renderer 只读外壳",
        status: "planned",
        target: "formal_dom_boundary",
        input: "WorldFormalPixelWorldRendererContract",
        output: "ReadonlyFormalPixelWorldRendererShell",
        action: "建立只读外壳组件，只展示 renderer readiness，不画世界。",
        safetyRules: ["runtime_readonly", "buffer_is_source_of_truth", "no_default_pet"],
      },
      {
        id: "future_pixi_renderer_adapter",
        title: "预留 PixiJS renderer adapter",
        status: "planned",
        target: "future_pixi_renderer",
        input: "PixelWorldPixelBufferFrame",
        output: "PixiJS scene adapter",
        action: "后续接入 PixiJS 时，通过 adapter 消费 buffer，不让 PixiJS 读取 runtime。",
        safetyRules: ["runtime_readonly", "buffer_is_source_of_truth", "no_default_pet"],
      },
      {
        id: "formal_world_renderer_swap",
        title: "替换正式只读状态页为 renderer",
        status: "blocked",
        target: "future_pixi_renderer",
        input: "Validated renderer adapter",
        output: "Formal PixelWorldView",
        action: "只有 contract、adapter、smoke 全部通过后，才允许正式 /world 从状态预览切换为真实 renderer。",
        safetyRules: [
          "no_svg",
          "no_canvas_dom",
          "no_css_geometry",
          "runtime_readonly",
          "no_default_pet",
          "buffer_is_source_of_truth",
        ],
      },
    ],
    nextSafeAction:
      "进入 WORLD-FORMAL-PIXELWORLDVIEW-RENDERER-CONTRACT-00，先定义正式 renderer contract，不直接绘制世界。",
  };
}
