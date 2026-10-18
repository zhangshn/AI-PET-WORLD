"""Diagnostic-only Run storage. No model calls, training admission, or replay.

The authenticated worker owns execution eligibility and safety guards. This sink
independently re-reads bound bytes and meters the existing physical Run roots.
Ordinary diagnostic failures disable further captures and become secondary facts;
they never replace the training exception. The unchanged v1 observer only encodes
the detached CPU frame in memory; its proposal JSON is never published as a record.
"""

from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re

from ai_painter.complete_world import object_support_structure_failure_capture_v1 as files
from ai_painter.complete_world import training_preview_observer_v1 as memory


POLICY_PATH = "data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v2.json"
POLICY_SCHEMA = "ai-painter-training-preview-observation-policy-v2"
POLICY_V3_PATH = "data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v3.json"
FINAL_RGB_CAPABILITY = "stage4_mvp256_dry_final_rgb_base_weight_quality24_v1"
FINAL_RGB_MODEL_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_final_rgb_base_weight_precision_v1"
FINAL_RGB_RUN_PREFIX = ".runtime/ai-painter/final-rgb-base-weight-quality-executions/"
POLICY_V4_PATH = "data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v4.json"
POLICY_V5_PATH = "data/ai-painter/system-governance/ai-painter-training-preview-observation-policy-v5.json"
JOINT_CAPABILITY = "stage4_mvp256_dry_joint_object_priority_quality24_v1"
JOINT_RUN_PREFIX = ".runtime/ai-painter/joint-object-priority-quality-executions/"
RECORD_SCHEMA = "training-preview-diagnostic-record-v1"
MANIFEST_SCHEMA = "training-preview-diagnostic-manifest-v1"
MANIFEST_MAX = 16 * 1024
JSON_MAX = 2 * 1024 * 1024
RUN_PREFIX = ".runtime/ai-painter/object-support-structure-quality-executions/"
COMPONENT_PATH = "ml/ai-painter/src/ai_painter/complete_world/training_preview_observer_v1.py"
STORAGE_PATH = "ml/ai-painter/src/ai_painter/complete_world/training_preview_storage_v1.py"
_RESERVES = memory.CAPTURE_RESERVED_BYTES + memory.CAPTURE_METADATA_RESERVED_BYTES + memory.TERMINAL_RESERVED_BYTES


class _BudgetExhausted(ValueError):
    pass


class _PublicationIncomplete(Exception):
    def __init__(self, original):
        self.original = original


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def canonical(value):
    """Same canonical bytes as existing checkpoint.configuration_digest."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def _digest(raw):
    return hashlib.sha256(raw).hexdigest()


def _binding(value):
    _require(type(value) is dict and set(value) == {"path", "sha256"}, "exact path/SHA binding required")
    _require(type(value["path"]) is str and type(value["sha256"]) is str
             and re.fullmatch(r"[a-f0-9]{64}", value["sha256"]), "binding types/digest")
    return deepcopy(value)


def _source_binding(value):
    # Existing source carriers may include channel/image metadata beside the SHA.
    _require(type(value) is dict and {"path", "sha256"} <= set(value), "bound source carrier required")
    return _binding({key: value[key] for key in ("path", "sha256")})


def _strict(raw):
    def pairs(rows):
        result = {}
        for key, value in rows:
            _require(key not in result, "duplicate JSON member")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite JSON")))


def _as_binding(value):
    return {"path": value.logical_path, "sha256": value.sha256}


class TrainingPreviewStorage:
    """Single authenticated Run, single-threaded worker use, no resume/adoption.

    Construction failures must be handled as optional-preview setup failures by
    the worker. ``capture`` and ``finish`` catch ordinary preview exceptions;
    KeyboardInterrupt/SystemExit and the worker's external safety guard propagate.
    ``should_capture`` must precede a GPU->CPU copy in the future worker hook.
    """

    def __init__(self, root, *, policy, plan, execution_package, output_roots=None,
                 maximum_output_bytes=memory.TOTAL_BYTES):
        _require(type(maximum_output_bytes) is int and 0 < maximum_output_bytes <= memory.TOTAL_BYTES,
                 "existing execution byte ceiling")
        self.mapping = files.RuntimeMap.current(Path(root))
        self.policy_binding, self.plan_binding, self.package_binding = map(_binding, (policy, plan, execution_package))
        routes = {POLICY_PATH: (POLICY_SCHEMA, RUN_PREFIX),
                  POLICY_V3_PATH: ("ai-painter-training-preview-observation-policy-v3", FINAL_RGB_RUN_PREFIX),
                  POLICY_V4_PATH: ("ai-painter-training-preview-observation-policy-v4", JOINT_RUN_PREFIX),
                  POLICY_V5_PATH: ("ai-painter-training-preview-observation-policy-v5", JOINT_RUN_PREFIX)}
        _require(self.policy_binding["path"] in routes, "registered exact preview policy path required")
        self.policy_schema, self.run_prefix = routes[self.policy_binding["path"]]
        self.policy = self._json(self.policy_binding)
        self.plan = self._json(self.plan_binding)
        self.package = self._json(self.package_binding)
        self._validate_registration()
        self.run_root = self.plan["outputRoot"]
        self.preview_root = self.run_root + "/training-previews"
        self.run_directory = self.mapping.path(self.run_root)
        self.run_identity = files._directory_identity(self.run_directory)
        self.directory = self.mapping.path(self.preview_root)
        _require(not self.directory.exists(), "preview directory already exists; no resume or historical adoption")
        roots = [self.run_root] if output_roots is None else output_roots
        _require(type(roots) in (list, tuple) and 1 <= len(roots) <= 32
                 and len(set(roots)) == len(roots), "owned accounting roots")
        for value in roots:
            _require(type(value) is str and value.startswith(".runtime/ai-painter/"), "owned accounting namespace")
            self.mapping.path(value)
        _require(any(self.run_root == r or self.run_root.startswith(r + "/") for r in roots), "Run outside accounting")
        _require(all(not a.startswith(b + "/") for a in roots for b in roots if a != b), "overlapping accounting roots")
        self.roots, self.maximum = tuple(roots), maximum_output_bytes
        self.observer = memory.TrainingPreviewObserver(enable_component_only=True)
        self.entries = []
        self.secondary_error = None
        self._directory_identity = None
        self._disabled = self._finished = False
        self._manifest = None
        self._failure_reference = None

    def _read(self, bound, maximum=JSON_MAX):
        return self.mapping.binding(_binding(bound), maximum=maximum)

    def _json(self, bound):
        value = _strict(self._read(bound))
        _require(type(value) is dict, "bound JSON object required")
        return value

    def _validate_registration(self):
        policy, plan, package = self.policy, self.plan, self.package
        _require(policy.get("schemaVersion") == self.policy_schema, "preview policy schema")
        if self.policy_binding["path"] == POLICY_V3_PATH:
            _require(plan.get("capabilityVersion") == FINAL_RGB_CAPABILITY
                     and plan.get("configuration", {}).get("modelCapabilityVersion") == FINAL_RGB_MODEL_CAPABILITY
                     and policy.get("scope", {}).get("capabilityVersion") == FINAL_RGB_CAPABILITY
                     and policy["scope"].get("modelCapabilityVersion") == FINAL_RGB_MODEL_CAPABILITY
                     and policy["scope"].get("outputRootPrefix") == FINAL_RGB_RUN_PREFIX,
                     "preview v3 exact final RGB identity/scope required")
        elif self.policy_binding["path"] in (POLICY_V4_PATH, POLICY_V5_PATH):
            _require(plan.get("capabilityVersion") == JOINT_CAPABILITY
                     and plan.get("configuration", {}).get("modelCapabilityVersion") == FINAL_RGB_MODEL_CAPABILITY
                     and policy.get("scope", {}).get("capabilityVersion") == JOINT_CAPABILITY
                     and policy["scope"].get("modelCapabilityVersion") == FINAL_RGB_MODEL_CAPABILITY
                     and policy["scope"].get("outputRootPrefix") == JOINT_RUN_PREFIX,
                     "preview exact joint identity/scope required")
        expected_capture = dict(split="train", ordinal=0, maxFramesPerEpoch=1, maxFrames=24,
                                maxFailureReferences=1, phase=memory.PHASE)
        _require(all(canonical(policy.get("capture", {}).get(k)) == canonical(v)
                     for k, v in expected_capture.items()), "preview policy capture boundary")
        expected_resources = dict(maxPreviewBytes=memory.PREVIEW_BYTES, maxPngBytes=memory.MAX_PNG_BYTES,
            maxMetadataBytes=memory.MAX_METADATA_BYTES, maxRecords=25,
            existingExecutionMaxBytes=memory.TOTAL_BYTES, reservedFailureTensorBytes=memory.CAPTURE_RESERVED_BYTES,
            reservedFailureMetadataBytes=memory.CAPTURE_METADATA_RESERVED_BYTES,
            reservedTerminalBytes=memory.TERMINAL_RESERVED_BYTES)
        _require(all(canonical(policy.get("resources", {}).get(k)) == canonical(v)
                     for k, v in expected_resources.items()), "preview policy resource boundary")
        configuration = plan["configuration"]
        _require(plan.get("trainingPreviewPolicy") == configuration.get("trainingPreviewPolicy") == self.policy_binding,
                 "plan and configuration must bind preview policy")
        _require(policy.get("recordContract", {}).get("schemaVersion") == RECORD_SCHEMA
                 and policy["recordContract"].get("purpose") == "not_reviewed_diagnostic_only"
                 and policy["recordContract"].get("falseFlags") == ["formalOutput", "checkpointSelectionEligible",
                     "qualificationEvidence", "runtimePublicationEligible"], "registered record ABI differs")
        _require(policy.get("manifestContract", {}).get("schemaVersion") == MANIFEST_SCHEMA
                 and policy["manifestContract"].get("maxBytes") == MANIFEST_MAX
                 and policy["manifestContract"].get("maxEntries") == 24
                 and policy["manifestContract"].get("terminalField") == "trainingPreviewManifest"
                 and policy["manifestContract"].get("progressField") == "latestTrainingPreview", "registered manifest ABI differs")
        _require(type(plan.get("runId")) is str and type(plan.get("packageId")) is str
                 and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", plan["runId"])
                 and re.fullmatch(r"[a-z0-9][a-z0-9-]{7,127}", plan["packageId"])
                 and plan["runId"] != plan["packageId"], "Run/package identity")
        _require(plan["outputRoot"] == self.run_prefix + plan["runId"]
                 and self.plan_binding["path"] == plan["outputRoot"] + "/quality-plan.json"
                 and self.package_binding["path"] == ".runtime/ai-painter/autonomous-closed-loop-packages/"
                     + plan["packageId"] + "/package.json", "Run/package output binding")
        _require(package.get("schemaVersion") == "ai-painter-autonomous-closed-loop-package-v1"
                 and package.get("packageIdentity") == plan["packageId"]
                 and package.get("capabilityVersion") == plan["capabilityVersion"], "package identity differs")
        inputs = package["inputEvidence"]
        _require(type(inputs) is list and all(b in inputs for b in (
            self.policy_binding, self.plan_binding, plan["modelBinding"], plan["datasetManifest"], plan["trainSplit"])),
            "package omits preview identity inputs")
        programs = plan["programBindings"]
        source_limit = 256
        if self.policy_binding["path"] == POLICY_V5_PATH:
            from ai_painter.complete_world import joint_object_priority_quality_checkpoint_v1 as execution
            execution_binding = _binding(configuration.get("executionPolicy"))
            _require(execution_binding == execution.POLICY and plan.get("executionPolicy") == execution_binding
                     and execution_binding in inputs, "preview v5 trusted execution policy v2 binding required")
            execution.validate_execution_policy(self._json(execution_binding), configuration)
            source_limit = 260
        _require(type(programs) is dict and 1 <= len(programs) <= source_limit
                 and package.get("programLineage") == {k: v["sha256"] for k, v in programs.items()},
                 "package program lineage")
        seen, byte_count = {}, 0
        for bound in programs.values():
            _binding(bound)
            _require(bound["path"] not in seen or seen[bound["path"]] == bound["sha256"], "program path alias differs")
            if bound["path"] not in seen:
                byte_count += len(self._read(bound, 1024 * 1024))
                _require(byte_count <= 16 * 1024 * 1024, "program closure byte ceiling")
                seen[bound["path"]] = bound["sha256"]
        policy_programs = policy["programBindings"]
        _require(type(policy_programs) is dict and all(b in programs.values() for b in policy_programs.values()),
                 "policy program closure differs")
        for logical, actual in ((COMPONENT_PATH, Path(memory.__file__)), (STORAGE_PATH, Path(__file__))):
            expected = {"path": logical, "sha256": _digest(actual.read_bytes())}
            _require(expected in policy_programs.values() and expected in programs.values(),
                     "actual loaded preview source not bound in policy and plan")
        implementations = policy["implementationPaths"]
        _require(implementations.get("storage") == STORAGE_PATH, "storage implementation path differs")
        _require(any(b["path"] == implementations["storageTests"] for b in policy_programs.values()),
                 "policy omits storage test source binding")
        _require(all(any(b["path"] == implementations[role] for b in programs.values()) for role in
                     ("storage", "storageTests", "producerProfile", "producerWorker", "historyAdapter")),
                 "fresh candidate omits actual preview producer/storage/reader source")
        model = self._json(plan["modelBinding"])
        _require(model["capabilityVersion"] == plan["capabilityVersion"]
                 and model["modelCapabilityVersion"] == configuration["modelCapabilityVersion"], "model metadata identity")
        manifest = self._json(plan["datasetManifest"])
        self.source_index_binding = _source_binding(manifest["sourceIndex"])
        self._json(self.source_index_binding)
        ids = self._json(plan["trainSplit"])["sampleIds"]
        _require(type(ids) is list and len(ids) == len(set(ids)) == 48, "fixed train split")
        self.train_ids = tuple(ids)

    def _stable(self):
        self.mapping.check()
        _require(files._directory_identity(self.mapping.path(self.run_root)) == self.run_identity, "Run directory changed")
        path = self.mapping.path(self.preview_root)
        if self._directory_identity is not None:
            _require(files._directory_identity(path) == self._directory_identity, "preview directory changed")
        else:
            _require(not path.exists(), "unexpected preview directory")

    def _directory(self):
        self._stable()
        if self._directory_identity is None:
            self.directory.mkdir(exist_ok=False)
            self._directory_identity = files._directory_identity(self.directory)
        self._stable()

    def measured_bytes(self):
        self._stable()
        return (sum(files.directory_bytes(self.mapping.path(r)) for r in self.roots),
                files.directory_bytes(self.mapping.path(self.preview_root)))

    def _budget(self, additional, *, tail=MANIFEST_MAX + memory.MAX_METADATA_BYTES):
        used, preview = self.measured_bytes()
        # finish() irreversibly closes captures. Its only remaining operations are
        # bounded reference/manifest publication after the worker's loop/capture
        # sink returned. Existing failure bytes are already in `used`; reserving
        # the full capture capacity again would count that responsibility twice.
        reserved = memory.TERMINAL_RESERVED_BYTES if self._finished else _RESERVES
        if used + additional + tail + reserved > self.maximum:
            raise _BudgetExhausted("execution reserves unavailable")
        if preview + additional + tail > memory.PREVIEW_BYTES:
            raise _BudgetExhausted("preview byte ceiling")

    def _atomic(self, logical, raw, *, tail):
        _require(type(raw) is bytes and logical.startswith(self.preview_root + "/"), "owned preview output")
        if self._finished:
            terminal_limits = {self.preview_root + "/manifest.json": MANIFEST_MAX,
                               self.preview_root + "/failure-reference.json": memory.MAX_METADATA_BYTES}
            _require(logical in terminal_limits and len(raw) <= terminal_limits[logical],
                     "closed capture phase permits only bounded terminal metadata")
        self._directory()
        self._budget(2 * len(raw), tail=tail)
        target = self.mapping.path(logical)
        pending = self.mapping.path(logical + ".pending")
        created = False
        try:
            with pending.open("xb") as stream:
                created = True
                _require(stream.write(raw) == len(raw), "short preview write")
                stream.flush()
                os.fsync(stream.fileno())
            self._stable()
            self._budget(len(raw), tail=tail)
            os.link(pending, target)  # Existing capture manifest pattern: never overwrite.
            self._stable()
            bound = {"path": logical, "sha256": _digest(raw)}
            self._read(bound, max(MANIFEST_MAX, memory.MAX_PNG_BYTES))
            _require(files._file_identity(pending.stat(), include_ctime=False)
                     == files._file_identity(target.stat(), include_ctime=False), "staged/final identity differs")
            pending.unlink()  # Only a successful, verified private staging link.
            self._stable()
            return bound
        except _BudgetExhausted:
            raise
        except Exception as error:
            if created:
                raise _PublicationIncomplete(error) from error
            raise

    def _fail(self, error, availability_code="capture_failed"):
        if isinstance(error, _BudgetExhausted):
            availability_code = "budget_exhausted"
        elif isinstance(error, _PublicationIncomplete):
            availability_code, error = "publication_incomplete", error.original
        self._disabled = True
        if self.secondary_error is None:
            try:
                message = str(error)[:256]
            except Exception:
                message = "preview exception formatting failed"
            self.secondary_error = {"errorType": type(error).__name__, "message": message,
                                    "availabilityCode": availability_code,
                                    "impact": "preview_unavailable_training_first_error_unchanged"}

    def _identity(self, identity, world_id, tick):
        _require(type(identity) is memory.PreviewIdentity, "preview identity type")
        identity.validate()
        plan = self.plan
        _require(identity.run_id == plan["runId"] and identity.package_id == plan["packageId"]
                 and identity.capability_version == plan["capabilityVersion"]
                 and identity.model_capability_version == plan["configuration"]["modelCapabilityVersion"], "preview Run identity")
        for actual, expected in ((identity.execution_package, self.package_binding), (identity.plan, self.plan_binding),
                                 (identity.model, plan["modelBinding"]), (identity.dataset_manifest, plan["datasetManifest"])):
            _require(_as_binding(actual) == expected, "preview immutable identity binding")
        _require(identity.configuration_sha256 == _digest(canonical(plan["configuration"]))
                 and identity.program_bindings_sha256 == _digest(canonical(plan["programBindings"])), "preview configuration/program digest")
        _require(self.train_ids[identity.train_index] == identity.sample_id, "actual train sample index")
        for bound in (self.policy_binding, self.plan_binding, self.package_binding):
            self._read(bound)
        rows = self._json(self.source_index_binding)["samples"]
        selected = [r for r in rows if r.get("sampleId") == identity.sample_id]
        _require(len(selected) == 1 and selected[0]["split"] == "train", "source sample identity")
        row = selected[0]
        _require(_source_binding(row["image"]) == _as_binding(identity.source_rgb)
                 and _source_binding(row["conditionPack"]) == _as_binding(identity.condition_pack), "source RGB/condition binding")
        self._read(_source_binding(row["image"]), memory.TOTAL_BYTES // 2)
        pack = self._json(_source_binding(row["conditionPack"]))
        contribution = self._json(_source_binding(row["contribution"]))
        task_binding = {"path": contribution["taskPackagePath"], "sha256": contribution["taskPackageSha256"]}
        task = self._json(task_binding)
        _require(type(world_id) is str and world_id and type(tick) is int and 0 <= tick <= 2**53 - 1
                 and pack["worldId"] == task["worldId"] == world_id and pack["tick"] == task["tick"] == tick
                 and pack["sourceBindings"]["taskPackagePath"] == task_binding["path"], "world/tick/task identity")
        facts = {"path": task["sourceBindings"]["naturalizedWorldFactsPath"],
                 "sha256": task["sourceBindings"]["naturalizedWorldFactsSha256"]}
        _require(facts == _as_binding(identity.world_facts), "WorldFacts binding")
        self._read(facts)

    def should_capture(self, identity):
        if self._disabled or self._finished:
            return False
        try:
            return self.observer.should_capture(identity)
        except Exception as error:
            self._fail(error, "binding_mismatch")
            return False

    def capture(self, detached_cpu_frame, identity, *, world_id, tick):
        """Return progress.latestTrainingPreview entry only after the JSON commit."""
        if not self.should_capture(identity):
            return None
        failure_code = "binding_mismatch"
        try:
            self._identity(identity, world_id, tick)
            failure_code = "capture_failed"
            # Legacy counter bounds memory artifacts, not differently-sized ABI records.
            # The physical directory meter above independently owns all disk quotas.
            artifact = self.observer.observe(detached_cpu_frame, identity, memory.BudgetSnapshot(0))
            image_path = self.run_root + "/" + artifact.png_path
            image = {"path": image_path, "sha256": _digest(artifact.png), "bytes": len(artifact.png)}
            record = dict(schemaVersion=RECORD_SCHEMA, purpose="not_reviewed_diagnostic_only",
                formalOutput=False, checkpointSelectionEligible=False, qualificationEvidence=False,
                runtimePublicationEligible=False, runId=identity.run_id, packageId=identity.package_id,
                capabilityVersion=identity.capability_version, modelCapabilityVersion=identity.model_capability_version,
                policy=self.policy_binding, plan=self.plan_binding, executionPackage=self.package_binding,
                modelBinding=_as_binding(identity.model), datasetManifest=_as_binding(identity.dataset_manifest),
                sourceRgb=_as_binding(identity.source_rgb), conditionPack=_as_binding(identity.condition_pack),
                worldFacts=_as_binding(identity.world_facts), configurationSha256=identity.configuration_sha256,
                programBindingsSha256=identity.program_bindings_sha256, worldId=world_id, tick=tick,
                split="train", sampleId=identity.sample_id, epoch=identity.epoch, trainOrdinal=identity.train_ordinal,
                trainIndex=identity.train_index, optimizerSteps=dict(generator=identity.generator_updates,
                discriminator=identity.discriminator_updates), phase=identity.phase,
                forwardSequence=identity.forward_sequence, image=image)
            raw = canonical(record) + b"\n"
            if len(raw) > memory.MAX_METADATA_BYTES:
                raise _BudgetExhausted("record byte ceiling")
            self._budget(max(2 * len(artifact.png), len(artifact.png) + 2 * len(raw)))
            committed_image = self._atomic(image_path, artifact.png, tail=MANIFEST_MAX + memory.MAX_METADATA_BYTES)
            failure_code = "publication_incomplete"
            committed_record = self._atomic(self.run_root + "/" + artifact.metadata_path, raw,
                                           tail=MANIFEST_MAX + memory.MAX_METADATA_BYTES)
            entry = {"record": committed_record, "image": committed_image}
            self.entries.append(entry)
            return deepcopy(entry)
        except Exception as error:
            self._fail(error, failure_code)
            return None

    def finish(self, *, training_error=None, failure_position=None):
        """After worker loop/capture completion, close captures and publish once.

        No caller boolean releases a quota. This irreversible method transition
        only allows bounded terminal JSON; actual capture bytes stay accounted,
        and the existing worker terminal reserve and both output ceilings remain.
        """
        if self._finished:
            return deepcopy(self._manifest)
        self._finished = True
        failure_code = "binding_mismatch"
        try:
            for entry in self.entries:
                self._read(entry["image"], memory.MAX_PNG_BYTES)
                self._read(entry["record"], memory.MAX_METADATA_BYTES)
            if training_error is not None and self.entries:
                try:
                    _require(type(failure_position) is dict and set(failure_position) ==
                             {"epoch", "zeroBasedEpochPosition", "trainIndex", "sampleId"}, "actual failure position required")
                    epoch, ordinal, index = (failure_position[k] for k in ("epoch", "zeroBasedEpochPosition", "trainIndex"))
                    captured = self._json(self.entries[-1]["record"])
                    _require(type(epoch) is int and 1 <= epoch <= 24 and type(ordinal) is int and 0 <= ordinal < 48
                             and type(index) is int and 0 <= index < 48
                             and failure_position["sampleId"] == self.train_ids[index]
                             and (epoch, ordinal) >= (captured["epoch"], captured["trainOrdinal"]),
                             "failure position does not follow committed capture")
                    reference = dict(schemaVersion="training-preview-diagnostic-failure-reference-v1",
                        runId=self.plan["runId"], packageId=self.plan["packageId"], policy=self.policy_binding,
                        plan=self.plan_binding, capture=self.entries[-1], failurePosition=deepcopy(failure_position),
                        imageIsFailureForward=False, regenerated=False)
                    failure_code = "capture_failed"
                    raw = canonical(reference) + b"\n"
                    if len(raw) > memory.MAX_METADATA_BYTES:
                        raise _BudgetExhausted("failure reference byte ceiling")
                    self._failure_reference = self._atomic(self.preview_root + "/failure-reference.json", raw, tail=MANIFEST_MAX)
                except Exception as error:
                    self._fail(error, failure_code)
            failure_code = "capture_failed"
            manifest = dict(schemaVersion=MANIFEST_SCHEMA, runId=self.plan["runId"], packageId=self.plan["packageId"],
                policy=self.policy_binding, plan=self.plan_binding, entries=deepcopy(self.entries))
            if self._failure_reference is not None:
                manifest["failureReference"] = self._failure_reference
            if self.secondary_error is not None:
                manifest["secondaryError"] = self.secondary_error
            raw = canonical(manifest) + b"\n"
            if len(raw) > MANIFEST_MAX or len(self.entries) > 24:
                raise _BudgetExhausted("terminal preview manifest ceiling")
            self._manifest = self._atomic(self.preview_root + "/manifest.json", raw, tail=0)
            return deepcopy(self._manifest)
        except Exception as error:
            self._fail(error, failure_code)
            return None
