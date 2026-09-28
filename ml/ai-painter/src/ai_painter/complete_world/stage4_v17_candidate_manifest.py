"""Pure V17 manifest construction and binding checks, without filesystem IO.

trusted_context is independently verified caller input, never derived from the
candidate manifest. This codec recomputes supplied source bytes and checks their
bindings; it does not authenticate training/inference, decode image/condition
semantics, or grant review eligibility. Those checks belong to the caller.
"""
from copy import deepcopy
from datetime import datetime
from hashlib import sha256
import math
import re

from .stage4_v17_responsibility_artifact import (
    load_interface, decode_responsibility_artifact,
)


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def _fields(value, names, label, exact=False):
    _require(isinstance(value, dict) and set(names) <= set(value), label + " fields missing")
    if exact:
        _require(set(value) == set(names), label + " extra fields")


def _json(value):
    """Require finite, interoperable JSON; bool must not compare equal to 0/1."""
    if value is None or isinstance(value, (str, bool)):
        return
    if type(value) in (int, float):
        _require(math.isfinite(value), "nonfinite JSON number")
        if type(value) is int or value.is_integer():
            _require(abs(value) <= 2**53 - 1, "unsafe JSON integer")
        return
    if isinstance(value, list):
        for item in value:
            _json(item)
        return
    _require(isinstance(value, dict) and all(isinstance(k, str) for k in value), "non-JSON value")
    for item in value.values():
        _json(item)


def _equal(left, right):
    if isinstance(left, bool) or isinstance(right, bool):
        return type(left) is type(right) and left == right
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(_equal(left[k], right[k]) for k in left)
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(_equal(a, b) for a, b in zip(left, right))
    return type(left) is type(right) and left == right or (
        type(left) in (int, float) and type(right) in (int, float) and left == right)


def _path(value):
    _require(isinstance(value, str) and value and not re.search(r"[\\:\x00-\x1f]", value)
             and all(part not in ("", ".", "..", "latest", "latest.json")
                     for part in value.split("/")), "invalid project-relative source path")


def _digest(value):
    _require(isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value), "invalid SHA-256")


def _binding(value, source_bytes, fields=("path", "sha256"), exact=True):
    _fields(value, fields, "source binding", exact)
    _path(value["path"])
    _digest(value["sha256"])
    _require(value["path"] in source_bytes and isinstance(source_bytes[value["path"]], bytes),
             "source bytes missing: " + value["path"])
    data = source_bytes[value["path"]]
    _require(sha256(data).hexdigest() == value["sha256"], "source byte SHA mismatch: " + value["path"])
    return data


def _resolve(reference, scope, ordinal):
    if reference == "zero_based_validation_ordinal":
        return ordinal
    _require(re.fullmatch(r"(?:manifest|trusted|candidate)(?:\.[A-Za-z][A-Za-z0-9]*(?:\[ordinal\])?)+",
                          reference), "unsupported identity equation reference")
    parts = reference.split(".")
    value = scope[parts[0]]
    for part in parts[1:]:
        indexed = part.endswith("[ordinal]")
        key = part[:-9] if indexed else part
        _require(isinstance(value, dict) and key in value, "identity equation source missing")
        value = value[key]
        if indexed:
            _require(isinstance(value, list) and ordinal < len(value), "identity equation row missing")
            value = value[ordinal]
    return value


def _schema(schema_bytes, schema_sha256, candidate_pack_schema_version):
    schema = load_interface(schema_bytes, schema_sha256, candidate_pack_schema_version)
    _require(schema["bindingShape"]["requiredFields"] == ["path", "sha256"]
             and schema["bindingShape"]["additionalFieldsAllowed"] is False,
             "unsupported source binding shape")
    return schema


def _validate_masks(masks, spec, source_bytes):
    _require(spec["container"] == "array" and spec["orderRule"] ==
             "exactly_the_roles_array_order_one_entry_per_role_no_extra_entries", "unsupported mask shape")
    _require(isinstance(masks, list) and len(masks) == len(spec["roles"]), "mask count differs")
    for role, item in zip(spec["roles"], masks):
        _binding(item, source_bytes, spec["itemFields"])
        _require(item["role"] == role, "mask role order differs")


def validate_candidate_manifest(manifest, *, trusted_context, source_bytes, schema_bytes,
                                schema_sha256, candidate_pack_schema_version):
    """Return an independent validated manifest; trusted context is mandatory."""
    schema = _schema(schema_bytes, schema_sha256, candidate_pack_schema_version)
    _json(manifest)
    _json(trusted_context)
    _fields(manifest, schema["requiredManifestFields"], "manifest")
    _fields(trusted_context, schema["requiredTrustedContextFields"], "trusted context")
    _require(isinstance(source_bytes, dict), "source byte map required")
    _require(manifest["schemaVersion"] == schema["candidatePackSchemaVersion"], "candidate pack schema mismatch")
    for key in ("status", "capabilityVersion", "modelArchitectureId", "stage", "candidateCount", "candidateSplit"):
        _require(_equal(manifest[key], schema[key]), key + " differs from interface")
    _require(_equal(manifest["executionBoundary"], schema["requiredExecutionBoundary"]), "execution boundary differs")
    for key in ("runId", "packageId"):
        _require(isinstance(trusted_context[key], str) and trusted_context[key].strip(), "invalid trusted " + key)
    for key in ("modelStateSha256", "discriminatorStateSha256"):
        _digest(trusted_context[key])
    timestamp = manifest["recordedAtUtc"]
    _require(isinstance(timestamp, str) and re.fullmatch(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z", timestamp), "invalid UTC timestamp")
    datetime.fromisoformat(timestamp[:-1] + "+00:00")
    rows, candidates = trusted_context["orderedValidationRows"], manifest["candidates"]
    _require(isinstance(rows, list) and isinstance(candidates, list)
             and len(rows) == len(candidates) == schema["candidateCount"], "candidate count differs")
    for key in ("executionPackage", "trainingTerminal", "datasetManifest", "checkpoint", "inferenceReport"):
        _binding(manifest[key], source_bytes)
    seen = set()
    for ordinal, (row, candidate) in enumerate(zip(rows, candidates)):
        _fields(row, schema["orderedValidationRowFields"], "trusted validation row")
        _fields(candidate, schema["requiredCandidateFields"], "candidate")
        sample_id = candidate["sampleId"]
        _require(isinstance(sample_id, str) and sample_id.strip() and sample_id not in seen,
                 "sampleId must be nonempty and unique")
        seen.add(sample_id)
        _require(type(candidate["sampleIndex"]) is int and candidate["sampleIndex"] == ordinal,
                 "sampleIndex order differs")
        _require(candidate["split"] == schema["candidateSplit"], "candidate split differs")
        identity = candidate["artifactIdentity"]
        _fields(identity, schema["requiredArtifactIdentityFields"], "artifact identity")
        _require(identity["inferenceMode"] == schema["inferenceMode"], "inference mode differs")
        _require(_equal(identity["precisionExecutionPlan"], manifest["precisionExecutionPlan"]),
                 "artifact precision plan differs")
        scope = {"manifest": manifest, "trusted": trusted_context, "candidate": candidate}
        for equation in schema["identityEquations"]:
            sides = equation.split("==")
            _require(len(sides) == 2, "unsupported identity equation")
            _require(_equal(_resolve(sides[0], scope, ordinal), _resolve(sides[1], scope, ordinal)),
                     "identity equation mismatch: " + equation)
        for key in ("candidateRgb", "referenceRgb", "conditionPack"):
            spec = schema["candidateArtifacts"][key]
            _binding(candidate[key], source_bytes, spec["requiredFields"], exact=key != "candidateRgb")
        rgb = candidate["candidateRgb"]
        rgb_spec = schema["candidateArtifacts"]["candidateRgb"]
        for key in ("role", "width", "height"):
            _require(_equal(rgb[key], rgb_spec[key]), "candidate RGB " + key + " differs")
        _validate_masks(candidate["objectMasks"], schema["candidateArtifacts"]["objectMasks"], source_bytes)
        evidence = candidate["responsibilityEvidence"]
        _fields(evidence, schema["responsibilityEvidence"]["requiredFields"], "responsibility evidence")
        archive = _binding(evidence["tensorArchive"], source_bytes)
        expected = {key: row[key] for key in ("worldId", "regionId", "tick", "factHash", "visualFactManifestSha256")}
        expected.update(conditionPackSha256=row["conditionPack"]["sha256"],
                        modelStateSha256=trusted_context["modelStateSha256"])
        decode_responsibility_artifact(archive, evidence, expected_identity=expected,
            schema_bytes=schema_bytes, schema_sha256=schema_sha256,
            candidate_pack_schema_version=candidate_pack_schema_version)
    return deepcopy(manifest)


def build_candidate_manifest(*, trusted_context, responsibility_evidence, recorded_at_utc,
                             source_bytes, schema_bytes, schema_sha256, candidate_pack_schema_version):
    """Construct only from independently verified context and supplied role evidence."""
    schema = _schema(schema_bytes, schema_sha256, candidate_pack_schema_version)
    _fields(trusted_context, schema["requiredTrustedContextFields"], "trusted context")
    rows = trusted_context["orderedValidationRows"]
    _require(isinstance(rows, list) and isinstance(responsibility_evidence, list)
             and len(rows) == len(responsibility_evidence) == schema["candidateCount"], "candidate count differs")
    manifest = {key: deepcopy(schema[key]) for key in (
        "status", "capabilityVersion", "modelArchitectureId", "stage", "candidateCount", "candidateSplit")}
    manifest.update(schemaVersion=schema["candidatePackSchemaVersion"],
                    executionPackageIdentity=trusted_context["packageId"],
                    executionBoundary=deepcopy(schema["requiredExecutionBoundary"]),
                    recordedAtUtc=recorded_at_utc, candidates=[])
    for key in schema["requiredTrustedContextFields"]:
        if key not in ("packageId", "orderedValidationRows"):
            manifest[key] = deepcopy(trusted_context[key])
    for ordinal, row in enumerate(rows):
        _fields(row, schema["orderedValidationRowFields"], "trusted validation row")
        candidate = {key: deepcopy(row[key]) for key in (
            "sampleId", "candidateRgb", "referenceRgb", "conditionPack", "objectMasks")}
        candidate.update(sampleIndex=ordinal, split=schema["candidateSplit"],
            responsibilityEvidence=deepcopy(responsibility_evidence[ordinal]), artifactIdentity={
                "inferenceMode": schema["inferenceMode"],
                "precisionExecutionPlan": deepcopy(trusted_context["precisionExecutionPlan"]),
                "modelStateSha256": trusted_context["modelStateSha256"],
                "candidateRgb": deepcopy(row["candidateRgb"])})
        manifest["candidates"].append(candidate)
    return validate_candidate_manifest(manifest, trusted_context=trusted_context, source_bytes=source_bytes,
        schema_bytes=schema_bytes, schema_sha256=schema_sha256,
        candidate_pack_schema_version=candidate_pack_schema_version)
