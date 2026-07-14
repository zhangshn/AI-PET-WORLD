from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parents[3]
POLICY_PATH = ROOT / "data" / "ai-painter" / "model-sources" / "local-visual-foundation-v1.json"
MANIFEST_PATH = ROOT / ".runtime" / "ai-painter" / "local-foundation-models" / "manifest.json"
ALLOW_PATTERNS = [
    "*.json",
    "*.txt",
    "*.model",
    "*.fp16.safetensors",
    "*.md",
    "LICENSE*",
    "**/*.json",
    "**/*.txt",
    "**/*.model",
    "**/*.fp16.safetensors",
]


def main() -> int:
    policy = read_json(POLICY_PATH)
    if policy.get("onlineInferenceApiAllowed") is not False or policy.get("localExecutionRequired") is not True:
        raise ValueError("local visual foundation policy boundary is invalid")
    records = []
    for model in policy["models"]:
        local_path = ROOT / model["localPath"]
        local_path.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            repo_id=model["repoId"],
            revision=model["revision"],
            local_dir=local_path,
            allow_patterns=model.get("allowPatterns", ALLOW_PATTERNS),
        )
        files = hash_tree(local_path)
        if not any(item["path"].endswith(".safetensors") for item in files):
            raise ValueError(f"model weights missing after download: {model['repoId']}")
        records.append({
            **model,
            "localPath": project_path(local_path),
            "fileCount": len(files),
            "totalBytes": sum(item["sizeBytes"] for item in files),
            "files": files,
        })
    manifest = {
        "schemaVersion": "ai-painter-local-visual-foundation-manifest-v1",
        "status": "local_visual_foundation_ready",
        "policyId": policy["policyId"],
        "policyPath": project_path(POLICY_PATH),
        "onlineInferenceApiUsed": False,
        "localFilesOnly": True,
        "models": records,
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": manifest["status"],
        "manifestPath": project_path(MANIFEST_PATH),
        "models": [{"repoId": row["repoId"], "revision": row["revision"], "fileCount": row["fileCount"], "totalBytes": row["totalBytes"]} for row in records],
    }, ensure_ascii=False, indent=2))
    return 0


def hash_tree(root: Path) -> list[dict[str, Any]]:
    rows = []
    for file_path in sorted(item for item in root.rglob("*") if item.is_file() and ".cache" not in item.parts):
        rows.append({"path": project_path(file_path), "sizeBytes": file_path.stat().st_size, "sha256": sha256_file(file_path)})
    return rows


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def project_path(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    raise SystemExit(main())
