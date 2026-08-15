from __future__ import annotations

from argparse import ArgumentParser
from copy import deepcopy
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve(path: Path) -> Path:
    return path.resolve() if path.is_absolute() else (ROOT / path).resolve()


def project_path(path: Path) -> str:
    resolved = resolve(path)
    runtime = (ROOT / ".runtime").resolve()
    if resolved == runtime or runtime in resolved.parents:
        return (Path(".runtime") / resolved.relative_to(runtime)).as_posix()
    return resolved.relative_to(ROOT).as_posix()


def binding(path: Path) -> dict:
    absolute = resolve(path)
    if not absolute.is_file():
        raise ValueError(f"authorization binding source missing: {path}")
    return {"path": project_path(absolute), "sha256": sha256_file(absolute)}


def main() -> int:
    parser = ArgumentParser()
    parser.add_argument("--template", type=Path, required=True)
    parser.add_argument("--request-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--execution-root", type=Path, required=True)
    parser.add_argument("--cpu-report", type=Path, required=True)
    parser.add_argument("--implementation-attestation", type=Path, required=True)
    args = parser.parse_args()
    if not args.request_id.startswith(
        "owner-authorized-stage4-fact-conditioned-semantic-mixture-30-epoch-model-smoke-"
    ):
        raise ValueError("Smoke requestId format is invalid")
    output = resolve(args.output)
    execution_root = resolve(args.execution_root)
    if output.exists() or execution_root.exists():
        raise ValueError("new Smoke authorization and execution identities must not exist")
    value = deepcopy(json.loads(resolve(args.template).read_text(encoding="utf-8")))
    value["requestId"] = args.request_id
    value["commandRef"] = args.request_id
    value["bindings"]["cpuReport"] = binding(args.cpu_report)
    value["bindings"]["implementationAttestation"] = binding(
        args.implementation_attestation
    )
    for key, current in value["codeBindings"].items():
        value["codeBindings"][key] = binding(Path(current["path"]))
    logical_root = project_path(execution_root)
    value["execution"] = {
        "consumptionPath": f"{logical_root}/execution-consumption.json",
        "activeConfigPath": f"{logical_root}/active-config.json",
        "trainingOutputDirectory": f"{logical_root}/training-output",
        "finalizationDirectory": f"{logical_root}/finalization",
        "preflightReportPath": f"{logical_root}/preflight-report.json",
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps({"status": "smoke_authorization_prepared_unconsumed",
                      "authorization": binding(output)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
