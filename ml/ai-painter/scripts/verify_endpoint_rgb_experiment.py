"""Actual current-checkpoint CPU endpoint/gradient probe. No optimizer."""
from __future__ import annotations
import argparse
import io
import json
import os
from pathlib import Path
import time

import painter_timestep_ab_experiment as trial
from ai_painter.complete_world.endpoint_rgb_experiment import pure_noise_endpoint
from painter_learning_capacity_experiment import bound_json,exact_inference_runtime,read_bound,require
from compare_decoder_adapted_sampling import png_matches

LIMITS={"wallSeconds":300,"cpuThreads":4,"optimizerSteps":0,"fixedSeedRollouts":6,"automaticRetries":0,"maxOutputMiB":4}
ARM="legacy_global_schedule_control"


def verify(root,request_binding):
    import torch
    import train_ai_assisted_conditional_denoiser as trainer
    from ai_painter.complete_world.split_training import state_hash
    require(os.environ.get("CUDA_VISIBLE_DEVICES")=="","CPU isolation required")
    request=bound_json(root,request_binding)
    require(request["schemaVersion"]=="ai-painter-endpoint-gradient-shadow-request-v1"
            and request["mode"]=="cpu_endpoint_rgb_gradient_probe_no_optimizer"
            and request["limits"]==LIMITS and request["parentArm"]==ARM,"request scope changed")
    require(request["outputRoot"]==trial.previous.ROOT+"/"+request["identity"]
            and request["identity"].startswith("endpoint-gradient-shadow-")
            and request_binding["path"]==request["outputRoot"]+"/diagnostic-request.json","namespace mismatch")
    started=time.monotonic();torch.set_num_threads(4)

    def check():
        require(not torch.cuda.is_initialized(),"CUDA initialized")
        require(time.monotonic()-started<240,"endpoint CPU time budget")

    for binding in request["inputReceipts"]:read_bound(root,binding)
    source=bound_json(root,request["sourceResult"])
    sampled=bound_json(root,request["sourceSampling"])["replay"]
    package=trial.materialize(root)
    require(bound_json(root,request["sourcePackage"])==package,"source package changed")
    require(sampled["sourceResult"]==request["sourceResult"] and sampled["sourcePackage"]==request["sourcePackage"],"sampling identity mismatch")
    require(request["sourceResult"]["path"]==trial.previous.ROOT+"/"+package["experimentIdentity"]+"/result.json","training namespace mismatch")
    selected=[a for a in source["arms"] if a["arm"]==ARM];require(len(selected)==1,"parent checkpoint ambiguous")
    arm=selected[0]
    require(arm["checkpoint"]==request["parentCheckpoint"],"parent checkpoint changed")
    model,heads,normalization,adaptation=trial.comparison.load_frozen_pair(root,bound_json(root,package["sourceComparisonPlan"]))
    model.denoiser.rgb_responsibility_heads=heads
    expected_heads=state_hash(heads.state_dict())
    cp=torch.load(io.BytesIO(read_bound(root,arm["checkpoint"])),map_location="cpu",weights_only=True)
    trial.validate_checkpoint(cp,package,ARM);model.denoiser.load_state_dict(cp["denoiserState"],strict=True)
    require(state_hash(model.denoiser.state_dict())==cp["denoiserStateSha256"],"checkpoint state mismatch")
    require(state_hash(heads.state_dict())==expected_heads,"heads changed")
    require(trial.frozen_hash(model)==cp["frozenStateSha256"]==arm["frozenStateSha256"],"frozen assets changed")
    trial.trainable_parameters(model);model.eval()
    before=state_hash((model.state_dict(),normalization))
    dataset=trial.previous.HeadDataset(root,adaptation)
    alpha=trainer.build_diffusion_schedule(package["config"],"cpu")["alphasCumulative"]
    expected=[r for r in sampled["rows"] if r["arm"]==ARM and r["steps"]==10]
    require([(r["sampleId"],r["seed"]) for r in expected]==[(s,seed) for i,s in enumerate(trial.previous.SAMPLES)
            for seed in trial.comparison.SETTINGS["seedsBySample"][i]],"six-seed matrix changed")
    rows=[]
    for i,sample in enumerate(trial.previous.SAMPLES):
        item=dataset[i];require(item["sampleId"]==sample and item["split"]=="train","sample purpose changed")
        target,conditions=item["image"][None],item["conditions"][None]
        inputs_before=state_hash((target,conditions))
        for j,seed in enumerate(trial.comparison.SETTINGS["seedsBySample"][i]):
            check();model.zero_grad(set_to_none=True);backward=j==0
            with torch.set_grad_enabled(backward),exact_inference_runtime(torch):
                noise,latent=pure_noise_endpoint(model.predict_velocity,conditions,alpha,seed,activation_checkpointing=True,check=check)
                rgb,evidence=trainer.decode_final_visible_rgb(model,trainer.denormalize_latent(latent,normalization),conditions,
                    package["config"],return_stage4_semantic_responsibility_evidence=True)
                saved=expected[len(rows)]
                with torch.no_grad():
                    measured=trial.comparison.measure(torch,rgb,evidence,target,conditions,package["config"])
                    require(measured==saved["measurements"] and state_hash(noise)==saved["noiseStateSha256"],"current forward replay mismatch")
                    png_matches(root,saved["image"],rgb)
                objective,terms=trial.previous.rgb_objective(rgb,target,conditions,package["config"])
                require(bool(torch.isfinite(objective)),"nonfinite endpoint RGB objective")
                gradient=None
                if backward:
                    require(objective.requires_grad,"endpoint gradient detached")
                    objective.backward();reachable=trial.check_gradients(model)
                    require(all(p.grad is None for p in model.autoencoder.parameters()),"AE received parameter gradients")
                    require(all(p.grad is None for p in heads.parameters()),"RGB heads received parameter gradients")
                    gradient={"nonzeroParameterCount":len(reachable),"baseOutputReached":any(n.startswith("denoiser.base_output.") for n in reachable),
                        "gradientL2":float(sum(p.grad.double().square().sum() for p in model.parameters() if p.grad is not None).sqrt()),
                        "frozenAeGradientCount":0,"frozenHeadGradientCount":0,"activationCheckpointing":True,"optimizerCreated":False}
                rows.append({"arm":ARM,"sampleId":sample,"split":"train","seed":seed,"steps":10,"fullEndpoint":True,
                    "targetUsedForInitialization":False,"targetEncoded":False,"baselineExact":True,"image":saved["image"],
                    "noiseStateSha256":state_hash(noise),"measurements":measured,
                    "objective":float(objective.detach()),"objectiveTerms":{k:float(v.detach()) for k,v in terms.items()},"gradient":gradient})
            del latent,rgb,evidence,objective,terms
            model.zero_grad(set_to_none=True)
        require(state_hash((target,conditions))==inputs_before,"inputs changed")
    require(state_hash((model.state_dict(),normalization))==before,"model or normalization changed")
    for binding in [*request["inputReceipts"],request_binding]:read_bound(root,binding);check()
    weights={k:float(v) for k,v in package["config"]["training"]["denoiserLossWeights"].items() if k in trial.previous.RGB_KEYS}
    require(len(weights)==11,"existing RGB loss scope changed")
    return {"schemaVersion":"ai-painter-endpoint-rgb-gradient-probe-v1","status":"cpu_endpoint_gradient_verified_not_trained",
        "sourceResult":request["sourceResult"],"sourceSampling":request["sourceSampling"],"sourcePackage":request["sourcePackage"],
        "parentCheckpoint":request["parentCheckpoint"],"rows":rows,"rgbLossWeights":weights,"fixedSeedRollouts":6,
        "backwardProbes":2,"sourcePngPixelsReproduced":6,"inputBindingsReverified":len(request["inputReceipts"]),
        "modelStateSha256BeforeAndAfter":before,"modelAndNormalizationUnchanged":True,"imagesWritten":0,"checkpointsWritten":0,
        "optimizerSteps":0,"cudaInitialized":torch.cuda.is_initialized(),"elapsedSeconds":time.monotonic()-started,
        "limitations":["CPU gradient reachability is not GPU eligibility, learning improvement, generalization or visual approval.",
            "Only existing RGB-dependent loss terms are reused; this does not claim the full old training objective is unchanged.",
            "The endpoint path has no target input; targets enter only after full pure-noise sampling for metrics and loss.",
            "Current default inference, original training loop, model weights, heads, AE and data remain unchanged."]}


if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--request",required=True);p.add_argument("--request-sha256",required=True)
    a=p.parse_args();print(json.dumps(verify(Path.cwd(),{"path":a.request,"sha256":a.request_sha256}),allow_nan=False),flush=True)
