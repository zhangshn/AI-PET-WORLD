/**
 * 当前文件负责：根据舞台状态生成稳定的世界焦点点位。
 */

import type {
  ButlerState,
} from "@/types/butler"
import type {
  HomeState,
} from "@/types/home"
import type {
  IncubatorState,
} from "@/types/incubator"
import type {
  PetState,
} from "@/types/pet"
import type {
  WorldMapState,
} from "@/world/map/world-map"
import type {
  WorldEcologyState,
} from "@/world/ecology/ecology-engine"

import type {
  ActorMotionState,
} from "../graphics/actors/actor-types"
import {
  SHELTER_INTERIOR_DOOR_HIT_BOX,
} from "../graphics/interior/interior-hit-areas"
import {
  resolveStageStructureLayout,
} from "../graphics/structures/structure-layout-resolver"
import type {
  WorldStageSceneMode,
} from "../orchestrator/stage-scene-mode"
import type {
  WorldFocusPoint,
  WorldFocusPointKind,
  WorldFocusPointPurpose,
} from "./world-focus-point-types"

export type BuildWorldFocusPointsInput = {
  sceneMode: WorldStageSceneMode
  map: WorldMapState | null
  home: HomeState | null
  incubator: IncubatorState | null
  pet: PetState | null
  butler: ButlerState | null
  petMotion: ActorMotionState | null
  butlerMotion: ActorMotionState | null
  ecology: WorldEcologyState | null
}

function createFocusPoint(input: {
  kind: WorldFocusPointKind
  purpose: WorldFocusPointPurpose[]
  x: number
  y: number
  radius: number
  enabled: boolean
  priority: number
  tags: string[]
}): WorldFocusPoint {
  return {
    id: `focus-${input.kind}`,
    kind: input.kind,
    purpose: input.purpose,
    x: Math.round(input.x),
    y: Math.round(input.y),
    radius: input.radius,
    enabled: input.enabled,
    priority: input.priority,
    tags: [
      "world_focus_point",
      `kind_${input.kind}`,
      ...input.tags,
    ],
  }
}

function isGardenAvailable(home: HomeState | null): boolean {
  return (
    home?.constructionStage === "garden" ||
    home?.constructionStage === "completed"
  )
}

function isHomeBuildAvailable(home: HomeState | null): boolean {
  return (
    home?.constructionStage === "foundation" ||
    home?.constructionStage === "frame" ||
    home?.constructionStage === "roof" ||
    home?.constructionStage === "interior"
  )
}

export function buildWorldFocusPoints(
  input: BuildWorldFocusPointsInput
): WorldFocusPoint[] {
  const layout = resolveStageStructureLayout(input.map)
  const shelter = layout.tempShelter
  const interiorExitX =
    SHELTER_INTERIOR_DOOR_HIT_BOX.x +
    SHELTER_INTERIOR_DOOR_HIT_BOX.width / 2
  const interiorExitY = SHELTER_INTERIOR_DOOR_HIT_BOX.y + 18

  const points: WorldFocusPoint[] = [
    createFocusPoint({
      kind: "shelter_entrance",
      purpose: ["enter", "move_target", "feedback"],
      x: shelter.x + 67,
      y: shelter.y + 108,
      radius: 34,
      enabled: input.sceneMode === "exterior",
      priority: 80,
      tags: ["scene_exterior", "shelter"],
    }),
    createFocusPoint({
      kind: "shelter_exit",
      purpose: ["exit", "move_target", "feedback"],
      x: interiorExitX,
      y: interiorExitY,
      radius: 42,
      enabled: input.sceneMode === "shelterInterior",
      priority: 90,
      tags: ["scene_interior", "shelter"],
    }),
    createFocusPoint({
      kind: "incubator",
      purpose: ["observe", "care", "move_target", "feedback"],
      x: shelter.x + 68,
      y: shelter.y + 32,
      radius: 44,
      enabled:
        Boolean(input.incubator?.hasEmbryo) ||
        input.incubator?.status !== "hatched",
      priority: input.incubator?.status === "hatched" ? 42 : 88,
      tags: [
        "incubator",
        input.incubator?.status
          ? `incubator_${input.incubator.status}`
          : "incubator_none",
      ],
    }),
    createFocusPoint({
      kind: "garden_observe",
      purpose: ["observe", "move_target", "feedback"],
      x: layout.garden.x + 62,
      y: layout.garden.y - 10,
      radius: 38,
      enabled: input.sceneMode === "exterior" && isGardenAvailable(input.home),
      priority: 62,
      tags: ["garden", "observe"],
    }),
    createFocusPoint({
      kind: "home_build",
      purpose: ["work", "move_target"],
      x: layout.homeConstruction.x + 78,
      y: layout.homeConstruction.y + 96,
      radius: 54,
      enabled:
        input.sceneMode === "exterior" &&
        isHomeBuildAvailable(input.home),
      priority: 66,
      tags: [
        "home_build",
        input.home?.constructionStage
          ? `stage_${input.home.constructionStage}`
          : "stage_none",
      ],
    }),
    createFocusPoint({
      kind: "boundary_observe",
      purpose: ["observe", "move_target"],
      x: layout.garden.x + 178,
      y: layout.garden.y + 92,
      radius: 76,
      enabled: input.sceneMode === "exterior",
      priority: 38,
      tags: [
        "boundary",
        input.ecology ? "ecology_available" : "ecology_none",
      ],
    }),
  ]

  if (input.pet && input.petMotion) {
    points.push(
      createFocusPoint({
        kind: "pet",
        purpose: ["observe", "care", "move_target"],
        x: input.petMotion.x,
        y: input.petMotion.y,
        radius: 42,
        enabled: true,
        priority: 74,
        tags: ["actor_pet", `pet_action_${input.pet.action}`],
      })
    )
  }

  if (input.butler && input.butlerMotion) {
    points.push(
      createFocusPoint({
        kind: "butler",
        purpose: ["observe", "move_target"],
        x: input.butlerMotion.x,
        y: input.butlerMotion.y,
        radius: 42,
        enabled: true,
        priority: 58,
        tags: ["actor_butler", `butler_task_${input.butler.task}`],
      })
    )
  }

  return points
    .filter((point) => point.enabled)
    .sort((a, b) => b.priority - a.priority)
}
