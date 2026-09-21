"""CPU-only attribution of existing train-image errors; never a visual gate.

Reuses six frozen generated latents. Target encoding is confined to a separately
labeled reconstruction control, never represented as pure-noise generation.
"""
from __future__ import annotations

from collections import deque
from copy import deepcopy
import io
import json
import os
from pathlib import Path
import subprocess
import time
import traceback

import compare_rgb_head_multiseed as comparison
from painter_learning_capacity_experiment import (
    bound_json, canonical_bytes, digest, exact_inference_runtime, file_binding,
    now, project_file, read_bound, require, save_json,
)
from diagnose_learning_capacity_timesteps import rgb_diagnostics

PROGRAM = "ml/ai-painter/scripts/diagnose_learning_capacity_layers.py"
TEST = "ml/ai-painter/tests/test_learning_capacity_layers.py"
SOURCE = {"path": ".runtime/ai-painter/learning-capacity-experiments/rgb-head-multiseed-b1a9f20fe0ef72ffbadaf6d1f88a967872fd958fdbc1ae5b61045a942f65695e/result.json",
          "sha256": "1897af22ee3aea5fcd2f74ab7178914fc1f3d7e0ac85e2d4b86bbadb01624597"}
SETTINGS = {"device": "cpu", "cpuThreads": 4, "maxWallSeconds": 90, "maxOutputMiB": 4,
    "samples": comparison.adapter.SAMPLES, "seeds": comparison.SETTINGS["seedsBySample"],
    "resolution": [256, 192], "newRollouts": 0, "optimizerSteps": 0,
    "reconstructionControl": "target_encoded_diagnostic_only_not_generation",
    "tileSize": 16, "topRoadErrorTiles": 5, "automaticRetries": 0, "formalQualificationAllowed": False}


def materialize(root):
    previous = bound_json(root, SOURCE)
    parent = bound_json(root, previous["plan"])
    require(previous["executionState"] == "completed" and previous["modelStatesUnchanged"] is True
            and previous["optimizerSteps"] == 0 and previous["formalQualificationAllowed"] is False, "frozen comparison required")
    require(parent == comparison.materialize(root, parent["adaptationResult"]), "parent comparison no longer reproduces")
    comparison.summarize(previous["rows"])
    package = bound_json(root, parent["adaptationPackage"])
    facts = []
    for row in package["selectedRows"]:
        pack = bound_json(root, row["conditionPack"])
        facts.append(file_binding(root, pack["sourceBindings"]["visualFactManifestPath"]))
    receipts = [*parent["inputReceipts"], SOURCE, previous["plan"], *previous["artifacts"], *facts,
        file_binding(root, PROGRAM), file_binding(root, TEST)]
    unique = {}
    for binding in receipts:
        read_bound(root, binding)
        require(binding["path"] not in unique or unique[binding["path"]]["sha256"] == binding["sha256"], "conflicting input")
        unique[binding["path"]] = binding
    payload = {"schemaVersion": "ai-painter-layer-diagnosis-plan-v1", "settings": deepcopy(SETTINGS),
        "sourceResult": SOURCE, "sourcePlan": previous["plan"], "factManifests": facts,
        "inputReceipts": list(unique.values()), "program": file_binding(root, PROGRAM), "testProgram": file_binding(root, TEST)}
    return {**payload, "comparisonIdentity": "layer-diagnosis-" + digest(canonical_bytes(payload))}


def mask_geometry(mask):
    import numpy as np
    value = np.asarray(mask)
    require(value.ndim == 2 and bool(np.isfinite(value).all()) and bool(np.isin(value, (0, 1)).all()), "binary 2D mask required")
    seen, groups = set(), []
    height, width = value.shape
    for y, x in zip(*value.nonzero()):
        if (y, x) in seen:
            continue
        queue, points = deque([(y, x)]), []
        seen.add((y, x))
        while queue:
            yy, xx = queue.popleft()
            points.append((int(yy), int(xx)))
            for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                ny, nx = yy + dy, xx + dx
                if 0 <= ny < height and 0 <= nx < width and value[ny, nx] and (ny, nx) not in seen:
                    seen.add((ny, nx))
                    queue.append((ny, nx))
        groups.append({"pixels": len(points), "bboxXYXYInclusive": [min(x for y,x in points), min(y for y,x in points),
            max(x for y,x in points), max(y for y,x in points)]})
    return {"pixels": len(seen), "connectedComponents4": sorted(groups, key=lambda v: (-v["pixels"], v["bboxXYXYInclusive"]))}


def region_metrics(torch, value, target, mask):
    require(value.shape == target.shape and mask.shape == (value.shape[0], 1, *value.shape[-2:]), "region shape mismatch")
    require(all(bool(torch.isfinite(x).all()) for x in (value, target, mask))
            and bool(((mask >= 0) & (mask <= 1)).all()), "invalid region tensors")
    count = float(mask.sum())
    error = value - target
    total = float((error.abs() * mask).sum())
    return {"pixelWeight": count, "absoluteRgbErrorSum": total, "rgbMae": total/(3*count) if count else None,
        "meanRgbBias": ((error*mask).sum((0,2,3))/count).tolist() if count else None}


def error_attribution(torch, final, evidence, target):
    masks = evidence["responsibilityMasks"]
    proposals = evidence["responsibilityRgbProposals"]
    ids = evidence["responsibilityIdentityOrder"]
    base = evidence["baseDecodedRgb"]
    require(len(ids) == len(masks) == len(proposals) and len(set(ids)) == len(ids), "invalid responsibility evidence")
    require(all(bool(torch.isfinite(m).all()) and bool(((m >= 0) & (m <= 1)).all()) for m in masks), "invalid masks")
    total_mask = torch.stack(masks).sum(0)
    coverage = total_mask.clamp(0,1)
    foreground = torch.stack([p*m for p,m in zip(proposals,masks)]).sum(0)/total_mask.clamp_min(torch.finfo(base.dtype).eps)
    reconstructed = base*(1-coverage)+foreground*coverage
    require(torch.equal(final, reconstructed), "compositor equation mismatch")
    outside = (coverage == 0).float()
    require(torch.equal(final*outside, base*outside), "uncovered RGB changed")
    road = masks[ids.index("terrain_path_ground")]
    objects = sum(m for k,m in zip(ids,masks) if k.startswith("object_"))
    regions = {name: {"base": region_metrics(torch,base,target,mask), "final": region_metrics(torch,final,target,mask)}
        for name,mask in (("all", torch.ones_like(road)), ("road",road), ("roadOnly",road*(objects==0)),
            ("roadObjectOverlap",road*(objects>0)), ("objects",objects.clamp(0,1)), ("uncovered",outside))}
    def lap(x):
        return 4*x[...,1:-1,1:-1]-x[...,:-2,1:-1]-x[...,2:,1:-1]-x[...,1:-1,:-2]-x[...,1:-1,2:]
    support_outside = 1-torch.nn.functional.max_pool2d((coverage>0).float(),3,1,1)[...,1:-1,1:-1]
    lap_error = (lap(final)-lap(target)).abs()
    rgb_total, lap_total = float((final-target).abs().sum()), float(lap_error.sum())
    head_rows = {name: {"proposal":region_metrics(torch,p,target,m), "base":region_metrics(torch,base,target,m),
                       "composite":region_metrics(torch,final,target,m)} for name,m,p in zip(ids,masks,proposals) if bool(m.any())}
    tiles=[]
    for y in range(0,target.shape[-2],16):
        for x in range(0,target.shape[-1],16):
            m=road[...,y:y+16,x:x+16]
            if not bool(m.any()):
                continue
            tiles.append({"bboxXYXYExclusive":[x,y,x+16,y+16],
                "base":region_metrics(torch,base[...,y:y+16,x:x+16],target[...,y:y+16,x:x+16],m),
                "final":region_metrics(torch,final[...,y:y+16,x:x+16],target[...,y:y+16,x:x+16],m),
                "targetMeanRgb":(target[...,y:y+16,x:x+16]*m).sum((0,2,3)).div(m.sum()).tolist()})
    return {"coverageFraction":float(coverage.mean()), "compositorEquationExact":True, "regions":regions,
        "uncoveredShareOfTotalAbsoluteRgbError":regions["uncovered"]["final"]["absoluteRgbErrorSum"]/rgb_total if rgb_total else None,
        "uncoveredSupportShareOfTotalLaplacianError":float((lap_error*support_outside).sum())/lap_total if lap_total else None,
        "headRegions":head_rows, "topRoadErrorTiles":sorted(tiles,key=lambda t:(-t["final"]["absoluteRgbErrorSum"],t["bboxXYXYExclusive"]))[:5]}


def registry(root, mode, directory):
    comparison.validate_terminal(json.loads(project_file(root,directory+("/cpu-tests.json" if mode=="begin" else "/result.json")).read_text(encoding="utf-8")))
    bridge=comparison.paired.REGISTRY_BRIDGE
    for old,new in (("cpu_paired_decoder_comparison","cpu_layer_error_attribution"),
                    ("cpu_decoder_comparison_","cpu_layer_error_attribution_"),
                    ("Compare two frozen decoders on identical train-only generated latents; no training or publication",
                     "Attribute existing train-only image errors to masks, base RGB and heads; CPU diagnosis only")):
        require(old in bridge,"registry display bridge changed")
        bridge=bridge.replace(old,new)
    value=subprocess.run(["node","--input-type=module","-e",bridge,mode,directory,str(os.getpid())],cwd=root,
        capture_output=True,text=True,timeout=30,creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
    require(value.returncode==0,"registry failed: "+value.stderr[-4000:])
    return json.loads(value.stdout.strip())


def analyze(root, plan, check, progress):
    import numpy as np
    import torch
    from PIL import Image
    from ai_painter.complete_world.split_training import state_hash
    from train_ai_assisted_conditional_denoiser import decode_final_visible_rgb
    prior=bound_json(root,plan["sourceResult"])
    parent=bound_json(root,plan["sourcePlan"])
    model,heads,normalization,package=comparison.load_frozen_pair(root,parent)
    model.denoiser.rgb_responsibility_heads=heads
    before=state_hash(model.state_dict())
    dataset=comparison.adapter.HeadDataset(root,package)
    artifacts={Path(b["path"]).name:b for b in prior["artifacts"]}
    rows,controls,geometry=[],[],[]
    with torch.inference_mode(),exact_inference_runtime(torch):
        for i in range(2):
            item=dataset[i]
            conditions,target=item["conditions"][None],item["image"][None]
            fixed_input=state_hash((conditions,target))
            pack=bound_json(root,package["selectedRows"][i]["conditionPack"])
            binding=next(b for b in pack["channels"] if b["id"]=="terrain_path_ground")
            with Image.open(io.BytesIO(read_bound(root,binding))) as image:
                require(image.size==(1024,768),"native mask size changed")
                native=np.asarray(image.convert("L"),dtype=np.uint8).copy()/255.
                small=np.asarray(image.convert("L").resize((256,192),resample=Image.Resampling.NEAREST),dtype=np.uint8).copy()/255.
            road=conditions[0,package["config"]["conditionChannelOrder"].index("terrain_path_ground")]
            require(np.array_equal(small,road.numpy()),"reader changed native nearest road mask")
            facts=bound_json(root,plan["factManifests"][i])
            road_facts=[]
            for fact in facts["visualFacts"]:
                if fact["semanticType"]=="terrain_path_ground":
                    polygon=fact["polygon"]
                    road_facts.append({"factId":fact["factId"],"vertexCount":len(polygon),
                        "bboxXYXYInclusive":[min(p["x"] for p in polygon),min(p["y"] for p in polygon),
                            max(p["x"] for p in polygon),max(p["y"] for p in polygon)]})
            geometry.append({"sampleId":item["sampleId"],"roadMask":binding,"native":mask_geometry(native),
                "resized":mask_geometry(small),"resamplingExact":True,"roadFacts":road_facts})
            clean=model.autoencoder.encode(target)
            reconstruction=model.autoencoder.decode(clean)
            controls.append({"sampleId":item["sampleId"],"kind":"target_encoded_reconstruction_not_generation",
                "targetEncoded":True,"metrics":rgb_diagnostics(torch,reconstruction,target)})
            for j,seed in enumerate(SETTINGS["seeds"][i]):
                check()
                saved=torch.load(io.BytesIO(read_bound(root,artifacts[f"sampling-{i}-{j}.pt"])),map_location="cpu",weights_only=True)
                old=prior["rows"][i*3+j]
                raw=saved["denormalizedGeneratedLatent"]
                require(saved["sampleId"]==item["sampleId"] and saved["seed"]==seed
                        and saved["comparisonIdentity"]==prior["comparisonIdentity"],"saved latent identity mismatch")
                require(state_hash(raw)==old["generatedLatentStateSha256"] and state_hash(conditions)==old["conditionStateSha256"],"saved tensor hash mismatch")
                final,evidence=decode_final_visible_rgb(model,raw,conditions,package["config"],return_stage4_semantic_responsibility_evidence=True)
                require(comparison.measure(torch,final,evidence,target,conditions,package["config"])==old["measurements"]["adapted"],"source measurements do not reproduce")
                row={"sampleId":item["sampleId"],"seed":seed,"targetEncodedForGeneration":False,
                    "generatedVsCleanLatentMae":float((raw-clean).abs().mean()),
                    "base":rgb_diagnostics(torch,evidence["baseDecodedRgb"],target),
                    "final":rgb_diagnostics(torch,final,target),"attribution":error_attribution(torch,final,evidence,target)}
                rows.append(row)
                progress("layer_pair_completed",completed=len(rows),total=6)
            require(state_hash((conditions,target))==fixed_input,"diagnosis changed target or conditions")
    require(state_hash(model.state_dict())==before,"diagnosis changed weights")
    require(all(not p.requires_grad and p.grad is None for p in model.parameters()),"training state present")
    return {"rows":rows,"reconstructionControls":controls,"geometry":geometry,"modelStatesUnchanged":True,
        "modelStateSha256BeforeAndAfter":before,"newRollouts":0,"targetReconstructionCount":2,
        "limitations":["No independent scenes, VJ-2, semantic segmentation or formal qualification.",
            "Reconstruction uses the target and does not establish a pure-noise generation floor.",
            "RGB and derivative errors are not evidence that every object or road is semantically correct.",
            "Overlapping raw proposals need not match target RGB independently; their arithmetic average is the current trained output.",
            "Top error tiles localize training residuals only; they are not validation/checkpoint selection."]}


def run(root):
    import torch
    torch.set_num_threads(4)
    require(not torch.cuda.is_initialized(),"CPU-only required")
    plan=materialize(root)
    directory=comparison.paired.ROOT+"/"+plan["comparisonIdentity"]
    output=project_file(root,directory)
    output.mkdir(parents=True,exist_ok=False)
    save_json(output/"plan.json",plan)
    tests=subprocess.run([os.sys.executable,"-m","unittest","discover","-s","ml/ai-painter/tests","-p",Path(TEST).name,"-v"],
        cwd=root,capture_output=True,text=True,timeout=60,creationflags=getattr(subprocess,"CREATE_NO_WINDOW",0))
    cpu=comparison.cpu_test_record(tests.returncode,plan["testProgram"],tests.stdout,tests.stderr)
    cpu["status"]="layer_cpu_tests_passed" if tests.returncode==0 else "layer_cpu_tests_failed"
    save_json(output/"cpu-tests.json",cpu)
    require(tests.returncode==0,"CPU tests failed: "+tests.stderr[-4000:])
    try:
        begin=registry(root,"begin",directory)
    except Exception as error:
        save_json(output/"launch-failure.json",{"status":"layer_registry_begin_failed","executionState":"failed_closed",
            "runId":plan["comparisonIdentity"],"error":str(error),"recordedAtUtc":now(),"optimizerSteps":0})
        raise
    save_json(output/"registry-start.json",begin)
    started=last=time.perf_counter()
    def check():
        nonlocal last
        require(not torch.cuda.is_initialized(),"CUDA initialized")
        require(time.perf_counter()-started<SETTINGS["maxWallSeconds"],"diagnosis timeout")
        require(sum(p.stat().st_size for p in output.iterdir() if p.is_file())<SETTINGS["maxOutputMiB"]*2**20,"output budget exceeded")
        if time.perf_counter()-last>=8:
            comparison.paired.refresh_heartbeat(output/"heartbeat.json")
            last=time.perf_counter()
    def progress(phase,**extra):
        value={"comparisonIdentity":plan["comparisonIdentity"],"recordedAtUtc":now(),"phase":phase,
            "gpuStarted":False,"trainingStarted":False,"optimizerSteps":0,**extra}
        save_json(output/"progress.json",value,mutable=True)
        print(json.dumps(value),flush=True)
    result={"schemaVersion":"ai-painter-layer-diagnosis-result-v1","comparisonIdentity":plan["comparisonIdentity"],
        "runId":plan["comparisonIdentity"],"plan":file_binding(root,directory+"/plan.json"),"gpuStarted":False,
        "trainingStarted":False,"optimizerSteps":0,"formalQualificationAllowed":False}
    try:
        progress("layer_diagnosis_started")
        result.update(analyze(root,plan,check,progress))
        for binding in plan["inputReceipts"]:
            read_bound(root,binding)
        check()
        result.update(status="layer_diagnosis_completed_not_visual_qualified",executionState="completed",
            inputBindingsReverified=len(plan["inputReceipts"]))
    except Exception as error:
        result.update(status="layer_diagnosis_failed_closed",executionState="failed_closed",error=str(error),traceback=traceback.format_exc())
    result.update(recordedAtUtc=now(),elapsedSeconds=time.perf_counter()-started)
    save_json(output/"result.json",result)
    try:
        comparison.paired.refresh_heartbeat(output/"heartbeat.json")
    except OSError as error:
        save_json(output/"heartbeat-final-warning.json",{"recordedAtUtc":now(),"error":str(error)})
    finished=registry(root,"finish",directory)
    save_json(output/"registry-finish.json",finished)
    require(finished["latestTrainingRunId"]==begin["latestTrainingRunId"],"training pointer changed")
    progress(result["executionState"])
    print(json.dumps(file_binding(root,directory+"/result.json")),flush=True)
    require(result["executionState"]=="completed","diagnosis failed: "+result.get("error","unknown"))


if __name__=="__main__":
    run(Path.cwd())
