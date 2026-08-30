from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[3]
SCRIPT_DIR = ROOT / "ml" / "ai-painter" / "scripts"
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from ai_painter_spatial_affine_decoder_contract import (
    compile_spatial_affine_decoder_cpu_inactive_config,
    load_spatial_affine_formal_objective_contract,
)


class Stage4SpatialAffineTrainerPreflightTests(unittest.TestCase):
    def test_real_trainer_cpu_preflight_uses_inactive_config_before_ticket(self):
        test_root = ROOT / ".test-output"
        test_root.mkdir(parents=True, exist_ok=True)
        inactive = compile_spatial_affine_decoder_cpu_inactive_config(
            project_root=ROOT
        )
        formal = load_spatial_affine_formal_objective_contract(ROOT)
        with tempfile.TemporaryDirectory(
            prefix="spatial-affine-trainer-preflight-", dir=test_root
        ) as work_value:
            work = Path(work_value)
            config_path = work / "inactive-config.json"
            config_path.write_text(
                json.dumps(inactive, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            output_dir = work / "training-output"
            env = dict(os.environ)
            python_path = [
                str(ROOT / "ml" / "ai-painter" / "src"),
                str(SCRIPT_DIR),
            ]
            if env.get("PYTHONPATH"):
                python_path.append(env["PYTHONPATH"])
            env["PYTHONPATH"] = os.pathsep.join(python_path)
            completed = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT_DIR / "train_ai_assisted_conditional_denoiser.py"),
                    "--config",
                    str(config_path),
                    "--dataset-package",
                    str(ROOT / formal["data"]["datasetManifestPath"]),
                    "--autoencoder-checkpoint",
                    str(
                        ROOT
                        / formal["modelBoundary"]["autoencoderCheckpointPath"]
                    ),
                    "--output-dir",
                    str(output_dir),
                    "--resolution-stage",
                    "0",
                    "--preflight-only",
                    "--stage-control-dry-run",
                ],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            self.assertEqual(
                completed.returncode,
                0,
                msg=f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
            )
            self.assertFalse(output_dir.exists())
            self.assertIn("preflight", completed.stdout.lower())
            self.assertNotIn("owner", completed.stderr.lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
