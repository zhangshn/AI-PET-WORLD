import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const now = "2026-07-06T00:00:00.000Z";

const worldStatePath = path.join(root, "data/live-world/world-states/p2-fixed-seed-5x5-world.json");
const pageGatePath = path.join(root, "data/live-world/page-gates/p7-runtime-page-gate.json");
const outputRoot = path.join(root, "data/live-world/ecosystem-expansions");
const planPath = path.join(outputRoot, "p9-ecosystem-expansion-plan.json");
const latestPath = path.join(outputRoot, "latest-ecosystem-expansion-plan.json");

function projectPath(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

const worldState = JSON.parse(await readFile(worldStatePath, "utf8"));
const pageGate = JSON.parse(await readFile(pageGatePath, "utf8"));

const definitions = [
  {
    entityKind: "butler_npc",
    category: "character",
    introductionMode: "dictionary_only",
    displayName: "管家",
    purpose: "执行采集、整理、搬运、照料等行为，是玩家指令进入世界规则的主要执行者。",
    allowedBiomes: ["home_entrance", "open_grassland", "small_woods"],
    forbiddenTerrains: ["water"],
    lifecyclePolicy: "daily_activity",
    collisionPolicy: "dynamic_actor",
    visualProfilePrefix: "character.butler",
    behaviorHooks: ["inspect_entity", "harvest_resource", "clear_resource", "place_resource"],
    requiredBeforeWorldStateApply: ["actor schema", "pathfinding policy", "inventory contract"],
  },
  {
    entityKind: "villager_npc",
    category: "character",
    introductionMode: "dictionary_only",
    displayName: "村民",
    purpose: "作为后续社交、交易、任务和生态活动的角色扩展，不在当前 MVP 直接落地。",
    allowedBiomes: ["home_entrance", "open_grassland"],
    forbiddenTerrains: ["water", "wetland"],
    lifecyclePolicy: "daily_activity",
    collisionPolicy: "dynamic_actor",
    visualProfilePrefix: "character.villager",
    behaviorHooks: ["inspect_entity"],
    requiredBeforeWorldStateApply: ["npc schedule", "dialogue-less interaction contract", "pathfinding policy"],
  },
  {
    entityKind: "storage_shed",
    category: "building",
    introductionMode: "dictionary_only",
    displayName: "储物棚",
    purpose: "保存采集物和工具，是资源循环进入长期库存系统的建筑锚点。",
    allowedBiomes: ["home_entrance"],
    forbiddenTerrains: ["water", "shoreline", "wetland"],
    lifecyclePolicy: "decay_or_repair",
    collisionPolicy: "blocks_movement",
    visualProfilePrefix: "building.storage_shed",
    behaviorHooks: ["place_resource", "inspect_entity"],
    requiredBeforeWorldStateApply: ["building footprint rule", "inventory storage contract", "construction cost rule"],
  },
  {
    entityKind: "water_well",
    category: "building",
    introductionMode: "dictionary_only",
    displayName: "水井",
    purpose: "提供稳定水源，后续可影响植物照料、村民活动和家园维护。",
    allowedBiomes: ["home_entrance", "open_grassland"],
    forbiddenTerrains: ["water", "shoreline"],
    lifecyclePolicy: "decay_or_repair",
    collisionPolicy: "blocks_movement",
    visualProfilePrefix: "building.water_well",
    behaviorHooks: ["inspect_entity", "water_resource"],
    requiredBeforeWorldStateApply: ["water source rule", "building footprint rule", "interaction cooldown"],
  },
  {
    entityKind: "workbench",
    category: "building",
    introductionMode: "dictionary_only",
    displayName: "工作台",
    purpose: "作为后续合成、修理、工具升级的交互建筑。",
    allowedBiomes: ["home_entrance"],
    forbiddenTerrains: ["water", "shoreline", "wetland"],
    lifecyclePolicy: "decay_or_repair",
    collisionPolicy: "blocks_movement",
    visualProfilePrefix: "building.workbench",
    behaviorHooks: ["inspect_entity", "place_resource"],
    requiredBeforeWorldStateApply: ["crafting contract", "building footprint rule", "recipe dictionary"],
  },
  {
    entityKind: "rabbit",
    category: "animal",
    introductionMode: "dictionary_only",
    displayName: "野兔",
    purpose: "提供小型动物生态活动，用于验证移动实体、惊扰、觅食和昼夜活动。",
    allowedBiomes: ["open_grassland", "small_woods"],
    forbiddenTerrains: ["water"],
    lifecyclePolicy: "daily_activity",
    collisionPolicy: "dynamic_actor",
    visualProfilePrefix: "animal.rabbit",
    behaviorHooks: ["inspect_entity"],
    requiredBeforeWorldStateApply: ["animal movement rule", "avoid player rule", "spawn density rule"],
  },
  {
    entityKind: "bird",
    category: "animal",
    introductionMode: "dictionary_only",
    displayName: "小鸟",
    purpose: "作为非阻挡动物和氛围生态实体，用于验证视觉层可以表达动态但不改变主要碰撞。",
    allowedBiomes: ["small_woods", "water_edge", "open_grassland"],
    forbiddenTerrains: [],
    lifecyclePolicy: "daily_activity",
    collisionPolicy: "non_blocking",
    visualProfilePrefix: "animal.bird",
    behaviorHooks: ["inspect_entity"],
    requiredBeforeWorldStateApply: ["non blocking actor rule", "ambient spawn rule", "animation state contract"],
  },
  {
    entityKind: "butterfly",
    category: "animal",
    introductionMode: "dictionary_only",
    displayName: "蝴蝶",
    purpose: "作为花草区域的生态反馈，主要用于视觉活性和花朵生态联动。",
    allowedBiomes: ["open_grassland", "water_edge"],
    forbiddenTerrains: ["water"],
    lifecyclePolicy: "seasonal_activity",
    collisionPolicy: "decorative_only",
    visualProfilePrefix: "animal.butterfly",
    behaviorHooks: ["inspect_entity"],
    requiredBeforeWorldStateApply: ["seasonal spawn rule", "flower proximity rule", "decorative entity policy"],
  },
  {
    entityKind: "tree_seedling_spread",
    category: "ecology",
    introductionMode: "dictionary_only",
    displayName: "树苗扩散",
    purpose: "让成熟树在合适地形附近产生树苗候选，是活世界长期自然演化的基础规则。",
    allowedBiomes: ["small_woods", "open_grassland"],
    forbiddenTerrains: ["water", "dirt_path"],
    lifecyclePolicy: "growth_cycle",
    collisionPolicy: "non_blocking",
    visualProfilePrefix: "ecology.tree_seedling",
    behaviorHooks: ["inspect_entity"],
    requiredBeforeWorldStateApply: ["spawn conflict check", "max tree density rule", "growth tick rule"],
  },
  {
    entityKind: "flower_pollination",
    category: "ecology",
    introductionMode: "dictionary_only",
    displayName: "花朵授粉",
    purpose: "让花朵、蝴蝶和季节系统形成轻量生态联动。",
    allowedBiomes: ["open_grassland", "water_edge"],
    forbiddenTerrains: ["water", "stone_ground"],
    lifecyclePolicy: "seasonal_activity",
    collisionPolicy: "decorative_only",
    visualProfilePrefix: "ecology.flower_pollination",
    behaviorHooks: ["inspect_entity"],
    requiredBeforeWorldStateApply: ["season rule", "flower density rule", "decorative visual policy"],
  },
  {
    entityKind: "berry_bush_regrowth",
    category: "ecology",
    introductionMode: "dictionary_only",
    displayName: "浆果灌木再结果",
    purpose: "承接 P8 的采集行为，让 harvested 状态在指定 tick 后回到 fruiting。",
    allowedBiomes: ["small_woods", "open_grassland"],
    forbiddenTerrains: ["water", "dirt_path"],
    lifecyclePolicy: "growth_cycle",
    collisionPolicy: "non_blocking",
    visualProfilePrefix: "ecology.berry_bush_regrowth",
    behaviorHooks: ["harvest_resource", "inspect_entity"],
    requiredBeforeWorldStateApply: ["nextFruitTick rule", "season modifier", "visual refresh trigger"],
  },
];

const plan = {
  expansionPlanVersion: "live-world-p9-ecosystem-expansion-plan-v1",
  expansionPlanId: "live-world-p9-ecosystem-expansion-plan-0001",
  status: "planned_not_applied",
  sourceWorldStatePayloadHash: worldState.worldStatePayloadHash,
  sourceRuntimePageGatePath: projectPath(pageGatePath),
  sourceRuntimePageGateStatus: pageGate.status,
  definitions,
  safetyBoundary: {
    canModifyWorldState: false,
    canWriteImageFiles: false,
    canWriteTrainingSamples: false,
    canWriteApprovedVisuals: false,
    canBypassRuntimePageGate: false,
  },
  nextRequiredPipelines: {
    schemaMerge: true,
    placementRules: true,
    lifecycleRules: true,
    collisionProjectionRules: true,
    visualInputRules: true,
    candidateGeneration: true,
    ownerApprovalBeforeRuntimePage: true,
  },
  createdAt: now,
};

await mkdir(outputRoot, { recursive: true });
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(
  latestPath,
  `${JSON.stringify(
    {
      expansionPlanId: plan.expansionPlanId,
      status: plan.status,
      planPath: projectPath(planPath),
      definitionCount: definitions.length,
      sourceRuntimePageGateStatus: pageGate.status,
      canModifyWorldState: false,
      canBypassRuntimePageGate: false,
      createdAt: now,
    },
    null,
  )}\n`,
  "utf8",
);

console.log(`Wrote ${projectPath(planPath)}`);
console.log(`definitionCount=${definitions.length}`);
console.log(`status=${plan.status}`);
console.log(`canModifyWorldState=${plan.safetyBoundary.canModifyWorldState}`);
console.log(`canBypassRuntimePageGate=${plan.safetyBoundary.canBypassRuntimePageGate}`);
