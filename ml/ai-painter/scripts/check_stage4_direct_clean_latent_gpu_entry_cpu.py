from __future__ import annotations

from copy import deepcopy
import inspect
import json
from pathlib import Path
import sys

import torch

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[2]
SRC = ROOT / "ml" / "ai-painter" / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from ai_painter.complete_world import build_complete_world_system
from ai_painter_direct_clean_latent_contract import compile_direct_clean_latent_cpu_inactive_config
import run_stage4_direct_clean_latent_readonly_gpu_qualification as runner


SOURCE_CONFIG = ROOT / ".runtime" / "ai-painter" / "stage4-post-decode-full-condition-responsibility-formal-stage0" / "stage4-post-decode-full-condition-responsibility-stage0-2026082603" / "active-config.json"


def main() -> int:
    source = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    config = compile_direct_clean_latent_cpu_inactive_config(source)
    positive = []
    negative = []

    def pos(name, value):
        positive.append({"name": name, "passed": bool(value)})

    def reject(name, callback):
        passed = False
        try:
            callback()
        except (ValueError, KeyError, TypeError):
            passed = True
        negative.append({"name": name, "passed": passed})

    ticket = {
        "schemaVersion": "ai-painter-local-internal-readonly-gpu-ticket-v1",
        "status": "issued_not_consumed",
        "authority": "local_ai_pet_world_program",
        "capabilityVersion": runner.CAPABILITY_VERSION,
        "taskId": runner.TASK_ID,
        "oneTimeConsumption": True,
        "gpuUse": True,
        "permissions": {
            "projectAutoencoderCheckpointRead": True,
            "denoiserCheckpointRead": False,
            "optimizerCreation": False,
            "backwardExecution": False,
            "weightMutation": False,
            "checkpointWrite": False,
            "smoke": False,
            "training": False,
        },
        "executionIdentity": {
            "seed": runner.SEED,
            "imageSize": {"width": 256, "height": 192},
            "sampleId": runner.SAMPLE_ID,
            "split": "validation",
            "conditionChannels": 23,
            "latentChannels": 12,
        },
    }
    runner.validate_ticket_shape(ticket)
    pos("local_internal_ticket_valid", True)
    pos("owner_not_in_ticket", "owner" not in json.dumps(ticket).lower())
    torch.manual_seed(runner.SEED)
    model = build_complete_world_system(config)
    pos("direct_public_signature", tuple(inspect.signature(model.predict_clean_latent).parameters) == ("conditions",))
    pos("autoencoder_frozen", not any(parameter.requires_grad for parameter in model.autoencoder.parameters()))
    conditions = torch.rand(1, 23, 192, 256, requires_grad=True)
    output = model.predict_clean_latent(conditions)
    decoded = model.decode_clean_latent(output)
    gradients = torch.autograd.grad(output.square().mean() + decoded.abs().mean(), (conditions, *tuple(model.denoiser.parameters())), allow_unused=True)
    pos("cpu_output_shapes", list(output.shape) == [1, 12, 48, 64] and list(decoded.shape) == [1, 3, 192, 256])
    pos("all_cpu_gradients_finite_nonzero", all(runner.finite_nonzero(value) for value in gradients))
    pos("no_parameter_grad_fields", all(parameter.grad is None for parameter in model.parameters()))
    source_text = Path(runner.__file__).read_text(encoding="utf-8")
    pos("runner_uses_real_cuda_and_autograd_grad", "torch.cuda.init()" in source_text and "torch.autograd.grad(" in source_text)
    pos("runner_loads_fixed_validation_sample", "AiAssistedConditionalDenoiserDataset" in source_text and runner.SAMPLE_ID in source_text)
    pos("formal_capacity_selection_contract", runner.trainer.conditional_dataset_selection_contract(config) == "registered_v7_capacity_contribution_v1")
    formal_sample = runner.load_sample(config)
    pos("formal_validation_eight_and_sample194_loaded", formal_sample["sampleId"] == runner.SAMPLE_ID)
    pos("runner_reads_only_project_autoencoder", "load_autoencoder_checkpoint" in source_text and "denoiserCheckpointRead" in source_text)
    pos("runner_has_no_optimizer_backward_or_checkpoint_write", "torch.optim" not in source_text and ".backward(" not in source_text and "torch.save(" not in source_text)
    pos("runner_checks_model_state_unchanged", "model_state_changed_during_readonly_gpu_qualification" in source_text)

    for name, mutate in (
        ("wrong_authority_rejected", lambda value: value.__setitem__("authority", "owner")),
        ("wrong_task_rejected", lambda value: value.__setitem__("taskId", "old_smoke")),
        ("wrong_seed_rejected", lambda value: value["executionIdentity"].__setitem__("seed", 1)),
        ("wrong_sample_rejected", lambda value: value["executionIdentity"].__setitem__("sampleId", "old")),
        ("denoiser_checkpoint_rejected", lambda value: value["permissions"].__setitem__("denoiserCheckpointRead", True)),
        ("optimizer_rejected", lambda value: value["permissions"].__setitem__("optimizerCreation", True)),
        ("backward_rejected", lambda value: value["permissions"].__setitem__("backwardExecution", True)),
        ("training_rejected", lambda value: value["permissions"].__setitem__("training", True)),
    ):
        invalid = deepcopy(ticket)
        mutate(invalid)
        reject(name, lambda invalid=invalid: runner.validate_ticket_shape(invalid))
    reject("absolute_path_rejected", lambda: runner.resolve(ROOT / ".runtime" / "x"))
    reject("parent_escape_rejected", lambda: runner.resolve(Path(".runtime/../../outside")))

    passed = all(row["passed"] for row in positive + negative)
    report = {
        "schemaVersion": "stage4-direct-clean-latent-readonly-gpu-entry-cpu-report-v1",
        "status": "passed" if passed else "failed",
        "positive": {"passed": sum(row["passed"] for row in positive), "total": len(positive), "cases": positive},
        "negative": {"passed": sum(row["passed"] for row in negative), "total": len(negative), "cases": negative},
        "safety": {"checkpointRead": False, "cudaInitialized": False, "gpuStarted": False, "optimizerCreated": False, "backwardExecuted": False, "trainingStarted": False},
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
