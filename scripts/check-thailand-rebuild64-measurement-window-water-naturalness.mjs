import fs from "node:fs";
import path from "node:path";
import {
  COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
  buildMeasurementDerivedAnonymousAnabranch,
  buildMeasurementDerivedAnonymousMainChannel,
  buildMeasurementDerivedCoarseHydrologyProfile,
  buildMeasurementDerivedNetworkHalfWidths,
} from "./lib/measurement-derived-coarse-hydrology.mjs";
import { buildNaturalWaterHalfWidths } from "./lib/anonymous-water-naturalness.mjs";
import { buildMeasurementDrivenAnonymousLayoutProfile } from "./lib/measurement-driven-anonymous-topology.mjs";
import { buildIndependentTrainingRegionConnectivity } from "./lib/real-earth-region-governance.mjs";

const ROOT = process.cwd();
const candidateId = valueFor("--candidate-id");
const slotId = valueFor("--slot-id");
const compositionRevision = valueFor("--composition-revision");
assert(
  slotId === "v7-capacity-slot-190" || slotId === "v7-capacity-slot-194",
  "slot-id must be v7-capacity-slot-190 or v7-capacity-slot-194",
);
const pointer = readJson(
  ".runtime/ai-painter/earth-geospatial-v7-mvp-window-plans/latest.json",
);
const plan = readJson(pointer.runPath);
const candidates = readJson(plan.candidateWindowsPath);
const candidate = candidates.candidates.find(
  (entry) => entry.candidateId === candidateId,
);
assert(candidate, `candidate not found: ${candidateId}`);
const waterPointer = readJson(
  ".runtime/ai-painter/earth-geospatial-water-naturalness-profile-runs/latest.json",
);
const waterNaturalnessProfile = readJson(waterPointer.profilePath);
const currentManifest = currentConditionManifest(slotId);
const currentConnectivity = readJson(currentManifest.connectivityBlueprintPath);
const sourcePackage = readJson(currentManifest.realEarthRegionSourcePackagePath);
const assignment = {
  slotId,
  candidateId: candidate.candidateId,
  regionalLandscapeType: "wet-season-drainage-hollow",
  monsoonSeason: "wet_season",
  sourcePixelWindow: candidate.sourcePixelWindow,
  metrics: candidate.metrics,
  fingerprints: candidate.fingerprints,
};
const connectivity = buildIndependentTrainingRegionConnectivity({
  slotId,
  assignment,
  worldProfileId: currentConnectivity.worldProfileId,
  sourcePackage,
  width: 1024,
  height: 768,
  hasWater: true,
  anonymousCompositionArchitectureRevision: compositionRevision,
});
const waterPlan = connectivity.anonymousTrainingCoordinateProjection?.waterPlan;
const start = waterPlan?.start;
const end = waterPlan?.end;
assert(start && end, "candidate-specific watercourse constraints are missing");

try {
  const coarseHydrologyProfile =
    buildMeasurementDerivedCoarseHydrologyProfile({
      assignment,
      root: ROOT,
    });
  const corridorHalfWidths =
    buildMeasurementDerivedNetworkHalfWidths({
      pointCount: COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
      startHalfWidth: waterPlan.startHalfWidth,
      endHalfWidth: waterPlan.endHalfWidth,
      coarseHydrologyProfile,
    });
  const mainChannel = buildMeasurementDerivedAnonymousMainChannel({
    start,
    end,
    width: 1024,
    height: 768,
    coarseHydrologyProfile,
    waterNaturalnessProfile,
    corridorHalfWidths,
  });
  const layoutProfile = buildMeasurementDrivenAnonymousLayoutProfile({
    assignment,
    hasWater: true,
    coarseHydrologyProfile,
    routeSearchExpansionRevision: compositionRevision,
  });
  const branch = buildCandidateInternalHydrology({
    centerline: mainChannel.points,
    waterHalfWidths: corridorHalfWidths,
    waterNaturalnessProfile,
    internalHydrologyProfile: layoutProfile.internalHydrologyProfile,
    coarseHydrologyProfile,
  });
  console.log(
    JSON.stringify({
      candidateId,
      slotId,
      compositionRevision,
      passed: true,
      candidateWaterPlan: waterPlan,
      mainChannelBandCentroidX: verticalBandCentroidX(mainChannel.points),
      geometrySha256: mainChannel.geometrySha256,
      selection: mainChannel.selection,
      naturalnessAudit: mainChannel.naturalnessAudit,
      corridorShapeAudit: mainChannel.corridorShapeAudit,
      internalHydrology: {
        internalNetworkConnectionMode:
          layoutProfile.internalHydrologyProfile
            .internalNetworkConnectionMode,
        branchSide: layoutProfile.internalHydrologyProfile.branchSide,
        geometrySha256: branch.geometrySha256,
        naturalnessAudit: branch.naturalnessAudit,
        corridorShapeAudit: branch.corridorShapeAudit,
      },
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(
    JSON.stringify({
      candidateId,
      slotId,
      compositionRevision,
      passed: false,
      candidateWaterPlan: waterPlan,
      errorCode: message.includes(
        "water_sinuosity_below_public_reference_envelope",
      )
        ? "water_sinuosity_below_public_reference_envelope"
        : "unchanged_water_audit_failed",
      errorSummary: message.slice(0, 240),
    }),
  );
}

function buildCandidateInternalHydrology({
  centerline,
  waterHalfWidths,
  waterNaturalnessProfile,
  internalHydrologyProfile,
  coarseHydrologyProfile,
}) {
  const finalIndex = centerline.length - 1;
  const divergenceIndex = clamp(
    Math.round(finalIndex * internalHydrologyProfile.divergenceFraction),
    1,
    finalIndex - 2,
  );
  const rejoinIndex = clamp(
    Math.round(finalIndex * internalHydrologyProfile.rejoinFraction),
    divergenceIndex + 2,
    finalIndex - 1,
  );
  const branchRandom = mulberry32(
    Number.parseInt(internalHydrologyProfile.profileSha256.slice(0, 8), 16),
  );
  const branchStartHalfWidth = Math.max(
    22,
    Math.round(
      waterHalfWidths[divergenceIndex] *
        internalHydrologyProfile.branchWidthScale,
    ),
  );
  const branchEndHalfWidth = Math.max(
    branchStartHalfWidth,
    Math.round(
      waterHalfWidths[rejoinIndex] *
        internalHydrologyProfile.branchWidthScale,
    ),
  );
  const branchHalfWidths = buildNaturalWaterHalfWidths(
    COARSE_HYDROLOGY_CENTERLINE_POINT_COUNT,
    branchRandom,
    {
      startHalfWidth: branchStartHalfWidth,
      endHalfWidth: branchEndHalfWidth,
    },
  );
  const branchStart =
    internalHydrologyProfile.internalNetworkConnectionMode ===
    "interior_headwater_tributary_to_main_channel"
      ? {
          x:
            1024 *
            internalHydrologyProfile.tributaryHeadwaterXFraction,
          y: centerline[divergenceIndex].y,
        }
      : structuredClone(centerline[divergenceIndex]);
  return buildMeasurementDerivedAnonymousAnabranch({
    start: branchStart,
    end: structuredClone(centerline[rejoinIndex]),
    width: 1024,
    coarseHydrologyProfile,
    internalHydrologyProfile,
    waterNaturalnessProfile,
    corridorHalfWidths: branchHalfWidths,
  });
}

function mulberry32(seed) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function currentConditionManifest(targetSlotId) {
  const root = path.join(
    ROOT,
    ".runtime/ai-painter/earth-geospatial-v7-mvp-slot-condition-runs",
  );
  const manifests = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "complete-map-condition-run.json"))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => readJson(entry))
    .filter(
      (entry) =>
        entry.v7SlotId === targetSlotId &&
        entry.status === "complete_map_conditions_ready_rgb_authorization_required",
    )
    .sort((left, right) =>
      String(right.createdAtUtc).localeCompare(String(left.createdAtUtc)),
    );
  assert(manifests.length > 0, `condition manifest missing: ${targetSlotId}`);
  return manifests[0];
}

function verticalBandCentroidX(points) {
  return Array.from({ length: 8 }, (_, bandIndex) => {
    const selected = points.filter(
      (point) =>
        point.y >= bandIndex * 96 && point.y < (bandIndex + 1) * 96,
    );
    return selected.length === 0
      ? null
      : Number(
          (
            selected.reduce((total, point) => total + point.x, 0) /
            selected.length /
            1024
          ).toFixed(8),
        );
  });
}

function valueFor(flag) {
  const inline = process.argv.find((entry) => entry.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
