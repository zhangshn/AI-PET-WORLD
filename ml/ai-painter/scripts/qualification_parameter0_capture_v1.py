"""Passive target0 probe evidence component; no route, runner or qualification.

The live qualifier must authenticate a new execution scope before constructing
this component. It owns neither admission nor file paths. The caller's existing
bounded, exclusive writer persists artifacts only after its primary failure.
"""
from copy import deepcopy
import io
import json
import math

import torch
from ai_painter.complete_world.parameter40_qualification_observation_v1 import (
    LABELS, MAX_CAPTURE, TARGET0_SHAPE, TARGET0_SPATIAL, Target0Observation, require, sha)
from ai_painter.complete_world.parameter40_qualification_reference_v1 import contrast
from qualification_gradient_gate_authentication_cpu_v1 import authenticate_gate

SAMPLE_ID = "ai-cold-start-v7-v7-capacity-slot-163-tropical-forest-glade-v2"
ORDINAL = 17
PACKET_MAXIMUM = 2 * 1024**2
FINAL_RESERVE = 65536
SCHEMA = "qualification-parameter0-same-call-capture-v1"


def target_selected(sample, ordinal):
    return (type(ordinal) is int and ordinal == ORDINAL and type(sample) is dict
            and sample.get("sampleId") == SAMPLE_ID and sample.get("split") == "train")


def invoke_probe(probe, *args, capture=None, **kwargs):
    """The inactive path preserves the original arguments, result and exception."""
    if capture is None:
        return probe(*args, **kwargs)
    require(type(capture) is Parameter0ProbeCapture, "exact passive capture component required")
    return capture.call(probe, *args, **kwargs)


class BoundedPacketBuffer(io.BytesIO):
    def write(self, data):
        require(self.tell() + len(data) <= PACKET_MAXIMUM, "target packet ceiling before allocation")
        return super().write(data)


def encode_packet(packet):
    # Fixed-shape tensor dictionaries are validated by the original observer and
    # gate authentication before reaching here. No deserialization occurs.
    with BoundedPacketBuffer() as buffer:
        torch.save(packet, buffer)
        return buffer.getvalue()


def error_record(error):
    return {"type": type(error).__name__, "message": str(error)[:2048]}


class Parameter0ProbeCapture:
    def __init__(self, model, resource, *, sample, ordinal):
        require(target_selected(sample, ordinal), "exact original ordinal17 train sample required")
        self.model, self.sample, self.ordinal = model, sample, ordinal
        self.observer = Target0Observation(model, resource)
        self.used, self.persisted, self.primary = False, False, None
        self.callback_failure = None
        self.cleanup_errors = []

    def call(self, probe, *args, **kwargs):
        require(not self.used and len(args) >= 5 and args[0] is self.model
                and args[2] is self.sample, "single original probe/model/sample required")
        self.used = True
        original_event = kwargs.get("event")
        require(original_event is None or callable(original_event), "original event callback required")

        def event(stage, kind, gradients=None):
            # Preserve the original counter/timing/safety callback. Its failure
            # takes precedence and does not run the observation callback.
            if original_event is not None:
                original_event(stage, kind, gradients)
            try:
                self.observer.event(stage, kind, gradients)
            except BaseException as error:
                self.callback_failure = error_record(error)
                raise

        try:
            self.observer.__enter__()
            return probe(*args, **{**kwargs, "event": event})
        except BaseException as error:
            self.primary = error
            raise
        finally:
            # Cleanup also runs when observer entry or the original probe fails.
            # An established first exception always survives a cleanup failure.
            try:
                self.observer.__exit__(type(self.primary) if self.primary else None,
                    self.primary, self.primary.__traceback__ if self.primary else None)
            except BaseException as cleanup:
                if self.primary is None:
                    self.primary = cleanup
                    raise
                self.cleanup_errors.append(error_record(cleanup))

    def persist_failure(self, error, *, primary_binding, identity, programs,
                        actual_counts, attempted_sample, write, resource):
        """Supplement an already committed original failure; never replace it.

        write(name, value) is the caller's same-execution exclusive writer and
        must return its verified path/SHA binding. This component does not
        authenticate an execution package or make its writer authoritative.
        """
        require(self.used and not self.persisted and error is self.primary,
                "one same-call primary failure required")
        require(type(primary_binding) is dict and set(primary_binding) == {"path", "sha256"},
                "committed original failure binding required")
        self.persisted = True
        result = dict(schemaVersion=SCHEMA, status="incomplete", originalError=error_record(error),
            primaryFailure=deepcopy(primary_binding), identity=deepcopy(identity),
            sampleId=SAMPLE_ID, sampleOrdinal=ORDINAL, actualCounts=deepcopy(actual_counts),
            optimizerUpdates=0, artifacts={}, secondaryErrors=[],
            failureClassification="unverified_probe_or_observation_failure",
            qualificationGranted=False, scope="same_call_target_evidence_only")
        used = 0

        def put(name, value, *, final=False):
            nonlocal used
            size = len(value) if type(value) is bytes else len(
                (json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True) + "\n").encode())
            require(size <= (FINAL_RESERVE if final else PACKET_MAXIMUM)
                    and used + size <= PACKET_MAXIMUM - (0 if final else FINAL_RESERVE),
                    "aggregate target evidence/terminal reserve exhausted")
            binding = write(name, value)
            require(type(binding) is dict and set(binding) == {"path", "sha256"},
                    "exclusive writer binding required")
            used += size
            return binding

        try:
            result["artifacts"]["original"] = put("qualification-target0-original.json", result)
            resource()
            gate = authenticate_gate(error, self.observer, programs)
            result["originalGate"] = gate
            result["failureClassification"] = "authenticated_original_parameter0_gate"
            # Save all five authenticated targets before compact selection or
            # local-reference computation can fail. This is not an all-model log.
            raw = {"gradient." + label: self.observer.raw[i] for i, label in enumerate(LABELS)}
            require(self.observer.bytes + 2 * PACKET_MAXIMUM <= MAX_CAPTURE,
                    "capture/raw serialization workspace exceeds original ceiling")
            raw_bytes = encode_packet(raw)
            result["artifacts"]["gradients"] = put("qualification-target0-gradients.pt", raw_bytes)
            del raw_bytes
            result["gradientDescriptors"] = {name: {"shape": list(value.shape),
                "dtype": str(value.dtype), "sha256": sha(value)} for name, value in raw.items()}
            result["status"] = "target_gradients_saved"
            result["artifacts"]["gradientManifest"] = put("qualification-target0-gradients.json", {
                "primaryFailure": primary_binding, "originalGate": gate,
                "packet": result["artifacts"]["gradients"], "descriptors": result["gradientDescriptors"]})
            require(not self.callback_failure and not self.cleanup_errors
                    and self.observer.observation_error is None
                    and not attempted_sample.get("secondaryProbeErrors"),
                    "observation/probe invariants incomplete; retain original target values only")
            resource()
            workspace = (5 * math.prod(TARGET0_SHAPE) * 8 + 3 * math.prod(TARGET0_SHAPE) * 4
                + 6 * math.prod(TARGET0_SPATIAL) * 4 + 8 * math.prod(TARGET0_SPATIAL) * 8 + 65536)
            require(self.observer.bytes + workspace + 2 * PACKET_MAXIMUM <= MAX_CAPTURE,
                    "capture/compact/serialization workspace exceeds original ceiling")
            packet, metadata = self.observer.compact()
            require(metadata.get("productionGeometry") is True, "exact production target geometry required")
            encoded = encode_packet(packet)
            result["artifacts"]["localPacket"] = put("qualification-target0-local.pt", encoded)
            del encoded
            result["artifacts"]["localManifest"] = put("qualification-target0-local.json", {
                "primaryFailure": primary_binding, "originalGate": gate,
                "packet": result["artifacts"]["localPacket"], "metadata": metadata})
            result["status"] = "local_planes_saved"
            resource()
            comparison = contrast(packet, metadata, resource)
            result["comparison"] = comparison
            result["status"] = ("nonfinite_sum_evidence_complete" if comparison.get("componentSumFinite") is False
                                else "target_evidence_complete")
        except BaseException as secondary:
            result["secondaryErrors"].append(error_record(secondary))
            result["incompleteAt"] = result["status"]
            result["status"] = "incomplete"
        result["callbackFailure"] = self.callback_failure
        result["cleanupErrors"] = list(self.cleanup_errors)
        result["observerError"] = self.observer.observation_error
        try:
            result["manifest"] = put("qualification-target0-result.json", result, final=True)
        except BaseException as secondary:
            result["secondaryErrors"].append(error_record(secondary))
            result["status"] = "incomplete"
        return result
