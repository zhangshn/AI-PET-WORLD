from __future__ import annotations

from argparse import ArgumentParser
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image


def main() -> int:
    parser = ArgumentParser(description="Compare project AI-assisted autoencoder reconstruction evidence with common metrics.")
    parser.add_argument("--baseline-manifest", type=Path, required=True)
    parser.add_argument("--candidate-manifest", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    baseline = read_json(args.baseline_manifest)
    candidate = read_json(args.candidate_manifest)
    validate_manifest(baseline, "baseline")
    validate_manifest(candidate, "candidate")
    if baseline["resolutionStage"] != {"width": 1024, "height": 768}:
        raise ValueError("baseline must be the native 1024x768 stage")
    if candidate["resolutionStage"] != {"width": 1024, "height": 768}:
        raise ValueError("candidate must be the native 1024x768 stage")
    if baseline["datasetPackageId"] == candidate["datasetPackageId"]:
        raise ValueError("version comparison expects separately versioned immutable data packages")

    args.output_dir.mkdir(parents=True, exist_ok=False)
    baseline_rows = evidence_by_identity(baseline)
    candidate_rows = evidence_by_identity(candidate)
    if baseline_rows.keys() != candidate_rows.keys():
        raise ValueError("baseline and candidate evidence identities do not match")

    rows = []
    for identity in sorted(baseline_rows):
        baseline_evidence = baseline_rows[identity]
        candidate_evidence = candidate_rows[identity]
        baseline_original, baseline_reconstruction = read_comparison(baseline_evidence)
        candidate_original, candidate_reconstruction = read_comparison(candidate_evidence)
        if not np.array_equal(baseline_original, candidate_original):
            raise ValueError(f"original image mismatch across versions: {identity}")
        baseline_metrics = calculate_metrics(baseline_original, baseline_reconstruction)
        candidate_metrics = calculate_metrics(candidate_original, candidate_reconstruction)
        rows.append({
            "split": identity[0],
            "sampleId": identity[1],
            "baselineEvidencePath": baseline_evidence["imagePath"],
            "candidateEvidencePath": candidate_evidence["imagePath"],
            "baseline": baseline_metrics,
            "candidate": candidate_metrics,
            "improvement": improvement(baseline_metrics, candidate_metrics),
        })

    baseline_average = average_metrics([row["baseline"] for row in rows])
    candidate_average = average_metrics([row["candidate"] for row in rows])
    average_improvement = improvement(baseline_average, candidate_average)
    improved = (
        candidate_average["rgbMae"] < baseline_average["rgbMae"]
        and candidate_average["edgeMae"] < baseline_average["edgeMae"]
        and candidate_average["laplacianMae"] < baseline_average["laplacianMae"]
        and candidate_average["psnrDb"] > baseline_average["psnrDb"]
    )
    created_at = utc_now()
    report = {
        "schemaVersion": "ai-assisted-autoencoder-version-comparison-v1",
        "status": "v2_reconstruction_improved_owner_review_required" if improved else "v2_reconstruction_not_improved",
        "createdAtUtc": created_at,
        "createdAtAsiaShanghai": shanghai_now(),
        "baseline": manifest_identity(args.baseline_manifest, baseline),
        "candidate": manifest_identity(args.candidate_manifest, candidate),
        "sampleCount": len(rows),
        "commonMetrics": ["rgbMae", "edgeMae", "laplacianMae", "psnrDb"],
        "baselineAverage": baseline_average,
        "candidateAverage": candidate_average,
        "averageImprovement": average_improvement,
        "candidateImprovedAllAverageMetrics": improved,
        "visualOwnerReviewRequired": True,
        "formalInferenceEligible": False,
        "rows": rows,
        "automaticStorage": True,
    }
    report_path = args.output_dir / "comparison.json"
    write_json(report_path, report)
    print(json.dumps({**report, "reportPath": project_path(report_path)}, ensure_ascii=False, indent=2))
    return 0 if improved else 2


def validate_manifest(manifest, label):
    if manifest.get("ownership") != "project_owned_architecture_ai_assisted_cold_start_weights":
        raise ValueError(f"{label} ownership is invalid")
    if manifest.get("thirdPartyWeightsLoaded") is not False:
        raise ValueError(f"{label} loaded third-party weights")
    if manifest.get("formalInferenceEligible") is not False or manifest.get("denoiserTrained") is not False:
        raise ValueError(f"{label} must be an autoencoder-only non-formal checkpoint")
    if not file_hash_matches(manifest.get("checkpointPath"), manifest.get("checkpointSha256")):
        raise ValueError(f"{label} checkpoint hash mismatch")
    for evidence in manifest.get("reconstructionEvidence", []):
        if not file_hash_matches(evidence.get("imagePath"), evidence.get("imageSha256")):
            raise ValueError(f"{label} reconstruction evidence hash mismatch")


def evidence_by_identity(manifest):
    rows = {}
    for evidence in manifest.get("reconstructionEvidence", []):
        identity = (evidence["split"], evidence["sampleId"])
        if identity in rows:
            raise ValueError(f"duplicate reconstruction identity: {identity}")
        rows[identity] = evidence
    if not rows:
        raise ValueError("reconstruction evidence is empty")
    return rows


def read_comparison(evidence):
    with Image.open(project_file(evidence["imagePath"])) as image:
        value = np.asarray(image.convert("RGB"), dtype=np.uint8)
    if value.shape[1] % 2 != 0:
        raise ValueError(f"comparison width is not even: {evidence['imagePath']}")
    midpoint = value.shape[1] // 2
    return value[:, :midpoint], value[:, midpoint:]


def calculate_metrics(original, reconstruction):
    left = original.astype(np.float32) / 255.0
    right = reconstruction.astype(np.float32) / 255.0
    difference = left - right
    mse = float(np.mean(np.square(difference)))
    return {
        "rgbMae": float(np.mean(np.abs(difference))),
        "edgeMae": float((edge_mae(left, right))),
        "laplacianMae": float(laplacian_mae(left, right)),
        "psnrDb": float(99.0 if mse == 0.0 else 10.0 * math.log10(1.0 / mse)),
    }


def edge_mae(left, right):
    horizontal = np.mean(np.abs(np.diff(left, axis=1) - np.diff(right, axis=1)))
    vertical = np.mean(np.abs(np.diff(left, axis=0) - np.diff(right, axis=0)))
    return horizontal + vertical


def laplacian_mae(left, right):
    return np.mean(np.abs(laplacian(left) - laplacian(right)))


def laplacian(value):
    padded = np.pad(value, ((1, 1), (1, 1), (0, 0)), mode="edge")
    return (
        padded[1:-1, 1:-1] * 4.0
        - padded[:-2, 1:-1]
        - padded[2:, 1:-1]
        - padded[1:-1, :-2]
        - padded[1:-1, 2:]
    )


def average_metrics(rows):
    return {key: float(np.mean([row[key] for row in rows])) for key in rows[0]}


def improvement(baseline, candidate):
    return {
        "rgbMaeReductionPercent": percent_reduction(baseline["rgbMae"], candidate["rgbMae"]),
        "edgeMaeReductionPercent": percent_reduction(baseline["edgeMae"], candidate["edgeMae"]),
        "laplacianMaeReductionPercent": percent_reduction(baseline["laplacianMae"], candidate["laplacianMae"]),
        "psnrGainDb": candidate["psnrDb"] - baseline["psnrDb"],
    }


def percent_reduction(baseline, candidate):
    return 0.0 if baseline == 0.0 else (baseline - candidate) / baseline * 100.0


def manifest_identity(path, manifest):
    return {
        "modelId": manifest["modelId"],
        "architectureVersion": manifest.get("architectureVersion"),
        "manifestPath": project_path(path),
        "manifestSha256": sha256_file(path),
        "checkpointPath": manifest["checkpointPath"],
        "checkpointSha256": manifest["checkpointSha256"],
    }


def file_hash_matches(path, expected):
    return bool(path and expected and project_file(path).exists() and sha256_file(project_file(path)) == expected)


def project_file(path):
    root = Path.cwd().resolve()
    resolved = Path(path).resolve()
    if root != resolved and root not in resolved.parents:
        raise ValueError(f"path escapes project root: {path}")
    return resolved


def project_path(path):
    return Path(path).resolve().relative_to(Path.cwd().resolve()).as_posix()


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def shanghai_now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")


if __name__ == "__main__":
    raise SystemExit(main())
