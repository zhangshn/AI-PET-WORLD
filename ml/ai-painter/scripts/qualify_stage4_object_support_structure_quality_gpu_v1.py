# TD-TRAIN-ENTRY-01-PY: independent terrain-detail identity, inherited frozen algorithms.
"""Own 1.69 quality24 same-package full48 GPU gate, zero optimizer updates."""
import argparse
from copy import deepcopy
import hashlib
import json
import math
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / "ml/ai-painter/scripts"))
import painter_stage4_object_support_structure_quality_worker_v1 as worker
# Only the bounded event counter is reused, never the predecessor's run/gate.
class Calls:
    LIMITS = {"forward": 48, "generator": 240, "discriminator": 48}
    def __init__(self):
        self.counts = {key + suffix: 0 for key in self.LIMITS for suffix in ("Attempted", "Completed")}
        self.window = {}
    def begin(self):
        self.window = {key: self.counts[key + "Attempted"] + (5 if key == "generator" else 1) for key in self.LIMITS}
    def event(self, stage, kind, _gradients):
        worker.require(stage in ("attempt", "complete") and kind in self.LIMITS, "GPU event differs")
        key = kind + ("Attempted" if stage == "attempt" else "Completed")
        value = self.counts[key] + 1
        worker.require(value <= min(self.LIMITS[kind], self.window[kind]), "GPU call ceiling exhausted")
        if stage == "complete":
            worker.require(value <= self.counts[kind + "Attempted"], "GPU completed without attempt")
        self.counts[key] = value


class QualificationObservation:
    """Bounded host timing only; never a GPU gate or extra numerical operation."""
    def __init__(self, context, calls, started, authentication_finished):
        auth=worker.auth
        worker.require(type(context) is auth.Context,"authenticated Context required for observation")
        plan=context.plan;route=auth.execution_route(plan.get("capabilityVersion"))
        worker.require(route.capability in (auth.FINAL_RGB_CAPABILITY,auth.JOINT_CAPABILITY),"only registered final RGB/joint timing enabled")
        worker.require(plan.get("outputRoot")==route.root_prefix+plan["runId"]
            and plan.get("executionProfile")==route.profile and plan.get("executionPolicy")==route.execution_policy
            and plan["configuration"].get("executionPolicy")==route.execution_policy,"timing plan identity differs")
        bound=auth.exact_binding(context.package_binding)
        worker.require(bound["path"]==".runtime/ai-painter/autonomous-closed-loop-packages/"+plan["packageId"]+"/package.json"
            and context.package.get("packageIdentity")==plan["packageId"]
            and context.package.get("capabilityVersion")==route.capability
            and context.package.get("outputRoot")==plan["outputRoot"],"timing package identity differs")
        policy=auth.read_json(context.reader,route.execution_policy)
        auth.checkpoint_components(route.capability).validate_execution_policy(policy,plan["configuration"])
        self.seconds=plan["configuration"]["gpuAdmissionSeconds"]
        self.contract=deepcopy(policy["qualificationObservation"])
        self.context,self.calls=context,calls
        self.identity={key:deepcopy(plan[key]) for key in ("runId","packageId","capabilityVersion","executionProfile","outputRoot","executionPolicy")}
        self.package_binding=deepcopy(bound)
        self.logical=plan["outputRoot"]+"/"+self.contract["fileName"]
        self.pending_logical=self.logical+".staged"
        self.started,self.last_clock=started,started
        self.active={};self.aggregates={key:{"attempted":0,"completed":0,"failed":0,"hostSeconds":0.0}
            for key in self.contract["measurementPoints"]}
        self.sample=None;self.entered=0;self.completed=0;self.generator_base=0
        self.status="observing";self.last_event=None;self.committed=None
        self.directory=context.reader.path(plan["outputRoot"])
        worker.capture._plain(self.directory)
        self.directory_identity=worker.capture._directory_identity(self.directory)
        worker.require(not context.reader.path(self.logical).exists() and not context.reader.path(self.pending_logical).exists(),
            "timing output already exists; no replay or backfill")
        self._clock(authentication_finished)
        self.aggregates["initial_authentication"].update(attempted=1,completed=1,hostSeconds=authentication_finished-started)
        self._last("initial_authentication","complete",authentication_finished)
        self.publish()

    def _clock(self, value=None):
        value=time.monotonic() if value is None else value
        worker.require(type(value) in (int,float) and math.isfinite(value) and value>=self.last_clock,"timing clock regressed/nonfinite")
        self.last_clock=value
        return value

    def _last(self, point, stage, now):
        self.last_event={"point":point,"stage":stage,"elapsedSeconds":now-self.started,
            "sample":deepcopy(self.sample),"actualCounts":dict(self.calls.counts)}

    def _begin(self, point, *, publish=True):
        worker.require(point in self.aggregates and point not in self.active,"timing span identity/order differs")
        now=self._clock();self.active[point]=now;self.aggregates[point]["attempted"]+=1
        self._last(point,"attempt",now)
        if publish:self.publish()

    def _end(self, point, *, failed=False, publish=True):
        worker.require(point in self.active,"timing span completion without attempt")
        now=self._clock();self.aggregates[point]["hostSeconds"]+=now-self.active.pop(point)
        self.aggregates[point]["failed" if failed else "completed"]+=1
        self._last(point,"failed" if failed else "complete",now)
        if publish:self.publish()

    @staticmethod
    def secondary(primary, error):
        try:
            if not hasattr(primary,"qualification_observation_error"):
                primary.qualification_observation_error={"type":type(error).__name__,"message":str(error)[:512]}
        except BaseException:pass

    def measure(self, point, action, *args, **kwargs):
        self._begin(point)
        try:result=action(*args,**kwargs)
        except BaseException as primary:
            try:self._end(point,failed=True)
            except BaseException as secondary:self.secondary(primary,secondary)
            raise
        self._end(point)
        return result

    def resource(self, action):
        return self.measure("resource_checks",action)

    def enter_sample(self, sample_id, index):
        worker.require(self.sample is None or self.entered==self.completed,"previous probe incomplete")
        worker.require(type(index) is int and index==self.entered and 0<=index<48 and type(sample_id) is str
            and 0<len(sample_id)<=256,"timing sample identity differs")
        self.sample={"sampleId":sample_id,"trainOrdinal":index};self.entered+=1
        self.generator_base=self.calls.counts["generatorCompleted"]
        self._last("sample","entered",self._clock());self.publish()

    def event(self, stage, kind, gradients):
        # The original counter is invoked exactly once. Never inspect gradients.
        self.calls.event(stage,kind,gradients)
        point={"forward":"generator_forward","discriminator":"discriminator_vjp","generator":"generator_vjp"}[kind]
        if stage=="attempt":self._begin(point,publish=False)
        else:
            self._end(point,publish=False)
            if kind=="generator" and self.calls.counts["generatorCompleted"]-self.generator_base==5:
                self._begin("post_vjp_processing",publish=False)
        if kind=="generator":
            self.last_event["generatorVjpOrdinal"]=self.calls.counts["generatorAttempted"]-self.generator_base
        self.publish()

    def probe_returned(self):
        self._end("post_vjp_processing")

    def complete_sample(self):
        worker.require(self.entered==self.completed+1,"timing completed sample without entry")
        self.completed+=1;self._last("sample","complete",self._clock());self.publish()

    def finish(self, primary=None):
        try:
            for point in tuple(self.active):self._end(point,failed=primary is not None,publish=False)
            self.status="failed_closed" if primary is not None else "probe_sequence_completed_not_qualification"
            self._last("observation","failed" if primary is not None else "complete",self._clock())
            self.publish()
        except BaseException as secondary:
            if primary is None:raise
            self.secondary(primary,secondary)

    def snapshot(self):
        return {"schemaVersion":self.contract["schemaVersion"],"purpose":"diagnostic_only_not_qualification",
            **deepcopy(self.identity),"executionPackage":deepcopy(self.package_binding),"status":self.status,
            "clock":self.contract["clock"],"clockOrigin":"python_qualifier_run_entry_after_module_imports",
            "coverage":"excludes_prior_native_compile_process_start_and_module_imports_not_entire_native720seconds",
            "timingsIncludeObserverOverhead":True,
            "resourceTimeMeaning":self.contract["resourceTimeMeaning"],"postVjpProcessingMeaning":self.contract["postVjpProcessingMeaning"],
            "nestedTimingsMayBeAddedAsIndependentGpuCosts":False,"aggregates":deepcopy(self.aggregates),
            "activeSpans":{key:{"startedElapsedSeconds":value-self.started} for key,value in self.active.items()},
            "enteredSamples":self.entered,"completedSamples":self.completed,"lastEvent":deepcopy(self.last_event),
            "actualCounts":dict(self.calls.counts),"optimizerConstruction":0,"optimizerUpdates":0,
            "canGrantQualification":False,"uncommittedCountsReconstructed":False}

    def _stable(self):
        plan=self.context.plan
        worker.require(all(plan.get(key)==value for key,value in self.identity.items())
            and self.context.package_binding==self.package_binding
            and self.context.package.get("packageIdentity")==self.identity["packageId"]
            and self.context.package.get("capabilityVersion")==self.identity["capabilityVersion"]
            and self.context.package.get("outputRoot")==self.identity["outputRoot"]
            and plan["configuration"].get("executionPolicy")==self.identity["executionPolicy"],"timing authenticated identity changed")
        worker.require(self.logical==self.identity["outputRoot"]+"/gpu-qualification-timing.json"
            and self.pending_logical==self.logical+".staged","timing output path changed")
        self.context.reader.mapping.check();worker.capture._plain(self.directory)
        worker.require(worker.capture._directory_identity(self.directory)==self.directory_identity,"timing directory changed")

    def publish(self):
        self._stable()
        raw=worker.capture.json_bytes(self.snapshot())
        worker.require(len(raw)<=self.contract["maxFileBytes"] and len(raw)<=self.contract["maxStagedFileBytes"],"timing32768 byte ceiling")
        reader=self.context.reader;path=reader.path(self.logical);pending=reader.path(self.pending_logical)
        worker.capture._plain(path);worker.capture._plain(pending)
        if self.committed is not None:reader.mapping.binding(self.committed,maximum=self.contract["maxFileBytes"])
        else:worker.require(not path.exists(),"unowned timing output appeared")
        worker.require(not pending.exists(),"timing staging already exists")
        roots=json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS","[]")) or [self.identity["outputRoot"]]
        worker.require(type(roots) is list and 1<=len(roots)<=32 and len(set(roots))==len(roots)
            and self.identity["outputRoot"] in roots,"timing accounting roots differ")
        maximum=min(self.contract["accountedWithinQualificationOutputBytes"],int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX",16777216)))
        worker.require(maximum>0 and sum(worker.capture.directory_bytes(reader.path(root)) for root in roots)+len(raw)+65536<=maximum
            and worker.capture.directory_bytes(self.directory)+len(raw)+65536<=self.contract["accountedWithinRunOutputBytes"],
            "timing qualification/run output reserve exhausted")
        with pending.open("xb") as stream:
            worker.require(stream.write(raw)==len(raw),"short timing write")
            stream.flush();os.fsync(stream.fileno())
        self._stable()
        self._replace(pending,path)
        self._stable()
        binding={"path":self.logical,"sha256":hashlib.sha256(raw).hexdigest()}
        reader.mapping.binding(binding,maximum=self.contract["maxFileBytes"])
        self.committed=binding

    def _replace(self, pending, path):
        """Same bounded staged-replacement pattern as the existing progress writer."""
        deadline=min(self.started+self.seconds,time.monotonic()+.250);first=None
        for attempt in range(5):
            if time.monotonic()>=deadline:
                if first is not None:raise first
                raise TimeoutError("timing replacement deadline exhausted")
            try:
                os.replace(pending,path)
                return
            except OSError as error:
                if os.name!="nt" or getattr(error,"winerror",None) not in (5,32,33):
                    if first is not None:raise first from error
                    raise
                if first is None:first=error
                if attempt==4:raise first
                self._stable();worker.capture._plain(pending);worker.capture._plain(path)
                delay=.010*(2**attempt)
                if time.monotonic()+delay>=deadline:raise first
                time.sleep(delay)


def observation_for_context(context,calls,started,authentication_finished):
    if worker.auth.execution_route(context.plan["capabilityVersion"]).capability not in (worker.auth.FINAL_RGB_CAPABILITY,worker.auth.JOINT_CAPABILITY):
        return None
    return QualificationObservation(context,calls,started,authentication_finished)


def _heartbeat_error_metadata(error):
    """Bound only observational metadata; never replace the original exception."""
    value = getattr(error, "heartbeat_read", None)
    if type(value) is not dict or value.get("schema") != "ecology-heartbeat-read-error-v1":
        return None
    text = lambda v, limit: v[:limit] if type(v) is str else None
    integer = lambda v: v if type(v) is int else None
    elapsed = value.get("elapsedMilliseconds")
    return {"schema": value["schema"], "logicalPath": text(value.get("logicalPath"), 4096),
        "physicalPath": text(value.get("physicalPath"), 4096), "attempts": integer(value.get("attempts")),
        "elapsedMilliseconds": elapsed if type(elapsed) in (int, float) and math.isfinite(elapsed) else None,
        "operation": text(value.get("operation"), 64),
        "reasons": [{"attempt": integer(row.get("attempt")), "operation": text(row.get("operation"), 64),
            "reason": text(row.get("reason"), 64), "errno": integer(row.get("errno")),
            "winerror": integer(row.get("winerror"))} for row in value.get("reasons", [])[:3] if type(row) is dict]
            if type(value.get("reasons")) is list else []}


def run(package_binding, *, root=ROOT):
    started = time.monotonic()
    context = worker.authenticate_live(package_binding, root=root, phase=None)
    reader, plan = context.reader, context.plan
    route=worker.auth.execution_route(plan["capabilityVersion"])
    authentication_finished=time.monotonic() if route.capability in (worker.auth.FINAL_RGB_CAPABILITY,worker.auth.JOINT_CAPABILITY) else None
    torch,profile,shared=worker.runtime_for_plan(plan)
    torch.set_num_threads(2)
    worker.write(root, plan["outputRoot"] + "/gpu-consumed.json",
        {"executionPackage": package_binding, "capabilityVersion": route.capability,
         "attempt": 1, "automaticRetries": 0})
    calls, cases, attempted_sample = Calls(), [], None
    observation=None
    try:
        observation=observation_for_context(context,calls,started,authentication_finished)
        def measured(point,action,*args,**kwargs):
            return action(*args,**kwargs) if observation is None else observation.measure(point,action,*args,**kwargs)
        train, order = measured("data_load",worker.load_samples,reader,plan)
        def model_setup():
            model,critic=profile.fresh_networks(order)
            state={"generator":shared.v24.core.cpu.state_hash(model),"discriminator":shared.v24.core.cpu.state_hash(critic)}
            metadata=worker.auth.read_json(reader,plan["modelBinding"])
            worker.require(worker.auth.same_json(state,metadata["initialState"]),"own fresh GPU candidate differs from bound CPU identity")
            return model,critic,state
        model,critic,cpu_state=measured("model_setup",model_setup)
        worker.require(time.monotonic() - started < plan["configuration"]["gpuAdmissionSeconds"], "GPU setup deadline exhausted")
        def cuda_setup():
            worker.require(torch.cuda.is_available() and torch.cuda.is_bf16_supported(),"CUDA BF16 unavailable")
            torch.cuda.set_per_process_memory_fraction(.7)
            torch.cuda.set_device(0)
            model.to("cuda:0");critic.to("cuda:0")
            state={"generator":shared.v24.core.cpu.state_hash(model),"discriminator":shared.v24.core.cpu.state_hash(critic)}
            worker.require(worker.auth.same_json(state,cpu_state),"device transfer changed own state")
            return state
        initial=measured("cuda_setup",cuda_setup)
        resource = worker.ResourceGuard(package_binding, plan,
            root=root, started=started, gpu_gate=True)
        if observation is not None:
            original_resource=resource
            resource=lambda:observation.resource(original_resource)
        for index,sample in enumerate(train):
            resource()
            calls.begin()
            attempted_sample = {"sampleId": sample["sampleId"]}
            if observation is not None:observation.enter_sample(sample["sampleId"],index)
            proof = profile.zero_update_probe(model, critic, sample, order, resource,
                event=calls.event if observation is None else observation.event, failure_evidence=attempted_sample)
            if observation is not None:observation.probe_returned()
            worker.require(proof.get("passed") is True
                and all(p.grad is None for network in (model, critic) for p in network.parameters()),
                "own GPU probe changed gradient state")
            cases.append({"sampleId": sample["sampleId"], "passed": True, "proof": proof})
            if observation is not None:observation.complete_sample()
        final = {"generator": shared.v24.core.cpu.state_hash(model),
                 "discriminator": shared.v24.core.cpu.state_hash(critic)}
        expected = {key + suffix: limit for key, limit in Calls.LIMITS.items()
                    for suffix in ("Attempted", "Completed")}
        worker.require(worker.auth.same_json(initial, final) and len(cases) == 48
            and worker.auth.same_json(calls.counts, expected), "complete own GPU counts/state differ")
        reader.unchanged()
        resource()
        if observation is not None:observation.finish()
        return worker.write(root, plan["outputRoot"] + "/gpu-gate.json", {
            "schema": worker.GPU_SCHEMA, "status": "passed", "capabilityVersion": route.capability,
            "executionProfile": route.profile, "executionPackage": package_binding,
            "runId": plan["runId"], "packageId": plan["packageId"],
            "programBindings": plan["programBindings"], "actualCounts": calls.counts, "cases": cases,
            "initialState": initial, "finalState": final, "initialCpuState": cpu_state,
            "deviceIdentity": (original_resource if observation is not None else resource).device_identity,
            "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False,
            "elapsedSeconds": time.monotonic() - started,
            "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False})
    except BaseException as error:
        if observation is not None:observation.finish(error)
        try:
            worker.write(root, plan["outputRoot"] + "/gpu-failure.json", {
                "schema": worker.GPU_SCHEMA, "status": "failed_closed",
                "capabilityVersion": route.capability, "executionPackage": package_binding,
                "runId": plan["runId"], "packageId": plan["packageId"],
                "originalError": {"type": type(error).__name__, "message": str(error)[:4096],
                    "errno": getattr(error, "errno", None), "winerror": getattr(error, "winerror", None),
                    "heartbeatRead": _heartbeat_error_metadata(error)},
                **({"qualificationObservationError":getattr(error,"qualification_observation_error",None)}
                    if route.capability in (worker.auth.FINAL_RGB_CAPABILITY,worker.auth.JOINT_CAPABILITY) else {}),
                "actualCounts": calls.counts, "completedCases": len(cases),
                "attemptedSample": attempted_sample, "optimizerSteps": 0, "automaticRetries": 0,
                "formalStage4QualificationAllowed": False, "runtimePublicationAllowed": False}, terminal=True)
        except BaseException as other:
            error.secondary_evidence_error = str(other)[:2048]
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--package", required=True)
    parser.add_argument("--sha256", required=True)
    args = parser.parse_args()
    print(json.dumps(run({"path": args.package, "sha256": args.sha256})))
