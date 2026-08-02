import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  appendAiPainterProgramEvent,
  formatShanghai,
  writeImmutableProgramRun,
} from "./lib/ai-painter-program-event-store.mjs";
import { buildCompleteMapSemanticTopologySignature } from "./lib/complete-map-semantic-topology-signature.mjs";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(
  ROOT,
  ".runtime",
  "ai-painter",
  "earth-geospatial-v7-mvp-slot-condition-runs",
);
const OUTPUT_ROOT =
  ".runtime/ai-painter/earth-geospatial-v7-capacity-146-209-complete-framework-audits";
const WIDTH = 64;
const HEIGHT = 48;
const TARGET_SLOT_IDS = Array.from(
  { length: 64 },
  (_, index) => `v7-capacity-slot-${146 + index}`,
);
const REFERENCE_SLOT_ID = "v7-capacity-slot-198";
const EXPECTED_COMPOSITION_REVISIONS = new Set([
  "owner-authorized-thailand-rebuild64-full-world-dynamic-readiness-v3-20260731",
  "owner-authorized-thailand-rebuild64-semantic-topology-diversity-v4-20260801",
  "owner-authorized-thailand-rebuild64-flowing-water-connectivity-and-all-history-novelty-v5-20260801",
  "owner-authorized-thailand-rebuild64-cross-modal-rgb-collapse-prevention-v6-20260801",
]);
const TRANSFORMS = [
  "identity",
  "horizontal_mirror",
  "vertical_mirror",
  "rotate_180",
];
const CHANNEL_IDS = [
  "terrain_path_ground",
  "terrain_water",
  "terrain_shoreline",
  "terrain_natural_boundary",
  "terrain_mud_patch",
  "terrain_tall_grass",
  "object_footprints",
];
const COMPOSITION_CHANNEL_IDS = CHANNEL_IDS.filter(
  (channelId) => channelId !== "terrain_path_ground",
);
const MAXIMUM_ALLOWED_ROUTE_SIMILARITY = 0.92;
const MAXIMUM_ALLOWED_COMPLETE_FRAMEWORK_SIMILARITY = 0.68;
const ATTENTION_ROUTE_SIMILARITY = 0.8;
const ATTENTION_COMPLETE_FRAMEWORK_SIMILARITY = 0.55;
const createdAtUtc = new Date().toISOString();
const createdAtAsiaShanghai = formatShanghai(createdAtUtc);
const runId =
  `earth-geospatial-v7-capacity-146-209-complete-framework-audit-` +
  createdAtUtc.replace(/[:.]/g, "-");

const selectedManifests = selectCurrentSuccessfulManifests();
assert(
  selectedManifests.length === 64,
  `expected 64 current successful condition packages, found ${selectedManifests.length}`,
);
assert(
  selectedManifests.map((entry) => entry.v7SlotId).join("|") ===
    TARGET_SLOT_IDS.join("|"),
  "selected condition package coverage is not exactly slot-146 through slot-209",
);

const records = [];
for (const manifest of selectedManifests) {
  const blueprint = readJson(manifest.blueprintPath);
  const conditionPack = readJson(manifest.conditionPackPath);
  const guideManifestPath = path.join(
    path.dirname(resolveProjectPath(manifest.conditionPackPath)),
    "condition-guide-manifest.json",
  );
  assert(
    fs.existsSync(guideManifestPath),
    `${manifest.v7SlotId} full-world condition guide is missing`,
  );
  const guideManifest = readJson(guideManifestPath);
  assert(
    conditionPack.channels?.length === 23,
    `${manifest.v7SlotId} does not contain exactly 23 channels`,
  );
  const focalArea = conditionPack.channels.find(
    (entry) => entry.id === "focal_area",
  );
  assert(
    Number(focalArea?.statistics?.nonZeroCount ?? -1) === 0,
    `${manifest.v7SlotId} focal_area is not all-zero`,
  );
  const geometry = blueprint.geometry ?? {};
  const architecture = geometry.compositionArchitecture ?? null;
  const polygonalEcologicalZoneCount = (
    geometry.ecologicalZones ?? []
  ).filter(
    (entry) =>
      Array.isArray(entry.polygon) && entry.polygon.length >= 3,
  ).length;
  const objectFootprints = geometry.objectFootprints ?? [];
  const compositionZonedObjectCount = objectFootprints.filter(
    (entry) =>
      typeof entry.compositionZoneId === "string" &&
      entry.compositionZoneId.length > 0 &&
      typeof entry.ecologyRole === "string" &&
      entry.ecologyRole.length > 0,
  ).length;
  const semanticFrameworkIssues = [
    ...(!architecture
      ? ["explicit_complete_composition_architecture_missing"]
      : []),
    ...(architecture && !EXPECTED_COMPOSITION_REVISIONS.has(architecture.revision)
      ? ["composition_architecture_revision_not_current"]
      : []),
    ...(blueprint.worldFrameContract?.contractVersion !==
        "complete-rectangular-world-and-future-dynamic-readiness-v2" ||
      blueprint.worldFrameContract?.frameCoverage
        ?.continuousWorldSurfaceMustFillRectangleEdgeToEdge !== true ||
      blueprint.worldFrameContract?.frameCoverage?.externalBackdropAllowed !==
        false ||
      blueprint.worldFrameContract?.boundaryConnectivity
        ?.routeMustVisiblyTouchContractSide !== true ||
      blueprint.worldFrameContract?.semanticDecomposition
        ?.futureRuntimeMotionReserved !== true
      ? ["full_world_dynamic_readiness_contract_missing"]
      : []),
    ...(guideManifest.schemaVersion !== "complete-world-condition-guide-v2" ||
      guideManifest.fullWorldRenderingContract?.everyPixelIsInWorld !== true ||
      guideManifest.fullWorldRenderingContract?.externalBackdropAllowed !==
        false ||
      guideManifest.fullWorldRenderingContract
        ?.floatingMapOrIslandCutoutAllowed !== false
      ? ["condition_guide_full_world_semantics_missing"]
      : []),
    ...(conditionPack.channels.find((entry) => entry.id === "terrain_grass")
      ?.statistics?.nonZeroCount !== 1024 * 768
      ? ["base_world_surface_does_not_cover_full_canvas"]
      : []),
    ...(polygonalEcologicalZoneCount < 3
      ? ["polygonal_ecological_partition_insufficient"]
      : []),
    ...((architecture?.objectPlacementZones?.length ?? 0) < 3
      ? ["ecological_object_placement_zones_insufficient"]
      : []),
    ...(objectFootprints.length === 0 ||
    compositionZonedObjectCount !== objectFootprints.length
      ? ["object_footprints_not_bound_to_ecological_zones"]
      : []),
    ...(!blueprint.structuralIdentities?.themeArchitectureIdentity
      ? ["theme_architecture_identity_missing"]
      : []),
    ...(!blueprint.structuralIdentities?.instanceDetailIdentity
      ? ["instance_detail_identity_missing"]
      : []),
  ];
  const constructionGrammarPayload = buildConstructionGrammarPayload(
    geometry,
  );
  const semanticTopologySignature =
    buildCompleteMapSemanticTopologySignature(blueprint);
  records.push({
    slotId: manifest.v7SlotId,
    slotNumber: Number(manifest.v7SlotId.slice(-3)),
    isReference: manifest.v7SlotId === REFERENCE_SLOT_ID,
    runId: manifest.runId,
    conditionId: manifest.conditionId,
    split: manifest.split,
    regionalLandscapeType: manifest.regionalLandscapeType,
    monsoonSeason: manifest.monsoonSeason,
    manifestPath: manifest.__manifestPath,
    manifestSha256: sha256File(manifest.__manifestPath),
    blueprintPath: manifest.blueprintPath,
    blueprintSha256: sha256File(manifest.blueprintPath),
    conditionPackPath: manifest.conditionPackPath,
    conditionPackSha256: sha256File(manifest.conditionPackPath),
    themeArchitectureIdentity:
      blueprint.structuralIdentities?.themeArchitectureIdentity ?? null,
    instanceDetailIdentity:
      blueprint.structuralIdentities?.instanceDetailIdentity ?? null,
    semanticFrameworkEvidence: {
      compositionArchitecturePresent: Boolean(architecture),
      compositionArchitectureRevision: architecture?.revision ?? null,
      worldFrameContractVersion:
        blueprint.worldFrameContract?.contractVersion ?? null,
      conditionGuideSchemaVersion: guideManifest.schemaVersion ?? null,
      conditionGuideFullWorldRenderingContract:
        guideManifest.fullWorldRenderingContract ?? null,
      polygonalEcologicalZoneCount,
      objectPlacementZoneCount:
        architecture?.objectPlacementZones?.length ?? 0,
      objectFootprintCount: objectFootprints.length,
      compositionZonedObjectCount,
      passed: semanticFrameworkIssues.length === 0,
      issues: semanticFrameworkIssues,
    },
    constructionGrammarPayload,
    constructionGrammarIdentity: canonicalSha256(
      constructionGrammarPayload,
    ),
    semanticTopologySignature,
    fingerprint: await buildFingerprint(conditionPack, manifest.v7SlotId),
  });
}

const constructionGrammarGroups = new Map();
for (const record of records) {
  const group =
    constructionGrammarGroups.get(record.constructionGrammarIdentity) ?? [];
  group.push(record.slotId);
  constructionGrammarGroups.set(record.constructionGrammarIdentity, group);
}
for (const record of records) {
  const group = constructionGrammarGroups.get(
    record.constructionGrammarIdentity,
  );
  record.constructionGrammarGroupSlotIds = [...group];
  record.constructionGrammarGroupSize = group.length;
  if (
    !record.semanticFrameworkEvidence.compositionArchitecturePresent &&
    group.length > 1
  ) {
    record.semanticFrameworkEvidence.issues.push(
      "shared_generic_construction_grammar",
    );
    record.semanticFrameworkEvidence.passed = false;
  }
}

const reference = records.find((entry) => entry.isReference);
assert(reference, "new slot-198 reference package is missing");
assert(
  reference.semanticFrameworkEvidence.passed,
  "slot-198 package does not satisfy the same current full-world framework contract as the other 63 packages",
);

const comparisons = [];
for (let leftIndex = 0; leftIndex < records.length; leftIndex += 1) {
  for (
    let rightIndex = leftIndex + 1;
    rightIndex < records.length;
    rightIndex += 1
  ) {
    comparisons.push(compareRecords(records[leftIndex], records[rightIndex]));
  }
}
assert(comparisons.length === 2016, "64-package pair coverage mismatch");

const hardFailurePairs = comparisons.filter((entry) =>
  [
    "exact_or_transformed_framework_duplicate",
    "shared_generic_construction_grammar",
    "complete_framework_hard_gate_failed",
    "semantic_route_topology_duplicate",
    "semantic_water_network_type_duplicate",
    "water_visual_training_motif_duplicate",
    "semantic_complete_skeleton_duplicate",
  ].includes(entry.classification),
);
const attentionPairs = comparisons.filter(
  (entry) => entry.classification === "similar_framework_requires_attention",
);
const targetResults = records.map((record) => {
    const related = comparisons.filter(
      (entry) =>
        entry.leftSlotId === record.slotId ||
        entry.rightSlotId === record.slotId,
    );
    const blocking = related.filter((entry) =>
      [
        "exact_or_transformed_framework_duplicate",
        "shared_generic_construction_grammar",
        "complete_framework_hard_gate_failed",
        "semantic_route_topology_duplicate",
        "semantic_water_network_type_duplicate",
        "water_visual_training_motif_duplicate",
        "semantic_complete_skeleton_duplicate",
      ].includes(entry.classification),
    );
    const attention = related.filter(
      (entry) =>
        entry.classification === "similar_framework_requires_attention",
    );
    const nearest = [...related].sort(
      (left, right) =>
        right.maximumCompleteFrameworkSimilarity -
        left.maximumCompleteFrameworkSimilarity,
    )[0];
    const referenceComparison = record.isReference ? null : related.find(
      (entry) =>
        entry.leftSlotId === REFERENCE_SLOT_ID ||
        entry.rightSlotId === REFERENCE_SLOT_ID,
    );
    const issueCodes = [
      ...record.semanticFrameworkEvidence.issues,
      ...(related.some(
        (entry) =>
          entry.classification ===
          "shared_generic_construction_grammar",
      )
        ? ["shared_generic_construction_grammar_pair_found"]
        : []),
      ...(blocking.length > 0
        ? [
            "complete_framework_similarity_or_semantic_topology_hard_gate_failed",
          ]
        : []),
      ...(attention.length > 0
        ? ["similar_complete_framework_requires_attention"]
        : []),
    ];
    return {
      slotId: record.slotId,
      conditionId: record.conditionId,
      regionalLandscapeType: record.regionalLandscapeType,
      monsoonSeason: record.monsoonSeason,
      status:
        issueCodes.length === 0
          ? "passed_current_complete_framework_standard"
          : "rebuild_required_under_current_complete_framework_standard",
      issueCodes: [...new Set(issueCodes)],
      semanticFrameworkEvidence: record.semanticFrameworkEvidence,
      blockingPartnerCount: blocking.length,
      blockingPartners: blocking.map((entry) => compactPair(entry, record.slotId)),
      attentionPartnerCount: attention.length,
      attentionPartners: attention
        .slice(0, 20)
        .map((entry) => compactPair(entry, record.slotId)),
      nearestFrameworkPair: compactPair(nearest, record.slotId),
      comparisonWithNew198: compactPair(
        referenceComparison,
        record.slotId,
      ),
    };
  });

const rebuildRequired = targetResults.filter(
  (entry) =>
    entry.status ===
    "rebuild_required_under_current_complete_framework_standard",
);
const report = {
  schemaVersion:
    "earth-geospatial-v7-capacity-146-209-complete-framework-audit-v2",
  runId,
  status:
    rebuildRequired.length === 0
      ? "all_64_packages_passed_full_world_dynamic_readiness_framework_standard"
      : "all_64_packages_audited_with_rebuild_findings",
  createdAtUtc,
  createdAtAsiaShanghai,
  ownerInstruction:
    "audit all 64 rebuilt packages under one full-rectangular-world, future-dynamic-readiness and independent-composition standard; do not generate RGB during this audit",
  scope: {
    selectedSlotRange: "v7-capacity-slot-146..v7-capacity-slot-209",
    selectedPackageCount: records.length,
    targetPackageCount: targetResults.length,
    referenceSlotId: REFERENCE_SLOT_ID,
    referenceConditionId: reference.conditionId,
    pairComparisonCount: comparisons.length,
    sourceRgbRead: false,
    generatedRgbRead: false,
    sourcePackagesModified: false,
    ownerReviewsModified: false,
    capacityContributionsModified: false,
    imageGenerationStarted: false,
    rgbCreated: false,
    gpuTrainingStarted: false,
  },
  method: {
    rasterSize: { width: WIDTH, height: HEIGHT },
    channels: CHANNEL_IDS,
    transforms: TRANSFORMS,
    routeSimilarityMethod:
      "maximum transformed binary intersection-over-union",
    compositionSimilarityMethod:
      "maximum transformed channel-tagged intersection-over-union across boundary, water, shoreline, tall-grass, mud and object-footprint channels",
    completeFrameworkFormula:
      "route_similarity*0.35 + composition_similarity*0.65",
    maximumAllowedRouteSimilarity: MAXIMUM_ALLOWED_ROUTE_SIMILARITY,
    maximumAllowedCompleteFrameworkSimilarity:
      MAXIMUM_ALLOWED_COMPLETE_FRAMEWORK_SIMILARITY,
    attentionRouteSimilarity: ATTENTION_ROUTE_SIMILARITY,
    attentionCompleteFrameworkSimilarity:
      ATTENTION_COMPLETE_FRAMEWORK_SIMILARITY,
    semanticFrameworkRequirements: [
      "explicit_complete_composition_architecture",
      "at_least_three_polygonal_ecological_zones",
      "at_least_three_ecological_object_placement_zones",
      "every_object_footprint_bound_to_composition_zone_and_ecology_role",
      "theme_architecture_and_instance_detail_identities",
      "full_rectangular_world_surface_coverage",
      "no_external_backdrop_or_floating_cutout",
      "route_boundary_side_hard_contract",
      "worldfacts_23_channel_future_dynamic_readiness",
      "semantic_route_water_shoreline_and_complete_skeleton_uniqueness",
      "different_measurement_window_or_hash_is_not_sufficient",
      "same_motif_with_coordinate_deformation_is_duplicate",
      "different_water_maps_require_different_network_connection_modes",
      "different_water_maps_must_not_share_the_same_visual_training_motif_even_when_semantic_labels_differ",
    ],
    reviewThresholdsChanged: false,
  },
  summary: {
    auditedTargetPackageCount: targetResults.length,
    passedTargetPackageCount:
      targetResults.length - rebuildRequired.length,
    rebuildRequiredPackageCount: rebuildRequired.length,
    rebuildRequiredSlotIds: rebuildRequired.map((entry) => entry.slotId),
    semanticFrameworkEvidencePassedCount: targetResults.filter(
      (entry) => entry.semanticFrameworkEvidence.passed,
    ).length,
    explicitCompositionArchitectureMissingCount: targetResults.filter(
      (entry) =>
        entry.issueCodes.includes(
          "explicit_complete_composition_architecture_missing",
        ),
    ).length,
    polygonalEcologicalPartitionInsufficientCount: targetResults.filter(
      (entry) =>
        entry.issueCodes.includes(
          "polygonal_ecological_partition_insufficient",
        ),
    ).length,
    ecologicalObjectBindingInsufficientCount: targetResults.filter(
      (entry) =>
        entry.issueCodes.includes(
          "object_footprints_not_bound_to_ecological_zones",
        ),
    ).length,
    hardFailurePairCount: hardFailurePairs.length,
    semanticRouteTopologyDuplicatePairCount: comparisons.filter(
      (entry) => entry.classification === "semantic_route_topology_duplicate",
    ).length,
    semanticWaterNetworkTypeDuplicatePairCount: comparisons.filter(
      (entry) =>
        entry.classification === "semantic_water_network_type_duplicate",
    ).length,
    waterVisualTrainingMotifDuplicatePairCount: comparisons.filter(
      (entry) =>
        entry.classification ===
        "water_visual_training_motif_duplicate",
    ).length,
    semanticCompleteSkeletonDuplicatePairCount: comparisons.filter(
      (entry) =>
        entry.classification === "semantic_complete_skeleton_duplicate",
    ).length,
    sharedGenericConstructionGrammarPairCount: comparisons.filter(
      (entry) =>
        entry.classification ===
        "shared_generic_construction_grammar",
    ).length,
    sharedConstructionGrammarGroupCount: [
      ...constructionGrammarGroups.values(),
    ].filter((slotIds) => slotIds.length > 1).length,
    attentionPairCount: attentionPairs.length,
    distinctPairCount: comparisons.filter(
      (entry) => entry.classification === "distinct",
    ).length,
    slot198PackagePassedUnderSame64Contract:
      reference.semanticFrameworkEvidence.passed,
    trainingOrRgbAuthorizedByThisAudit: false,
  },
  selectedPackages: records.map((entry) => ({
    slotId: entry.slotId,
    isReference: entry.isReference,
    runId: entry.runId,
    conditionId: entry.conditionId,
    split: entry.split,
    regionalLandscapeType: entry.regionalLandscapeType,
    monsoonSeason: entry.monsoonSeason,
    manifestPath: entry.manifestPath,
    manifestSha256: entry.manifestSha256,
    blueprintPath: entry.blueprintPath,
    blueprintSha256: entry.blueprintSha256,
    conditionPackPath: entry.conditionPackPath,
    conditionPackSha256: entry.conditionPackSha256,
    themeArchitectureIdentity: entry.themeArchitectureIdentity,
    instanceDetailIdentity: entry.instanceDetailIdentity,
    semanticFrameworkEvidence: entry.semanticFrameworkEvidence,
    constructionGrammarIdentity: entry.constructionGrammarIdentity,
    constructionGrammarGroupSize: entry.constructionGrammarGroupSize,
    constructionGrammarGroupSlotIds:
      entry.constructionGrammarGroupSlotIds,
    constructionGrammarPayload: entry.constructionGrammarPayload,
    semanticTopologySignature: entry.semanticTopologySignature,
    compositeSkeletonSha256: entry.fingerprint.compositeSha256,
  })),
  targetResults,
  hardFailurePairs,
  attentionPairs,
  nearestPairs: [...comparisons]
    .sort(
      (left, right) =>
        right.maximumCompleteFrameworkSimilarity -
          left.maximumCompleteFrameworkSimilarity ||
        right.maximumRouteSimilarity - left.maximumRouteSimilarity,
    )
    .slice(0, 200),
  blockers:
    rebuildRequired.length === 0
      ? []
      : [
          "thailand_rebuild64_packages_do_not_satisfy_current_full_world_framework_standard",
        ],
  nextAction:
    "wait_for_project_owner_authorization_before_resuming_rgb_generation",
  automaticStorage: true,
};

const stored = writeImmutableProgramRun({
  root: OUTPUT_ROOT,
  runId,
  fileName: "audit-report.json",
  record: report,
  latest: {
    targetPackageCount: targetResults.length,
    passedTargetPackageCount:
      targetResults.length - rebuildRequired.length,
    rebuildRequiredPackageCount: rebuildRequired.length,
    hardFailurePairCount: hardFailurePairs.length,
    semanticTopologyContractPath:
      "data/ai-painter/system-governance/complete-map-semantic-topology-diversity-contract-v1.json",
    semanticRouteTopologyDuplicatePairCount:
      report.summary.semanticRouteTopologyDuplicatePairCount,
    semanticWaterNetworkTypeDuplicatePairCount:
      report.summary.semanticWaterNetworkTypeDuplicatePairCount,
    semanticCompleteSkeletonDuplicatePairCount:
      report.summary.semanticCompleteSkeletonDuplicatePairCount,
    attentionPairCount: attentionPairs.length,
    imageGenerationStarted: false,
    gpuTrainingStarted: false,
  },
});
const reportSha256 = sha256File(stored.runPath);
appendAiPainterProgramEvent({
  timestamp: createdAtUtc,
  action:
    "audit_v7_capacity_146_209_full_world_dynamic_readiness_frameworks",
  runId,
  kind: "v7_data_quality_audit",
  status: rebuildRequired.length === 0 ? "success" : "blocked",
  title:
    rebuildRequired.length === 0
      ? "All 64 V7 capacity packages passed the full-world dynamic-readiness framework audit"
      : "The full-world framework audit found V7 capacity packages that require individual rebuilds",
  titleZh:
    rebuildRequired.length === 0
      ? "全部64个V7容量数据包通过完整世界与动态可用性框架审核"
      : "完整世界框架审核发现部分V7容量数据包需要逐项重建",
  detail:
    `targets=${targetResults.length}; passed=${targetResults.length - rebuildRequired.length}; rebuildRequired=${rebuildRequired.length}; pairComparisons=${comparisons.length}; reportSha256=${reportSha256}`,
  detailZh:
    `目标=${targetResults.length}；通过=${targetResults.length - rebuildRequired.length}；需重建=${rebuildRequired.length}；配对比较=${comparisons.length}；报告SHA-256=${reportSha256}`,
  script:
    "scripts/audit-earth-geospatial-v7-capacity-146-209-complete-frameworks.mjs",
  currentStep: "all_64_full_world_dynamic_readiness_framework_audit_complete",
  evidencePath: stored.runPath,
  evidence: [stored.runPath],
  finalGameMapSuccess: false,
  canEnterWorld: false,
});

console.log(
  JSON.stringify(
    {
      runId,
      status: report.status,
      reportPath: stored.runPath,
      reportSha256,
      summary: report.summary,
      imageGenerationStarted: false,
      rgbCreated: false,
      gpuTrainingStarted: false,
    },
    null,
    2,
  ),
);

function selectCurrentSuccessfulManifests() {
  const selected = new Map();
  for (const entry of fs.readdirSync(SOURCE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(
      SOURCE_ROOT,
      entry.name,
      "complete-map-condition-run.json",
    );
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (
      !TARGET_SLOT_IDS.includes(manifest.v7SlotId) ||
      manifest.status !==
        "complete_map_conditions_ready_rgb_authorization_required"
    ) {
      continue;
    }
    const prior = selected.get(manifest.v7SlotId);
    if (
      !prior ||
      String(manifest.createdAtUtc) > String(prior.createdAtUtc)
    ) {
      selected.set(manifest.v7SlotId, {
        ...manifest,
        __manifestPath: projectPath(manifestPath),
      });
    }
  }
  return TARGET_SLOT_IDS.map((slotId) => selected.get(slotId)).filter(Boolean);
}

async function buildFingerprint(conditionPack, slotId) {
  const masks = {};
  const composite = new Uint8Array(WIDTH * HEIGHT);
  for (let channelIndex = 0; channelIndex < CHANNEL_IDS.length; channelIndex += 1) {
    const channelId = CHANNEL_IDS[channelIndex];
    const channel = conditionPack.channels.find(
      (entry) => entry.id === channelId,
    );
    assert(channel?.path, `${slotId}/${channelId} channel is missing`);
    const resized = await sharp(resolveProjectPath(channel.path), {
      failOn: "error",
    })
      .greyscale()
      .resize(WIDTH, HEIGHT, { fit: "fill", kernel: "nearest" })
      .raw()
      .toBuffer();
    const mask = new Uint8Array(WIDTH * HEIGHT);
    const bit = 1 << channelIndex;
    for (let index = 0; index < mask.length; index += 1) {
      if (resized[index] > 0) {
        mask[index] = 1;
        composite[index] |= bit;
      }
    }
    masks[channelId] = mask;
  }
  return {
    masks,
    composite,
    compositeSha256: sha256(composite),
  };
}

function compareRecords(left, right) {
  const variants = TRANSFORMS.map((transform) => {
    const transformedMasks = Object.fromEntries(
      CHANNEL_IDS.map((channelId) => [
        channelId,
        transformMask(right.fingerprint.masks[channelId], transform),
      ]),
    );
    const transformedComposite = transformMask(
      right.fingerprint.composite,
      transform,
    );
    const routeSimilarity = binaryIoU(
      left.fingerprint.masks.terrain_path_ground,
      transformedMasks.terrain_path_ground,
    );
    const compositionSimilarity = taggedIoU(
      left.fingerprint.masks,
      transformedMasks,
      COMPOSITION_CHANNEL_IDS,
    );
    return {
      transform,
      routeSimilarity,
      compositionSimilarity,
      completeFrameworkSimilarity: round(
        routeSimilarity * 0.35 + compositionSimilarity * 0.65,
      ),
      compositeEqualityRatio: equalityRatio(
        left.fingerprint.composite,
        transformedComposite,
      ),
      compositeNonZeroIoU: nonZeroCompositeIoU(
        left.fingerprint.composite,
        transformedComposite,
      ),
      exactTransformedCompositeDuplicate:
        equalityRatio(
          left.fingerprint.composite,
          transformedComposite,
        ) === 1,
    };
  });
  const maximumRouteSimilarity = Math.max(
    ...variants.map((entry) => entry.routeSimilarity),
  );
  const maximumCompositionSimilarity = Math.max(
    ...variants.map((entry) => entry.compositionSimilarity),
  );
  const maximumCompleteFrameworkSimilarity = round(
    maximumRouteSimilarity * 0.35 +
      maximumCompositionSimilarity * 0.65,
  );
  const bestSameTransform = [...variants].sort(
    (a, b) =>
      b.completeFrameworkSimilarity - a.completeFrameworkSimilarity,
  )[0];
  const exactOrTransformedDuplicate = variants.some(
    (entry) => entry.exactTransformedCompositeDuplicate,
  );
  const sharedGenericConstructionGrammar =
    left.constructionGrammarIdentity ===
      right.constructionGrammarIdentity &&
    !left.semanticFrameworkEvidence.compositionArchitecturePresent &&
    !right.semanticFrameworkEvidence.compositionArchitecturePresent;
  const leftSemantic = left.semanticTopologySignature;
  const rightSemantic = right.semanticTopologySignature;
  const semanticCompleteSkeletonDuplicate =
    leftSemantic.identities.completeSkeletonSemanticIdentity ===
    rightSemantic.identities.completeSkeletonSemanticIdentity;
  const semanticWaterNetworkTypeDuplicate =
    leftSemantic.waterAndShoreline.present === true &&
    rightSemantic.waterAndShoreline.present === true &&
    leftSemantic.waterAndShoreline.networkConnectionMode ===
      rightSemantic.waterAndShoreline.networkConnectionMode;
  const waterVisualTrainingMotifDuplicate =
    leftSemantic.waterAndShoreline.present === true &&
    rightSemantic.waterAndShoreline.present === true &&
    leftSemantic.identities.waterVisualTrainingMotifIdentity ===
      rightSemantic.identities.waterVisualTrainingMotifIdentity;
  const semanticRouteTopologyDuplicate =
    leftSemantic.route.contractedEntrySide ===
      rightSemantic.route.contractedEntrySide &&
    leftSemantic.route.routeTopologyFamily ===
      rightSemantic.route.routeTopologyFamily &&
    leftSemantic.route.spanAxisClass ===
      rightSemantic.route.spanAxisClass &&
    leftSemantic.route.originBandClass ===
      rightSemantic.route.originBandClass &&
    leftSemantic.route.majorTurnSequence ===
      rightSemantic.route.majorTurnSequence &&
    leftSemantic.route.majorBendCountClass ===
      rightSemantic.route.majorBendCountClass &&
    left.regionalLandscapeType === right.regionalLandscapeType &&
    left.monsoonSeason === right.monsoonSeason;
  const classification = exactOrTransformedDuplicate
    ? "exact_or_transformed_framework_duplicate"
    : waterVisualTrainingMotifDuplicate
      ? "water_visual_training_motif_duplicate"
    : semanticWaterNetworkTypeDuplicate
      ? "semantic_water_network_type_duplicate"
    : semanticCompleteSkeletonDuplicate
      ? "semantic_complete_skeleton_duplicate"
    : semanticRouteTopologyDuplicate
      ? "semantic_route_topology_duplicate"
    : sharedGenericConstructionGrammar
      ? "shared_generic_construction_grammar"
    : maximumRouteSimilarity >= MAXIMUM_ALLOWED_ROUTE_SIMILARITY ||
        maximumCompleteFrameworkSimilarity >=
          MAXIMUM_ALLOWED_COMPLETE_FRAMEWORK_SIMILARITY
      ? "complete_framework_hard_gate_failed"
      : maximumRouteSimilarity >= ATTENTION_ROUTE_SIMILARITY ||
          maximumCompleteFrameworkSimilarity >=
            ATTENTION_COMPLETE_FRAMEWORK_SIMILARITY
        ? "similar_framework_requires_attention"
        : "distinct";
  return {
    leftSlotId: left.slotId,
    rightSlotId: right.slotId,
    leftConditionId: left.conditionId,
    rightConditionId: right.conditionId,
    classification,
    exactOrTransformedDuplicate,
    sharedGenericConstructionGrammar,
    semanticRouteTopologyDuplicate,
    semanticWaterNetworkTypeDuplicate,
    waterVisualTrainingMotifDuplicate,
    semanticCompleteSkeletonDuplicate,
    leftSemanticTopologySignature: leftSemantic,
    rightSemanticTopologySignature: rightSemantic,
    leftConstructionGrammarIdentity:
      left.constructionGrammarIdentity,
    rightConstructionGrammarIdentity:
      right.constructionGrammarIdentity,
    maximumRouteSimilarity,
    maximumCompositionSimilarity,
    maximumCompleteFrameworkSimilarity,
    bestSameTransform,
  };
}

function buildConstructionGrammarPayload(geometry) {
  const terrainKindProfiles = new Map();
  for (const region of geometry.terrainRegions ?? []) {
    const vertices = Array.isArray(region.polygon)
      ? region.polygon.length
      : 0;
    const profile = terrainKindProfiles.get(region.kind) ?? {
      count: 0,
      polygonVertexCounts: [],
    };
    profile.count += 1;
    profile.polygonVertexCounts.push(vertices);
    terrainKindProfiles.set(region.kind, profile);
  }
  const normalizedTerrainKinds = Object.fromEntries(
    [...terrainKindProfiles.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([kind, profile]) => [
        kind,
        {
          count: profile.count,
          polygonVertexCounts: profile.polygonVertexCounts.sort(
            (left, right) => left - right,
          ),
        },
      ]),
  );
  const objectSources = [
    ...new Set(
      (geometry.objectFootprints ?? []).map(
        (entry) => entry.source ?? "missing",
      ),
    ),
  ].sort();
  return {
    schemaVersion: "complete-map-construction-grammar-signature-v1",
    compositionArchitecturePresent: Boolean(
      geometry.compositionArchitecture,
    ),
    terrainKinds: normalizedTerrainKinds,
    ecologicalZoneCount: (geometry.ecologicalZones ?? []).length,
    polygonalEcologicalZoneCount: (
      geometry.ecologicalZones ?? []
    ).filter(
      (entry) =>
        Array.isArray(entry.polygon) && entry.polygon.length >= 3,
    ).length,
    objectPlacementZoneCount:
      geometry.compositionArchitecture?.objectPlacementZones?.length ?? 0,
    objectSources,
    compositionZonedObjectRatio: round(
      (geometry.objectFootprints ?? []).length === 0
        ? 0
        : (geometry.objectFootprints ?? []).filter(
              (entry) => entry.compositionZoneId,
            ).length / (geometry.objectFootprints ?? []).length,
    ),
    exactCoordinatesIncluded: false,
  };
}

function compactPair(entry, currentSlotId) {
  if (!entry) return null;
  return {
    otherSlotId:
      entry.leftSlotId === currentSlotId
        ? entry.rightSlotId
        : entry.leftSlotId,
    classification: entry.classification,
    maximumRouteSimilarity: entry.maximumRouteSimilarity,
    maximumCompositionSimilarity:
      entry.maximumCompositionSimilarity,
    maximumCompleteFrameworkSimilarity:
      entry.maximumCompleteFrameworkSimilarity,
    bestTransform: entry.bestSameTransform.transform,
    semanticRouteTopologyDuplicate:
      entry.semanticRouteTopologyDuplicate,
    semanticWaterNetworkTypeDuplicate:
      entry.semanticWaterNetworkTypeDuplicate,
    semanticCompleteSkeletonDuplicate:
      entry.semanticCompleteSkeletonDuplicate,
  };
}

function transformMask(source, transform) {
  const output = new Uint8Array(source.length);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const sourceX =
        transform === "horizontal_mirror" || transform === "rotate_180"
          ? WIDTH - 1 - x
          : x;
      const sourceY =
        transform === "vertical_mirror" || transform === "rotate_180"
          ? HEIGHT - 1 - y
          : y;
      output[y * WIDTH + x] = source[sourceY * WIDTH + sourceX];
    }
  }
  return output;
}

function binaryIoU(left, right) {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] || right[index]) union += 1;
    if (left[index] && right[index]) intersection += 1;
  }
  return round(union === 0 ? 0 : intersection / union);
}

function taggedIoU(leftMasks, rightMasks, channelIds) {
  let intersection = 0;
  let union = 0;
  for (const channelId of channelIds) {
    const left = leftMasks[channelId];
    const right = rightMasks[channelId];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] || right[index]) union += 1;
      if (left[index] && right[index]) intersection += 1;
    }
  }
  return round(union === 0 ? 0 : intersection / union);
}

function equalityRatio(left, right) {
  let equal = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] === right[index]) equal += 1;
  }
  return round(equal / left.length);
}

function nonZeroCompositeIoU(left, right) {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftActive = left[index] > 0;
    const rightActive = right[index] > 0;
    if (leftActive || rightActive) union += 1;
    if (leftActive && rightActive) intersection += 1;
  }
  return round(union === 0 ? 0 : intersection / union);
}

function readJson(value) {
  return JSON.parse(fs.readFileSync(resolveProjectPath(value), "utf8"));
}

function resolveProjectPath(value) {
  const resolved = path.resolve(ROOT, value);
  assert(
    resolved === ROOT || resolved.startsWith(`${ROOT}${path.sep}`),
    `path escapes project: ${value}`,
  );
  assert(fs.existsSync(resolved), `file is missing: ${value}`);
  return resolved;
}

function projectPath(value) {
  return path.relative(ROOT, path.resolve(value)).replace(/\\/g, "/");
}

function sha256File(value) {
  return sha256(fs.readFileSync(resolveProjectPath(value)));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalSha256(value) {
  return sha256(Buffer.from(JSON.stringify(sortValue(value))));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

function round(value) {
  return Number(Number(value).toFixed(6));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
