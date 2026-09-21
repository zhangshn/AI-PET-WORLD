"""CPU-only fixed-mask RGB attribution on current frozen sampling results.

Replacing a proposal with base RGB is a diagnostic counterfactual, never a
deployable bypass. Overlap weights are retained; MAE effects are not additive.
"""
from __future__ import annotations
import argparse
import io
import json
import os
from pathlib import Path
import time

import painter_timestep_ab_experiment as trial
import compare_decoder_adapted_sampling as sampling
from painter_learning_capacity_experiment import bound_json, exact_inference_runtime, read_bound, require
from diagnose_learning_capacity_layers import region_metrics
from diagnose_learning_capacity_timesteps import rgb_diagnostics

STEPS = (50, 10)
HEADS = trial.previous.HEADS
METRICS = sampling.METRICS
LIMITS = {"wallSeconds": 420, "cpuThreads": 4, "optimizerSteps": 0,
          "fixedSeedRollouts": 24, "automaticRetries": 0, "maxOutputMiB": 8}


def compact_metrics(torch, rgb, target):
    from train_ai_assisted_complete_world import image_edge_loss
    values = rgb_diagnostics(torch, rgb, target)
    values["edgeMae"] = float(image_edge_loss(rgb, target))
    return {k: values[k] for k in METRICS}


def attribute(torch, final, evidence, target):
    base = evidence["baseDecodedRgb"]
    masks, proposals = evidence["responsibilityMasks"], evidence["responsibilityRgbProposals"]
    ids = evidence["responsibilityIdentityOrder"]
    require(len(ids) == len(set(ids)) == len(masks) == len(proposals), "invalid identity matrix")
    require(base.shape == final.shape == target.shape and base.shape[:2] == (1, 3), "RGB shape mismatch")
    require(all(x.device.type == "cpu" and bool(torch.isfinite(x).all()) for x in (base, final, target, *masks, *proposals)), "finite CPU tensors required")
    require(all(m.shape == (1, 1, *base.shape[-2:]) and bool(((m >= 0) & (m <= 1)).all()) for m in masks), "invalid mask")
    require(all(p.shape == base.shape for p in proposals), "invalid proposal shape")
    active = [name for name, mask in zip(ids, masks) if bool(mask.any())]
    require(active == list(HEADS), "active responsibility scope changed")
    total = torch.stack(masks).sum(0)
    coverage = total.clamp(0, 1)
    denominator = total.clamp_min(torch.finfo(base.dtype).eps)

    def compose(values):
        return base * (1 - coverage) + torch.stack([p*m for p,m in zip(values,masks)]).sum(0) / denominator * coverage

    require(torch.equal(compose(proposals), final), "production compositor equation mismatch")
    covered = (coverage > 0).float()
    require(torch.equal(final*(1-covered), base*(1-covered)), "uncovered RGB changed")
    # 3x3 covered-side boundary; exterior image padding counts as uncovered.
    padded = torch.nn.functional.pad(covered, (1, 1, 1, 1), value=0)
    interior = 1 - torch.nn.functional.max_pool2d(1-padded, 3, 1)
    boundary = covered - interior
    count = torch.stack([(m > 0).float() for m in masks]).sum(0)
    partitions = {"uncovered": 1-covered, "coveredInterior": interior, "coveredBoundary": boundary}
    require(torch.equal(sum(partitions.values()), torch.ones_like(covered)), "region partition invalid")
    partitions["overlap"] = (count > 1).float()
    partitions["singleResponsibility"] = (count == 1).float()
    regions = {name: {"base": region_metrics(torch, base.double(), target.double(), mask.double()),
                      "final": region_metrics(torch, final.double(), target.double(), mask.double())}
               for name,mask in partitions.items()}
    # Symmetric quadratic attribution splits interaction terms equally. It is
    # signed accounting, not an assertion that a head independently causes loss.
    base64, final64, target64 = base.double(), final.double(), target.double()
    heads, deltas = {}, []
    for index, (name, mask, proposal) in enumerate(zip(ids, masks, proposals)):
        if name not in HEADS:
            continue
        delta = (coverage.double()*mask.double()/total.double().clamp_min(torch.finfo(base.dtype).eps))*(proposal.double()-base64)
        deltas.append(delta)
        replacements = list(proposals)
        replacements[index] = base
        counterfactual = compose(replacements)
        require(torch.equal(counterfactual*(mask == 0), final*(mask == 0)), "counterfactual escaped head support")
        heads[name] = {
            "proposal": region_metrics(torch, proposal.double(), target64, mask.double()),
            "base": region_metrics(torch, base64, target64, mask.double()),
            "final": region_metrics(torch, final64, target64, mask.double()),
            "exclusivePixelWeight": float((mask*(count == 1)).sum()),
            "overlapPixelWeight": float((mask*(count > 1)).sum()),
            "replaceWithBase": compact_metrics(torch, counterfactual, target),
            "symmetricMseChangeContribution": float(((final64+base64-2*target64)*delta).mean()),
        }
    reconstruction_error = float((base64+sum(deltas)-final64).abs().max())
    mse_change = float(((final64-target64).square()-(base64-target64).square()).mean())
    credit_error = abs(sum(h["symmetricMseChangeContribution"] for h in heads.values())-mse_change)
    require(reconstruction_error < 2e-7 and credit_error < 1e-8, "signed composition accounting invalid")
    rgb_change = float(((final64-target64).abs()-(base64-target64).abs()).sum())
    partition_change = sum(regions[k]["final"]["absoluteRgbErrorSum"]-regions[k]["base"]["absoluteRgbErrorSum"]
                           for k in ("uncovered", "coveredInterior", "coveredBoundary"))
    require(abs(rgb_change-partition_change) < 1e-8, "RGB partition does not telescope")
    return {"base": compact_metrics(torch, base, target), "final": compact_metrics(torch, final, target),
        "heads": heads, "regions": regions, "compositorEquationExact": True, "outsideChangeMax": 0,
        "additiveRgbMaxError": reconstruction_error, "mseChange": mse_change, "mseAccountingError": credit_error,
        "absoluteRgbErrorSumChange": rgb_change, "partitionError": abs(rgb_change-partition_change),
        "counterfactualApplied": False, "semanticQualification": False}


def diagnose(root, request_binding):
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    from ai_painter.complete_world.split_training import state_hash
    require(os.environ.get("CUDA_VISIBLE_DEVICES") == "", "explicit CPU isolation required")
    request = bound_json(root, request_binding)
    require(request["schemaVersion"] == "ai-painter-rgb-composition-shadow-request-v1" and request["limits"] == LIMITS, "request boundary changed")
    require(request["mode"] == "cpu_rgb_composition_attribution_no_repair_or_training", "wrong mode")
    require(request["outputRoot"] == trial.previous.ROOT+"/"+request["identity"]
            and request["identity"].startswith("rgb-composition-shadow-")
            and request_binding["path"] == request["outputRoot"]+"/diagnostic-request.json", "namespace mismatch")
    torch.set_num_threads(4)
    started = time.monotonic()

    def check():
        require(not torch.cuda.is_initialized(), "CUDA initialized")
        require(time.monotonic()-started < 330, "CPU attribution timeout")

    for binding in request["inputReceipts"]: read_bound(root, binding)
    source = bound_json(root, request["sourceResult"])
    previous = bound_json(root, request["sourceSampling"])["replay"]
    package = trial.materialize(root)
    require(bound_json(root, request["sourcePackage"]) == package, "source package changed")
    require(previous["sourceResult"] == request["sourceResult"] and previous["sourcePackage"] == request["sourcePackage"], "sampling source changed")
    require(request["sourceResult"]["path"] == trial.previous.ROOT+"/"+package["experimentIdentity"]+"/result.json", "source namespace changed")
    expected_rows = [r for r in previous["rows"] if r["steps"] in STEPS]
    matrix = [(arm,sample,seed,steps) for arm in trial.ARMS for i,sample in enumerate(trial.previous.SAMPLES)
              for seed in trial.comparison.SETTINGS["seedsBySample"][i] for steps in STEPS]
    require([(r["arm"],r["sampleId"],r["seed"],r["steps"]) for r in expected_rows] == matrix, "sampling matrix changed")
    require([a["arm"] for a in source["arms"]] == list(trial.ARMS), "arm order changed")
    plan = bound_json(root, package["sourceComparisonPlan"])
    adaptation_result = bound_json(root, plan["adaptationResult"])
    rows, training_controls = [], []
    common_frozen = None
    for arm_index, arm in enumerate(source["arms"]):
        model, heads, normalization, adaptation = trial.comparison.load_frozen_pair(root, plan)
        model.denoiser.rgb_responsibility_heads = heads
        expected_heads = state_hash(heads.state_dict())
        cp = torch.load(io.BytesIO(read_bound(root, arm["checkpoint"])), map_location="cpu", weights_only=True)
        trial.validate_checkpoint(cp, package, arm["arm"])
        model.denoiser.load_state_dict(cp["denoiserState"], strict=True)
        model.eval().requires_grad_(False)
        require(state_hash(model.denoiser.state_dict()) == cp["denoiserStateSha256"], "Denoiser state mismatch")
        require(state_hash(heads.state_dict()) == expected_heads, "frozen heads mismatch")
        require(trial.frozen_hash(model) == cp["frozenStateSha256"] == arm["frozenStateSha256"], "frozen assets changed")
        frozen = state_hash((model.autoencoder.state_dict(), heads.state_dict(), normalization))
        require(common_frozen is None or common_frozen == frozen, "paired frozen assets differ")
        common_frozen = frozen
        before = state_hash((model.state_dict(), normalization))
        dataset = trial.previous.HeadDataset(root, adaptation)
        alpha = trainer.build_diffusion_schedule(package["config"], "cpu")["alphasCumulative"]
        with torch.inference_mode(), exact_inference_runtime(torch):
            for i, sample in enumerate(trial.previous.SAMPLES):
                item = dataset[i]
                target, conditions = item["image"][None], item["conditions"][None]
                input_hash = state_hash((target, conditions))
                if arm_index == 0:
                    # Reuse the two actual cached generated inputs on which the
                    # heads were fitted; no target encoding and no new rollout.
                    cached = torch.load(io.BytesIO(read_bound(root, adaptation["samplingTensors"][i])), map_location="cpu", weights_only=True)
                    require(cached["sampleId"] == sample and cached["targetUsedForInitialization"] is False, "cached training scope changed")
                    cached_plan = bound_json(root, adaptation["comparisonPlan"])
                    require(cached["comparisonIdentity"] == cached_plan["comparisonIdentity"]
                            and cached["seed"] == trial.previous.TRAINING["seed"]+3000+i, "cached training identity changed")
                    require(cached["conditionStateSha256"] == state_hash(conditions), "cached conditions changed")
                    raw = trainer.denormalize_latent(cached["normalizedGeneratedLatent"], normalization)
                    require(torch.equal(raw,cached["denormalizedGeneratedLatent"]), "cached normalization changed")
                    rgb, ev = trainer.decode_final_visible_rgb(model, raw, conditions, package["config"], return_stage4_semantic_responsibility_evidence=True)
                    measured = trial.comparison.measure(torch,rgb,ev,target,conditions,package["config"])
                    expected = adaptation_result["fullGeneratedRows"][i]
                    require(expected["sampleId"] == sample, "training control sample mismatch")
                    for section, values in expected["measurements"].items():
                        if isinstance(values,dict):
                            require(all(measured[section][k] == v for k,v in values.items()), "cached training metrics differ")
                        else: require(measured[section] == values, "cached training metrics differ")
                    png = next(b for b in adaptation_result["artifacts"] if b["path"].endswith(f"/generated-final-{i}.png"))
                    sampling.png_matches(root,png,rgb)
                    training_controls.append({"sampleId":sample,"split":"train","purpose":"actual_head_fit_input_replay_not_new_generation",
                        "sourceTensor":adaptation["samplingTensors"][i],"sourceImage":png,"baselineExact":True,"attribution":attribute(torch,rgb,ev,target)})
                for seed in trial.comparison.SETTINGS["seedsBySample"][i]:
                    for steps in STEPS:
                        check()
                        noise,latent,_,grid = sampling.rollout(torch,model.predict_velocity,conditions,alpha,seed,steps,check)
                        require(len(grid) == steps and grid[0][0] == 999 and grid[-1] == (0,-1), "incomplete endpoint")
                        rgb,ev = trainer.decode_final_visible_rgb(model,trainer.denormalize_latent(latent,normalization),conditions,package["config"],return_stage4_semantic_responsibility_evidence=True)
                        measured = trial.comparison.measure(torch,rgb,ev,target,conditions,package["config"])
                        expected = expected_rows[len(rows)]
                        require(measured == expected["measurements"] and state_hash(noise) == expected["noiseStateSha256"], "current sampling replay mismatch")
                        sampling.png_matches(root,expected["image"],rgb)
                        rows.append({"arm":arm["arm"],"sampleId":sample,"split":"train","seed":seed,"steps":steps,
                            "fullEndpoint":True,"targetUsedForInitialization":False,"baselineExact":True,"image":expected["image"],
                            "noiseStateSha256":state_hash(noise),"measurements":measured,"attribution":attribute(torch,rgb,ev,target)})
                require(state_hash((target,conditions)) == input_hash, "input tensors changed")
        require(state_hash((model.state_dict(),normalization)) == before, "model or normalization changed")
        del model,heads,cp,dataset
    for binding in [*request["inputReceipts"],request_binding]: read_bound(root,binding);check()
    return {"schemaVersion":"ai-painter-paired-rgb-composition-v1","status":"composition_attribution_completed_not_qualified",
        "sourceResult":request["sourceResult"],"sourceSampling":request["sourceSampling"],"sourcePackage":request["sourcePackage"],
        "rows":rows,"trainingControls":training_controls,"fixedSeedRollouts":24,"cachedTrainingInputReplays":2,
        "sourcePngPixelsReproduced":26,"inputBindingsReverified":len(request["inputReceipts"]),"imagesWritten":0,
        "cudaInitialized":torch.cuda.is_initialized(),"optimizerSteps":0,"checkpointsWritten":0,"modelAndNormalizationUnchanged":True,
        "elapsedSeconds":time.monotonic()-started,"limitations":[
            "Two already-seen train scenes; this is not generalization or semantic qualification.",
            "Fixed-mask base replacement is a counterfactual, not removal of a responsibility or a deployment candidate.",
            "Single-head MAE counterfactual effects cannot be summed in overlapping masks.",
            "Symmetric signed MSE accounting shares interactions; it is not a unique root-cause proof.",
            "No model, sampler, weight, data or runtime change is applied."]}


if __name__ == "__main__":
    p=argparse.ArgumentParser();p.add_argument("--request",required=True);p.add_argument("--request-sha256",required=True)
    a=p.parse_args()
    print(json.dumps(diagnose(Path.cwd(),{"path":a.request,"sha256":a.request_sha256}),allow_nan=False),flush=True)
