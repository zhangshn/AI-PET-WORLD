from __future__ import annotations

import argparse
import json
from pathlib import Path

from ai_painter.complete_world.mvp_dataset_release import materialize_release


def binding(path: str, sha256: str) -> dict:
    return {"path": path, "sha256": sha256}


def main() -> None:
    parser = argparse.ArgumentParser(description="Materialize the immutable Stage4 MVP64 fresh-lineage dataset release")
    for name in ("candidate", "source-pairing", "semantic-rights", "historical-exposure",
                 "source-isolation-contract", "data-policy"):
        parser.add_argument("--" + name, required=True)
        parser.add_argument("--" + name + "-sha256", required=True)
    args = parser.parse_args()
    values = vars(args)
    result = materialize_release(
        Path.cwd(),
        candidate_binding=binding(values["candidate"], values["candidate_sha256"]),
        source_pairing_binding=binding(values["source_pairing"], values["source_pairing_sha256"]),
        semantic_rights_binding=binding(values["semantic_rights"], values["semantic_rights_sha256"]),
        historical_exposure_binding=binding(values["historical_exposure"], values["historical_exposure_sha256"]),
        source_isolation_contract_binding=binding(values["source_isolation_contract"], values["source_isolation_contract_sha256"]),
        data_policy_binding=binding(values["data_policy"], values["data_policy_sha256"]),
    )
    print(json.dumps({
        "status": "dataset_release_materialized_foundation_and_execution_qualification_pending",
        "manifest": result,
        "trainingAllowed": False,
        "gpuStarted": False,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
