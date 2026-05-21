/**
 * 当前文件职责：提供 FormalWorldView 的开发期 preview harness。
 */
import type { FormalVisualModel } from "@/world/formal-visual-model/formal-visual-model-gateway"

import { FormalWorldView } from "./formal-world-view"

const PREVIEW_WORLD_ID = "preview-formal-world"
const PREVIEW_AUDIT_TAGS = ["preview_only", "not_world_fact", "not_persisted"]

const PREVIEW_FORMAL_VISUAL_MODEL: FormalVisualModel = {
  version: "formal_visual_model_v0",
  worldId: PREVIEW_WORLD_ID,
  canvas: {
    worldId: PREVIEW_WORLD_ID,
    width: 320,
    height: 240,
    tileSize: 32,
    mood: "calm",
    atmosphere: "day",
    styleToken: "warmNatural",
    source: {
      source: "visual_state",
      sourceId: "preview_mock_canvas",
      worldId: PREVIEW_WORLD_ID,
    },
    auditTags: [
      "formal_canvas_model_v0",
      "preview_mock_canvas",
      ...PREVIEW_AUDIT_TAGS,
    ],
  },
  objects: [
    {
      id: "preview-object-point",
      kind: "surfaceDecoration",
      label: "预览点对象",
      layer: "surfaceDecoration",
      geometry: {
        kind: "point",
        point: { x: 2, y: 2 },
      },
      anchor: { x: 2, y: 2 },
      styleToken: "quiet",
      opacity: 0.9,
      source: {
        source: "visual_placement",
        sourceId: "preview_mock_point",
        worldId: PREVIEW_WORLD_ID,
      },
      auditTags: [
        "formal_world_object_v0",
        "preview_mock_point",
        ...PREVIEW_AUDIT_TAGS,
      ],
    },
    {
      id: "preview-object-line",
      kind: "path",
      label: "预览线对象",
      layer: "path",
      geometry: {
        kind: "line",
        line: {
          points: [
            { x: 1, y: 5 },
            { x: 4, y: 5.5 },
            { x: 7, y: 4.5 },
          ],
        },
      },
      anchor: { x: 4, y: 5 },
      styleToken: "ordered",
      opacity: 0.86,
      source: {
        source: "visual_placement",
        sourceId: "preview_mock_line",
        worldId: PREVIEW_WORLD_ID,
      },
      auditTags: [
        "formal_world_object_v0",
        "preview_mock_line",
        ...PREVIEW_AUDIT_TAGS,
      ],
    },
    {
      id: "preview-object-polygon",
      kind: "structure",
      label: "预览面对象",
      layer: "structure",
      geometry: {
        kind: "polygon",
        polygon: {
          points: [
            { x: 6.2, y: 1.5 },
            { x: 8.2, y: 1.5 },
            { x: 8.2, y: 3.2 },
            { x: 6.2, y: 3.2 },
          ],
        },
      },
      anchor: { x: 7.2, y: 2.4 },
      styleToken: "protective",
      opacity: 0.88,
      source: {
        source: "visual_placement",
        sourceId: "preview_mock_polygon",
        worldId: PREVIEW_WORLD_ID,
      },
      auditTags: [
        "formal_world_object_v0",
        "preview_mock_polygon",
        ...PREVIEW_AUDIT_TAGS,
      ],
    },
    {
      id: "preview-object-multipolygon",
      kind: "tree",
      label: "预览多面对象",
      layer: "nature",
      geometry: {
        kind: "multiPolygon",
        multiPolygon: {
          polygons: [
            {
              points: [
                { x: 1.4, y: 1.2 },
                { x: 2.5, y: 1 },
                { x: 2.8, y: 2.2 },
                { x: 1.7, y: 2.5 },
              ],
            },
            {
              points: [
                { x: 3, y: 2.1 },
                { x: 4.1, y: 2 },
                { x: 4.4, y: 3.1 },
                { x: 3.2, y: 3.4 },
              ],
            },
          ],
        },
      },
      anchor: { x: 2.8, y: 2.2 },
      styleToken: "warmNatural",
      opacity: 0.84,
      source: {
        source: "visual_placement",
        sourceId: "preview_mock_multipolygon",
        worldId: PREVIEW_WORLD_ID,
      },
      auditTags: [
        "formal_world_object_v0",
        "preview_mock_multipolygon",
        ...PREVIEW_AUDIT_TAGS,
      ],
    },
  ],
  actors: [
    {
      actorId: "preview-actor",
      actorKind: "butler",
      label: "预览角色",
      body: {
        kind: "polygon",
        polygon: {
          points: [
            { x: 4.8, y: 2.4 },
            { x: 5.4, y: 2.4 },
            { x: 5.4, y: 3.6 },
            { x: 4.8, y: 3.6 },
          ],
        },
      },
      aura: {
        kind: "polygon",
        polygon: {
          points: [
            { x: 4.2, y: 1.8 },
            { x: 6, y: 1.8 },
            { x: 6, y: 4.2 },
            { x: 4.2, y: 4.2 },
          ],
        },
      },
      anchor: { x: 5.1, y: 3.6 },
      poseToken: "observing",
      styleToken: "caretaking",
      canRender: true,
      source: {
        source: "visual_actor_geometry_projection",
        sourceId: "preview_mock_actor",
        worldId: PREVIEW_WORLD_ID,
      },
      auditTags: [
        "formal_actor_model_v0",
        "preview_mock_actor",
        ...PREVIEW_AUDIT_TAGS,
      ],
    },
  ],
  environment: {
    worldId: PREVIEW_WORLD_ID,
    mood: "calm",
    atmosphere: "day",
    styleToken: "warmNatural",
    timeLabel: "预览时间",
    weatherLabel: "预览天气",
    source: {
      source: "visual_state",
      sourceId: "preview_mock_environment",
      worldId: PREVIEW_WORLD_ID,
    },
    auditTags: [
      "formal_environment_model_v0",
      "preview_mock_environment",
      ...PREVIEW_AUDIT_TAGS,
    ],
  },
  hudSummary: {
    worldId: PREVIEW_WORLD_ID,
    worldPhaseLabel: "预览阶段",
    butlerStatusLabel: "预览角色仅用于壳层验证",
    petStatus: "notEntered",
    petStatusLabel: "预览未接入宠物",
    recentLogHint: "这是开发预览，不是正式世界日志",
    playerFacingNotes: [
      "preview mock 不进入正式数据流",
      "preview mock 不是世界事实",
    ],
    source: {
      source: "visual_state",
      sourceId: "preview_mock_hud",
      worldId: PREVIEW_WORLD_ID,
    },
    auditTags: [
      "formal_hud_summary_v0",
      "preview_mock_hud",
      ...PREVIEW_AUDIT_TAGS,
    ],
  },
  audit: {
    source: "visual_state",
    worldId: PREVIEW_WORLD_ID,
    visualPlacementCount: 4,
    visualActorProjectionCount: 1,
    visualTerrainCellCount: 0,
    drawCommandCount: 0,
    warnings: ["preview_mock_only"],
    auditTags: [
      "formal_visual_audit_v0",
      "preview_mock_audit",
      ...PREVIEW_AUDIT_TAGS,
    ],
  },
  auditTags: [
    "formal_visual_model_v0",
    "formal_view_preview_harness_v0",
    ...PREVIEW_AUDIT_TAGS,
  ],
}

export function FormalWorldViewPreview() {
  return <FormalWorldView model={PREVIEW_FORMAL_VISUAL_MODEL} />
}
