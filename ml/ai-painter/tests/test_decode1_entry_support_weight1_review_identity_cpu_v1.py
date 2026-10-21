"""Pure metadata review/GPU-proof routing; no models, samples, tensor math or writes."""
import ast
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

ROOT = Path(__file__).absolute().parents[3]
SCRIPTS = ROOT / "ml/ai-painter/scripts"
REVIEW = SCRIPTS / "decode1_entry_weight_quality_review_v1.py"
WORKER = SCRIPTS / "painter_stage4_decode1_entry_weight_quality_worker_v1.py"
POLICY = ROOT / "data/ai-painter/system-governance/ai-painter-decode1-entry-weight-quality-execution-policy-v8.json"
NEW = "stage4_mvp256_dry_decode1_support_structure_weight1_v1"
MODEL = "stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1"


def require(ok, message):
    if not ok:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()


def functions(path, names, namespace):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    body = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert {node.name for node in body} == set(names)
    exec(compile(ast.Module(body=body, type_ignores=[]), str(path), "exec"), namespace)
    return namespace


class MetadataReader:
    root = "in-memory-only"

    def __init__(self):
        self.files = {}
        self.reads = []

    def put(self, name, value):
        raw = value if type(value) is bytes else canonical(value)
        self.files[name] = raw
        return {"path": name, "sha256": hashlib.sha256(raw).hexdigest()}

    def read(self, binding):
        self.reads.append(binding["path"])
        return self.files[binding["path"]]


def fixture(*, policy_weight=1, configuration_weight=1, policy_model=MODEL, wrong_source=False):
    reader = MetadataReader()
    rows, diagnostics = [], []
    order = ["channel-" + str(i) for i in range(23)]
    ids = ["synthetic-" + str(i) for i in range(48, 56)]
    for i in range(64):
        sid = "synthetic-" + str(i)
        row = {"sampleId": sid, "split": "validation" if sid in ids else "train"}
        if sid in ids:
            image = reader.put(sid + "/image-bytes", b"synthetic metadata placeholder, not an image")
            condition = reader.put(sid + "/condition", {"channels": [{"id": c} for c in order], "objectInstanceTable": []})
            facts = reader.put(sid + "/facts", b"synthetic WorldFacts identity placeholder")
            task = reader.put(sid + "/task", {"sourceBindings": {
                "naturalizedWorldFactsPath": facts["path"], "naturalizedWorldFactsSha256": facts["sha256"]}})
            row.update(image=image, conditionPack=condition)
            diagnostics.append({"sampleId": sid, "identity": {"image": image, "conditionPack": condition,
                "channels": [{"id": c} for c in order], "taskPackage": task, "factHash": facts["sha256"]}})
        rows.append(row)
    old_index = reader.put("parent-index", {"samples": rows})
    new_index = reader.put("new-index", {"samples": rows})
    parent_manifest = reader.put("parent-manifest", {"sourceIndex": old_index})
    parent_candidate = reader.put("parent-candidate", {"frozenBindings": {"datasetManifest": parent_manifest}})
    parent_diagnostic = reader.put("parent-diagnostic", {"rows": diagnostics})
    old_split, new_split = [reader.put(name, {"sampleIds": ids}) for name in ("old-validation", "new-validation")]
    manifest = reader.put("new-manifest", {"schemaVersion": "ai-painter-stage4-source-correction-release-v1",
        "sourceIndex": new_index, "identityPayload": {"parentDatasetRelease": parent_manifest, "channelOrder": order}})
    diagnostic = reader.put("new-diagnostic", {"datasetManifest": manifest, "rows": diagnostics,
        "derivation": {"parentDiagnostic": parent_diagnostic}})
    candidate = reader.put("new-candidate", {"parentCandidate": parent_candidate, "frozenBindings": {
        "datasetManifest": manifest, "validationSplit": new_split, "trainingDiagnostic": diagnostic}})
    specification = reader.put("spec-1.112", b"AI-PAINTER-SPEC-1.112\n15.5.1\n15.6\n")
    review_spec = reader.put("review-spec", b"11.12")
    policy = reader.put("policy-v8", {"candidate": NEW, "modelCapability": policy_model,
        "sourceCandidate": parent_candidate if wrong_source else candidate, "objectSupportStructureWeight": policy_weight})
    route = SimpleNamespace(specification=specification, execution_policy=policy)
    reproduce = Mock(side_effect=lambda metadata, binding: metadata.json(binding))
    namespace = {"require": require, "hashlib": hashlib, "decode": json.loads,
        "exact_binding": lambda binding: require(set(binding) == {"path", "sha256"}, "exact binding required"),
        "CURRENT_SPECIFICATION": reader.put("legacy-spec", b"15.5.1"), "CURRENT_REVIEW_SPECIFICATION": review_spec,
        "auth": SimpleNamespace(Reader=lambda root: reader, execution_route=lambda capability: route,
            MODEL_CAPABILITY=MODEL, reproduce_diagnostic=reproduce, canonical=canonical)}
    functions(REVIEW, ("read_bytes", "read_json", "baseline_comparison_identity"), namespace)
    plan = {"capabilityVersion": NEW, "configuration": {"objectSupportStructureWeight": configuration_weight},
        "formalSpecification": specification, "executionPolicy": policy, "sourceCandidate": candidate,
        "datasetManifest": manifest, "validationSplit": new_split}
    package = {"candidateContract": parent_candidate, "datasetManifest": parent_manifest, "validationSplit": old_split}
    return reader, namespace, plan, package, reproduce


class ReviewIdentityTests(unittest.TestCase):
    def test_registered_policy_names_and_current_specification_bytes_are_compatible(self):
        policy = json.loads(POLICY.read_bytes())
        self.assertEqual(policy["candidate"], NEW)
        self.assertEqual(policy["modelCapability"], MODEL)
        self.assertIs(type(policy["objectSupportStructureWeight"]), int)
        self.assertEqual(policy["objectSupportStructureWeight"], 1)
        self.assertEqual(policy["formalSpecification"]["version"], "AI-PAINTER-SPEC-1.112")
        specification = (ROOT / policy["formalSpecification"]["path"]).read_bytes()
        self.assertEqual(hashlib.sha256(specification).hexdigest(), policy["formalSpecification"]["sha256"])
        self.assertIn(b"15.5.1", specification)
        self.assertIn(b"15.6", specification)
        self.assertEqual(policy["sourceCandidate"]["path"],
            "data/ai-painter/system-governance/stage4-mvp256-dry-source-corrected-candidate-v1.json")
        self.assertEqual(policy["executionProfile"], "completion_decode1_support_structure_weight1_v1")

    def test_new_identity_reaches_complete_original_parent_and_eight_validation_checks(self):
        reader, namespace, plan, package, reproduce = fixture()
        result = namespace["baseline_comparison_identity"](reader, plan, package)
        self.assertEqual(result["mode"], "published_train_correction_direct_parent_same_validation_v1")
        self.assertEqual(len(result["validation"]), 8)
        self.assertFalse(result["qualificationGranted"])
        reproduce.assert_called_once()
        self.assertIn("parent-diagnostic", reader.reads)
        for row in result["validation"]:
            self.assertIn(row["image"]["path"], reader.reads)
            self.assertIn(row["conditionPack"]["path"], reader.reads)
            self.assertIn(row["worldFacts"]["path"], reader.reads)

    def test_policy_and_configuration_require_integer_one_not_bool_or_float(self):
        for key in ("policy_weight", "configuration_weight"):
            for value in (True, False, 1.0, .1, 0, 2, "1", None):
                reader, namespace, plan, package, reproduce = fixture(**{key: value})
                with self.subTest(key=key, value=value), self.assertRaisesRegex(ValueError, "same-model support weight1"):
                    namespace["baseline_comparison_identity"](reader, plan, package)
                reproduce.assert_not_called()

    def test_wrong_source_or_model_rejected_before_parent_reproduction(self):
        for overrides in ({"wrong_source": True}, {"policy_model": MODEL + "-foreign"}):
            reader, namespace, plan, package, reproduce = fixture(**overrides)
            with self.subTest(overrides=overrides), self.assertRaisesRegex(ValueError, "same-model support weight1"):
                namespace["baseline_comparison_identity"](reader, plan, package)
            reproduce.assert_not_called()

    def test_wrong_specification_binding_or_missing_new_section_rejected(self):
        for kind in ("foreign", "missing-section", "changed-bytes"):
            reader, namespace, plan, package, reproduce = fixture()
            if kind == "foreign":
                plan["formalSpecification"] = reader.put("foreign-spec", b"15.5.1 15.6")
            elif kind == "missing-section":
                specification = reader.put("spec-without-15.6", b"15.5.1")
                plan["formalSpecification"] = specification
                namespace["auth"].execution_route = lambda capability: SimpleNamespace(
                    specification=specification, execution_policy=plan["executionPolicy"])
            else:
                reader.files[plan["formalSpecification"]["path"]] += b"changed"
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, "specification differs|source SHA differs"):
                namespace["baseline_comparison_identity"](reader, plan, package)
            reproduce.assert_not_called()

    def test_original_parent_and_validation_guards_still_reject(self):
        for kind in ("parent-candidate", "parent-dataset", "validation-order", "validation-row", "image-bytes"):
            reader, namespace, plan, package, reproduce = fixture()
            if kind == "parent-candidate":
                package["candidateContract"] = plan["sourceCandidate"]
            elif kind == "parent-dataset":
                package["datasetManifest"] = plan["datasetManifest"]
            elif kind == "validation-order":
                package["validationSplit"] = reader.put("foreign-validation", {"sampleIds": ["foreign"] * 8})
            elif kind == "validation-row":
                value = json.loads(reader.files["new-diagnostic"])
                value["rows"][0]["identity"]["factHash"] = "0" * 64
                reproduce.side_effect = lambda metadata, binding: value
            else:
                reader.files["synthetic-48/image-bytes"] += b"changed"
            message = {"parent-candidate": "candidate is not the direct parent", "parent-dataset": "dataset is not the direct parent",
                "validation-order": "membership/order changed", "validation-row": "validation row changed",
                "image-bytes": "source SHA differs"}[kind]
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, message):
                namespace["baseline_comparison_identity"](reader, plan, package)


class GpuWeightProofTests(unittest.TestCase):
    def fixture(self):
        plan = {"capabilityVersion": NEW, "outputRoot": "metadata-run", "runId": "metadata-run",
            "packageId": "metadata-package", "programBindings": {"a": "bound"},
            "configuration": {"objectSupportStructureWeight": 1}, "trainSplit": {"path": "split"},
            "modelBinding": {"path": "model"}}
        binding = {"path": "package", "sha256": "a" * 64}
        cases = [{"sampleId": "synthetic-" + str(i), "passed": True, "proof": {
            "callCounts": {"generatorForwards": 1, "generatorForwardCompleted": 1,
                "generatorAutograd": 5, "discriminatorAutograd": 1}, "optimizerCreated": False,
            "optimizerUpdates": 0, "fiveGradientFacts": {"objectSupportStructureWeight": 1}}} for i in range(48)]
        gate = {"schema": "metadata-gpu-schema", "status": "passed", "capabilityVersion": NEW,
            "executionProfile": "metadata-profile", "runId": plan["runId"], "packageId": plan["packageId"],
            "executionPackage": binding, "programBindings": plan["programBindings"],
            "actualCounts": {kind + suffix: count for kind, count in (("forward", 48), ("generator", 240),
                ("discriminator", 48)) for suffix in ("Attempted", "Completed")},
            "deviceIdentity": {"ordinal": 0, "uuid": "metadata-uuid"}, "cases": cases,
            "optimizerSteps": 0, "checkpointLoaded": False, "checkpointWritten": False,
            "initialState": {"g": "state"}, "finalState": {"g": "state"}, "initialCpuState": {"g": "initial"}}
        records = {"metadata-run/gpu-gate.json": gate,
            "split": {"sampleIds": [r["sampleId"] for r in cases]}, "model": {"initialState": gate["initialCpuState"]}}
        namespace = {"require": require, "GPU_SCHEMA": gate["schema"], "_gpu_uuid": lambda value: (value, value),
            "auth": SimpleNamespace(read_json=lambda reader, bound: records[bound["path"]],
                same_json=lambda a, b: canonical(a) == canonical(b),
                execution_route=lambda capability: SimpleNamespace(profile="metadata-profile"))}
        functions(WORKER, ("verify_gpu_gate",), namespace)
        return namespace, plan, binding, {"path": "metadata-run/gpu-gate.json"}, gate

    def test_complete_forty_eight_integer_one_proofs_pass(self):
        namespace, plan, binding, gate_binding, gate = self.fixture()
        self.assertIs(namespace["verify_gpu_gate"](None, plan, binding, gate_binding), gate)

    def test_first_middle_and_last_proof_cannot_omit_forge_or_bool_weight(self):
        for index in (0, 23, 47):
            for value in (True, 1.0, .1, 0, None):
                namespace, plan, binding, gate_binding, gate = self.fixture()
                gate["cases"][index]["proof"]["fiveGradientFacts"]["objectSupportStructureWeight"] = value
                with self.subTest(index=index, value=value), self.assertRaisesRegex(ValueError, "all48 samples"):
                    namespace["verify_gpu_gate"](None, plan, binding, gate_binding)
        namespace, plan, binding, gate_binding, gate = self.fixture()
        del gate["cases"][47]["proof"]["fiveGradientFacts"]
        with self.assertRaisesRegex(ValueError, "all48 samples"):
            namespace["verify_gpu_gate"](None, plan, binding, gate_binding)

    def test_plan_bool_and_incomplete_old_gate_are_rejected(self):
        for kind in ("bool", "float", "missing-case", "wrong-run"):
            namespace, plan, binding, gate_binding, gate = self.fixture()
            if kind == "bool": plan["configuration"]["objectSupportStructureWeight"] = True
            elif kind == "float": plan["configuration"]["objectSupportStructureWeight"] = 1.0
            elif kind == "missing-case": gate["cases"].pop()
            else: gate["runId"] = "foreign"
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, "all48 samples|full48 zero-update"):
                namespace["verify_gpu_gate"](None, plan, binding, gate_binding)


if __name__ == "__main__":
    unittest.main()
