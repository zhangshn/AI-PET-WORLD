"""Three interface wiring for a new, not-activated training execution version.

This module never starts a process, registers a route or consumes a Run at import.
The existing live authenticator and lifecycle remain the authority. New production
adoption requires its own bound execution version; synthetic CPU tests are not it.
"""
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import random

from ai_painter.complete_world import parameter90_training_same_call_capture_v1 as capture
import decode1_entry_weight_quality_auth_v1 as auth
import painter_stage4_decode1_entry_same_call_training_profile_v1 as profile

ADAPTER_ID = "parameter90-training-same-call-bridge-v1"
PRODUCTION_ACTIVATED = False
PROFILE_SOURCE = "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py"
PROFILE_SHA = "0a69a96ad0446f91a1fc41f60589fa4e5adc3275edc51e0756e7166e01485c5c"
REQUIRED = (
    "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_capture_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_storage_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter90_training_same_call_bridge_v1.py",
    "ml/ai-painter/scripts/painter_stage4_decode1_entry_same_call_training_profile_v1.py",
)
require = auth.require


def _unique_bindings(programs):
    require(type(programs) is dict and 0 < len(programs) <= 256, "bounded exact source roles required")
    indexed = {}
    for value in programs.values():
        require(type(value) is dict and set(value) == {"path", "sha256"}, "source role fields differ")
        old = indexed.setdefault(value["path"], value)
        require(old == value, "source path collision")
    return indexed


class TrainingSameCallBridge:
    def __init__(self, context, train, model, *, plan_binding, execution_binding, preview=None):
        require(type(context) is auth.Context, "authentic execution context type required")
        auth.verify_live_context(context, expected_phase="training")
        self.context, self.train, self.model = context, tuple(train), model
        self.plan_binding, self.execution_binding, self.preview = deepcopy(plan_binding), deepcopy(execution_binding), preview
        self.last_failure = None
        self._authenticate_bindings()
        require(len(self.train) == 48 and len({s["sampleId"] for s in self.train}) == 48,
                "exact48 unique train sources required")
        split = context.reader.json(context.plan["trainSplit"])
        require(split.get("split") == "train" and split.get("sampleIds") == [s["sampleId"] for s in self.train],
                "actual train sequence differs from immutable split")
        self.indexes = {sample["sampleId"]: index for index,sample in enumerate(self.train)}
        for sample in self.train:
            self._sample_identity(sample)

    def _authenticate_bindings(self):
        context = self.context
        reader, plan = context.reader, context.plan
        require(auth.same_json(reader.json(self.plan_binding), plan) and
                self.plan_binding["path"] == plan["outputRoot"]+"/quality-plan.json", "own immutable plan differs")
        require(auth.same_json(reader.json(context.package_binding), context.package) and
                context.package["outputRoot"] == plan["outputRoot"] and
                context.package["packageIdentity"] == plan["packageId"] and
                self.plan_binding in context.package["inputEvidence"], "own package/plan identity differs")
        ticket = reader.json(self.execution_binding)
        require(self.execution_binding["path"] == plan["outputRoot"]+"/capture-execution.json" and
                ticket["schema"] == "object-support-structure-failure-capture-execution-v1" and
                ticket["runId"] == plan["runId"] and ticket["outputRoot"] == plan["outputRoot"] and
                ticket["executionPackage"] == context.package_binding and
                ticket["programBindings"] == plan["programBindings"] and ticket["modelBinding"] == plan["modelBinding"],
                "own capture ticket differs")
        indexed = _unique_bindings(plan["programBindings"])
        require(indexed.get(PROFILE_SOURCE,{}).get("sha256") == PROFILE_SHA, "original training arithmetic source differs")
        for logical in (*REQUIRED, PROFILE_SOURCE):
            require(logical in indexed, "same-call source omitted: "+logical)
            raw = reader.read(indexed[logical])
            require(type(raw) is bytes and len(raw) <= 1048576 and hashlib.sha256(raw).hexdigest() == indexed[logical]["sha256"],
                    "same-call source bytes differ")
            actual = Path(reader.root)/logical
            require(actual.is_file() and actual.read_bytes() == raw, "loaded project source path differs")
        for logical,sha in capture.SOURCE_BINDINGS:
            require(indexed.get(logical,{}).get("sha256") == sha, "original gate/model/bridge binding omitted")
        self.source_bindings = list(indexed.values())
        self.graph = reader.json(plan["modelBinding"])["graph"]
        reader.unchanged()

    def _sample_identity(self, sample):
        profile.original.validate_sample_ecology(sample)
        token = sample.get("_ecology_regime_binding")
        require(token is not None and token.reader is self.context.reader, "train sample reader identity differs")
        source = json.loads(token.identity_json)
        require(sample.get("split") == source.get("split") == "train" and
                sample["sampleId"] == source["sampleId"], "bound train identity differs")
        for key in ("image", "conditionPack"):
            self.context.reader.read(source[key])
        return source

    def same_call_context(self, model, sample, counts, resource):
        require(model is self.model, "same-call actual generator object differs")
        source = self._sample_identity(sample)
        plan = self.context.plan
        g,d = counts.get("generator"),counts.get("discriminator")
        require(type(g) is int and type(d) is int and 0 <= g < 1152 and d == g+1,
                "actual pre-G optimizer counters differ")
        epoch,ordinal = g//48+1,g%48
        index = self.indexes.get(source["sampleId"])
        indices = list(range(48)); random.Random(plan["configuration"]["seed"]+epoch).shuffle(indices)
        require(index is not None and indices[ordinal] == index, "actual source/order differs from fixed schedule")
        identity = dict(runId=plan["runId"], packageId=plan["packageId"], sampleId=source["sampleId"],
            epoch=epoch, zeroBasedEpochPosition=ordinal, trainIndex=index, optimizerSteps=dict(counts),
            modelBinding=deepcopy(plan["modelBinding"]))
        return capture.Parameter90TrainingSameCallCapture(model, identity=identity, graph=self.graph,
            source_bindings=self.source_bindings, resource=resource)

    def sample_context(self, sample, position):
        require(sample is not None and position is not None, "failure before a bound sample")
        source = self._sample_identity(sample)
        plan = self.context.plan
        require(position["sampleId"] == sample["sampleId"] and position["trainIndex"] == self.indexes[sample["sampleId"]],
                "failure source position differs")
        return dict(runId=plan["runId"], sampleId=sample["sampleId"], split="train", sampleIdentity=source,
            sampleBindings={"source":source["image"],"condition":source["conditionPack"]},
            modelBinding=deepcopy(plan["modelBinding"]), programBindings=deepcopy(plan["programBindings"]),
            executionPackage=deepcopy(self.context.package_binding))

    def pair_runner(self, *args, **kwargs):
        require(args and args[0] is self.model, "runner actual generator differs")
        require("same_call_context" not in kwargs and "components" not in kwargs, "caller cannot replace bound G context/profile")
        self.last_failure = None
        raw = []
        def observed(stage,label,rows):
            if stage == "complete":
                require(len(raw) < 5 and label == capture.LABELS[len(raw)], "actual five-gradient order differs")
                raw.append(rows)
        if self.preview is not None:
            require("prediction_observer" not in kwargs, "caller cannot replace bound preview")
            kwargs["prediction_observer"] = self.preview.observe
        try:
            with capture.device_bridge.observe_generator_gradients(observed):
                return profile.perform_pair(*args, **kwargs, same_call_context=self.same_call_context)
        except BaseException as error:
            self.last_failure = error
            if not hasattr(error,"object_support_gradient_evidence"):
                try:
                    error.object_support_gradient_evidence = dict(gradientSetsAvailable=len(raw),
                        rawGradients=tuple(raw), componentsInOrder=list(capture.LABELS),
                        parameterNames=[name for name,_ in self.model.named_parameters()])
                except BaseException as secondary:
                    try: error.secondary_gradient_evidence_error = str(secondary)[:2048]
                    except BaseException: pass
            raise

    def capture_sink(self, error, *, model, critic, context):
        from ai_painter.complete_world.parameter90_training_same_call_storage_v1 import save_same_call_failure
        require(model is self.model, "failure generator object differs")
        secondary = []
        try:
            auth.verify_live_context(self.context, expected_phase="training")
            self._authenticate_bindings()
        except BaseException as failure:
            secondary.append(dict(type=type(failure).__name__,message=str(failure)[:2048]))
        packet = getattr(error,"parameter90_same_call_packet",None) if not secondary and error is self.last_failure else None
        roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]")) or [self.context.plan["outputRoot"]]
        maximum = min(capture.EXECUTION_MAXIMUM, int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX", capture.EXECUTION_MAXIMUM)))
        # Upstream failures still use the original recorder; there is no guessed packet.
        result = save_same_call_failure(error, packet=packet, model=model, critic=critic, context=context,
            mapping=self.context.reader.mapping, output=self.context.plan["outputRoot"]+"/gradient-failure",
            execution_binding=self.execution_binding, plan_binding=self.plan_binding,
            output_roots=roots, maximum_output_bytes=maximum)
        if secondary:
            result["sameCallBridgeSecondaryFailures"] = secondary
        return result


def training_loop_with_same_call_capture(*, context, model, critic, train, validation, order,
        plan_binding, execution_binding, resource, checkpoint_sink, progress_sink,
        observation_sink=None, preview=None):
    """Connect the existing lifecycle's two explicit callback interfaces only."""
    import painter_stage4_decode1_entry_weight_lifecycle_v1 as lifecycle
    bridge = TrainingSameCallBridge(context,train,model,plan_binding=plan_binding,
        execution_binding=execution_binding,preview=preview)
    return lifecycle.training_loop(model=model,critic=critic,train=train,validation=validation,order=order,
        configuration=context.plan["configuration"],package_binding=context.package_binding,plan=context.plan,
        plan_binding=plan_binding,resource=resource,checkpoint_sink=checkpoint_sink,progress_sink=progress_sink,
        observation_sink=observation_sink,pair_runner=bridge.pair_runner,capture_sink=bridge.capture_sink,
        context_for_sample=bridge.sample_context)

