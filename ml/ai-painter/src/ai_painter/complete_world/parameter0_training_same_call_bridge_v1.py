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
from threading import Lock

from ai_painter.complete_world import parameter0_training_same_call_capture_v1 as capture
import decode1_entry_weight_quality_auth_v1 as auth
import painter_stage4_decode2_rgb_output_training_same_call_profile_v1 as profile

ADAPTER_ID = "parameter0-training-same-call-bridge-v1"
PRODUCTION_ACTIVATED = False
PROFILE_SOURCE = "ml/ai-painter/scripts/painter_stage4_decode1_entry_weight_training_profile_v1.py"
PROFILE_SHA = "c3ad26b9b4d766522c6428c9f5e4dad303af461aeefba4c47b543224cf0afecb"
REQUIRED = (
    "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_capture_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_storage_v1.py",
    "ml/ai-painter/src/ai_painter/complete_world/parameter0_training_same_call_bridge_v1.py",
    "ml/ai-painter/scripts/painter_stage4_decode2_rgb_output_training_same_call_profile_v1.py",
)
CAPABILITY = "stage4_mvp256_dry_decode2_rgb_output_training_capture_v1"
# Reserved component identity: the live authenticator/entrypoint does not adopt it.
COVERAGE_CAPABILITY = "stage4_mvp256_dry_decode2_rgb_output_training_capture_v6"
CAPABILITIES = (CAPABILITY, "stage4_mvp256_dry_decode2_rgb_output_training_capture_v2",
                "stage4_mvp256_dry_decode2_rgb_output_training_capture_v3",
                "stage4_mvp256_dry_decode2_rgb_output_training_capture_v4",
                "stage4_mvp256_dry_decode2_rgb_output_training_capture_v5", COVERAGE_CAPABILITY)
MODEL_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode2_rgb_output_weight_precision_v1"
SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-154-tropical-forest-glade-v2"
require = auth.require


def _unique_bindings(programs):
    require(type(programs) is dict and 0 < len(programs) <= 256, "bounded exact source roles required")
    indexed = {}
    for value in programs.values():
        require(type(value) is dict and set(value) == {"path", "sha256"}, "source role fields differ")
        require(value["path"] not in indexed, "duplicate source path")
        indexed[value["path"]] = value
    return indexed


class TrainingSameCallBridge:
    def __init__(self, context, train, model, *, plan_binding, execution_binding, preview=None):
        require(type(context) is auth.Context, "authentic execution context type required")
        auth.verify_live_context(context, expected_phase="training")
        self.context, self.train, self.model = context, tuple(train), model
        self.plan_binding, self.execution_binding, self.preview = deepcopy(plan_binding), deepcopy(execution_binding), preview
        self.last_failure = None
        self.observed_calls = 0
        self._coverage_observer = None
        self._coverage_poisoned = False
        self._coverage_pair_lock = Lock()
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
        configuration = plan.get("configuration", {})
        require(plan.get("capabilityVersion") == configuration.get("capabilityVersion")
        and plan.get("capabilityVersion") in CAPABILITIES
                and type(configuration.get("objectSupportStructureWeight")) is int
                and configuration["objectSupportStructureWeight"] == 1
                and configuration.get("modelCapabilityVersion") == MODEL_CAPABILITY
                and configuration.get("seed") == 20260929, "exact RGB capture/weight1/seed required")
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
        metadata = reader.json(plan["modelBinding"])
        require(metadata.get("modelCapabilityVersion") == MODEL_CAPABILITY, "bound RGB model capability differs")
        self.graph = metadata["graph"]
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
        if self.context.plan["capabilityVersion"] == COVERAGE_CAPABILITY:
            return self._coverage_context(model, sample, counts, resource)
        require(model is self.model, "same-call actual generator object differs")
        plan = self.context.plan
        g,d = counts.get("generator"),counts.get("discriminator")
        require(type(g) is int and type(d) is int and 0 <= g < 1152 and d == g+1,
                "actual pre-G optimizer counters differ")
        if g != 14:
            return None
        source = self._sample_identity(sample)
        epoch,ordinal = g//48+1,g%48
        index = self.indexes.get(source["sampleId"])
        indices = list(range(48)); random.Random(plan["configuration"]["seed"]+epoch).shuffle(indices)
        require(index is not None and indices[ordinal] == index, "actual source/order differs from fixed schedule")
        require(epoch == 1 and ordinal == 14 and index == 8 and source["sampleId"] == SAMPLE_ID
                and d == 15, "exact single training observation call differs")
        require(self.observed_calls == 0, "single training observation already consumed")
        self.observed_calls += 1
        identity = dict(runId=plan["runId"], packageId=plan["packageId"], sampleId=source["sampleId"],
            epoch=epoch, zeroBasedEpochPosition=ordinal, trainIndex=index, optimizerSteps=dict(counts),
            modelBinding=deepcopy(plan["modelBinding"]))
        return capture.Parameter0TrainingSameCallCapture(model, identity=identity, graph=self.graph,
            source_bindings=self.source_bindings, resource=resource)

    def _coverage_previous_released(self):
        previous = self._coverage_observer
        if previous is not None:
            require(previous._closed is True and previous.packet is None
                    and previous.outcome == {"status":"successful_g_released_without_capture"}
                    and previous.model is None and previous.module is None
                    and previous.resource is None and previous._bound_resource is None
                    and previous._resource_failure is None
                    and not any((previous._handles, previous._graph, previous._buffers,
                                 previous._sources, previous._adjoints, previous._gradients,
                                 previous._descriptors))
                    and previous._input is None and previous._input_ref is None
                    and previous._output_ref is None,
                    "previous G observation not completely released")

    def _coverage_context(self, model, sample, counts, resource):
        """One current call only; never retain a history of successful tensors."""
        try:
            require(not self._coverage_poisoned and self.last_failure is None,
                    "failure-call coverage already closed")
            require(model is self.model, "same-call actual generator object differs")
            require(type(counts) is dict and set(counts) == {"generator","discriminator"}
                    and all(type(v) is int for v in counts.values())
                    and 0 <= counts["generator"] < 1152
                    and counts["discriminator"] == counts["generator"]+1,
                    "actual pre-G optimizer counters differ")
            g = counts["generator"]
            require(g == self.observed_calls, "failure-call coverage gap or repeated call")
            self._coverage_previous_released()
            self._coverage_observer = None
            source = self._sample_identity(sample)
            epoch, ordinal = g//48+1, g%48
            indices = list(range(48))
            random.Random(self.context.plan["configuration"]["seed"]+epoch).shuffle(indices)
            index = self.indexes.get(source["sampleId"])
            require(index is not None and indices[ordinal] == index,
                    "coverage sample differs from bound epoch schedule")
            identity = dict(runId=self.context.plan["runId"], packageId=self.context.plan["packageId"],
                sampleId=source["sampleId"], epoch=epoch, zeroBasedEpochPosition=ordinal, trainIndex=index,
                optimizerSteps=dict(counts), modelBinding=deepcopy(self.context.plan["modelBinding"]))
            # Consume before construction: a failed constructor cannot be retried.
            self.observed_calls += 1
            observer = capture.Parameter0TrainingSameCallCapture(self.model, identity=identity, graph=self.graph,
                source_bindings=self.source_bindings, resource=resource)
            self._coverage_observer = observer
            return observer
        except BaseException:
            self._coverage_poisoned = True
            raise

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
        if self.context.plan["capabilityVersion"] != COVERAGE_CAPABILITY:
            return self._bound_pair_runner(*args, **kwargs)
        require(self._coverage_pair_lock.acquire(blocking=False), "concurrent coverage pair rejected")
        try:
            require(not self._coverage_poisoned, "failure-call coverage already closed")
            # Check before the original pair can update D, not just before G.
            counts = args[6] if len(args) > 6 else None
            require(type(counts) is dict and set(counts) == {"generator","discriminator"}
                    and all(type(v) is int for v in counts.values())
                    and 0 <= counts["generator"] < 1152
                    and counts["generator"] == counts["discriminator"] == self.observed_calls,
                    "coverage pre-D counts or sequence differ")
            self._coverage_previous_released()
            return self._bound_pair_runner(*args, **kwargs)
        except BaseException:
            self._coverage_poisoned = True
            raise
        finally:
            self._coverage_pair_lock.release()

    def _bound_pair_runner(self, *args, **kwargs):
        require(args and args[0] is self.model, "runner actual generator differs")
        require(not any(key in kwargs for key in ("same_call_context", "components", "support_structure_weight")),
                "caller cannot replace bound G context/profile/weight")
        kwargs["support_structure_weight"] = 1.0
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
            if self.context.plan["capabilityVersion"] == COVERAGE_CAPABILITY:
                self._coverage_poisoned = True
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
        from ai_painter.complete_world.parameter0_training_same_call_storage_v1 import save_same_call_failure
        require(model is self.model, "failure generator object differs")
        secondary = []
        try:
            auth.verify_live_context(self.context, expected_phase="training")
            self._authenticate_bindings()
        except BaseException as failure:
            secondary.append(dict(type=type(failure).__name__,message=str(failure)[:2048]))
        packet = getattr(error,"parameter0_same_call_packet",None) if not secondary and error is self.last_failure else None
        roots = json.loads(os.environ.get("DETAIL_WEIGHT_OUTPUT_ROOTS", "[]")) or [self.context.plan["outputRoot"]]
        maximum = min(capture.EXECUTION_MAXIMUM, int(os.environ.get("DETAIL_WEIGHT_OUTPUT_MAX", capture.EXECUTION_MAXIMUM)))
        # Upstream failures still use the original recorder; there is no guessed packet.
        result = save_same_call_failure(error, packet=packet, model=model, critic=critic, context=context,
            mapping=self.context.reader.mapping, output=self.context.plan["outputRoot"]+"/gradient-failure",
            execution_binding=self.execution_binding, plan_binding=self.plan_binding,
            output_roots=roots, maximum_output_bytes=maximum)
        result["sameCallObservationOutcome"] = getattr(error, "parameter0_same_call_outcome", None)
        if secondary:
            result["sameCallBridgeSecondaryFailures"] = secondary
        return result

