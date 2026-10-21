"""Versioned decode1 entry-weight preview encoder; no hooks or filesystem I/O.

The v1 capture, encoding and quota algorithms remain unchanged. Only the new
candidate identity is accepted; authenticated policy-v6 adoption belongs to the
storage/worker boundary. Internal component JSON is never a published record.
"""

from dataclasses import asdict, dataclass
import hashlib
import json
import re
import struct
import zlib

import torch


CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_v1"
COMPLETION_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1"
COMPLETION_V2_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v2"
MODEL_CAPABILITY = "stage4_mvp256_dry_factorized_ecology_decode1_entry_weight_precision_v1"

MIB = 1024 * 1024
TOTAL_BYTES = 128 * MIB
CAPTURE_RESERVED_BYTES = 64 * MIB
CAPTURE_METADATA_RESERVED_BYTES = MIB
TERMINAL_RESERVED_BYTES = 65536
PREVIEW_BYTES = 4 * MIB
MAX_PNG_BYTES = 152 * 1024
MAX_METADATA_BYTES = 8 * 1024
MAX_RECORDS = 25
PHASE = "after_discriminator_update_before_generator_update"
_SLUG = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\Z")
_SHA = re.compile(r"[a-f0-9]{64}\Z")


class PreviewRejected(ValueError):
    """Invalid component input or insufficient reserved space; no state committed."""


def _require(condition, reason):
    if not condition:
        raise PreviewRejected(reason)


def _integer(value, minimum, maximum):
    return type(value) is int and minimum <= value <= maximum


def _slug(value):
    return type(value) is str and _SLUG.fullmatch(value) is not None


@dataclass(frozen=True)
class Binding:
    logical_path: str
    sha256: str

    def validate(self):
        path = self.logical_path
        _require(type(path) is str and 0 < len(path) <= 512, "binding path length")
        _require(not path.startswith(("/", "\\")) and ":" not in path
                 and "\\" not in path and all(p not in ("", ".", "..")
                                             for p in path.split("/")), "binding path")
        _require(type(self.sha256) is str and _SHA.fullmatch(self.sha256) is not None,
                 "binding digest syntax")


@dataclass(frozen=True)
class PreviewIdentity:
    run_id: str
    package_id: str
    capability_version: str
    model_capability_version: str
    epoch: int
    train_ordinal: int
    train_index: int
    sample_id: str
    generator_updates: int
    discriminator_updates: int
    forward_sequence: int
    execution_package: Binding
    plan: Binding
    model: Binding
    dataset_manifest: Binding
    source_rgb: Binding
    condition_pack: Binding
    world_facts: Binding
    configuration_sha256: str
    program_bindings_sha256: str
    split: str = "train"
    phase: str = PHASE

    def validate(self, *, identity_protocol=None):
        _require(identity_protocol in (None,"training-preview-diagnostic-record-v1"), "preview identity protocol unsupported")
        _require((identity_protocol is not None or self.capability_version in (CAPABILITY,COMPLETION_CAPABILITY,COMPLETION_V2_CAPABILITY))
                 and self.model_capability_version == MODEL_CAPABILITY,
                 "preview v6 exact decode1 entry-weight identity required")
        _require(all(_slug(v) for v in (self.run_id, self.package_id,
                     self.capability_version, self.model_capability_version, self.sample_id)),
                 "identity slug")
        _require(self.split == "train" and self.phase == PHASE, "train forward phase")
        _require(_integer(self.epoch, 1, 24) and _integer(self.train_ordinal, 0, 47)
                 and _integer(self.train_index, 0, 47), "train position")
        expected_g = (self.epoch - 1) * 48 + self.train_ordinal
        _require(type(self.generator_updates) is int and self.generator_updates == expected_g
                 and type(self.discriminator_updates) is int
                 and self.discriminator_updates == expected_g + 1, "pre-generator counters")
        _require(_integer(self.forward_sequence, 1, 2**63 - 1), "forward sequence")
        for binding in (self.execution_package, self.plan, self.model,
                        self.dataset_manifest, self.source_rgb, self.condition_pack,
                        self.world_facts):
            _require(type(binding) is Binding, "binding type")
            binding.validate()
        _require(self.execution_package.logical_path ==
                 f".runtime/ai-painter/autonomous-closed-loop-packages/{self.package_id}/package.json",
                 "execution package path")
        for digest in (self.configuration_sha256, self.program_bindings_sha256):
            _require(type(digest) is str and _SHA.fullmatch(digest) is not None,
                     "program/configuration digest syntax")


@dataclass(frozen=True)
class BudgetSnapshot:
    """Caller meter snapshot, not an authorization or an independent quota check.

    accounted_bytes includes preview_accounted_bytes. Outstanding returned bytes
    are added locally, so an unwritten artifact still consumes component budget.
    Existing failure capture, its metadata, and terminal reserves are kept whole.
    """

    accounted_bytes: int
    preview_accounted_bytes: int = 0


@dataclass(frozen=True)
class PreviewArtifact:
    metadata_path: str
    metadata: bytes
    png_path: str | None = None
    png: bytes | None = None

    @property
    def byte_count(self):
        return len(self.metadata) + (len(self.png) if self.png is not None else 0)


def _json_bytes(value):
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"),
                     ensure_ascii=True, allow_nan=False).encode("ascii") + b"\n"
    _require(len(raw) <= MAX_METADATA_BYTES, "metadata byte limit")
    return raw


def _labels():
    return dict(schema="training_preview_observer_v1", policy_status="proposal_unapproved_component_only",
                production_integrated=False, review_status="not_reviewed_diagnostic_only",
                checkpoint_selection_eligible=False, qualification_evidence=False,
                runtime_publication_eligible=False, formal_output=False,
                identity_verification="caller_claims_not_verified_by_component")


def _png(frame):
    _require(type(frame) is torch.Tensor, "tensor type")
    _require(frame.device.type == "cpu" and frame.layout == torch.strided,
             "CPU strided tensor required")
    _require(frame.dtype == torch.float32 and tuple(frame.shape) == (1, 3, 192, 256)
             and frame.is_contiguous(), "FP32 RGB 1x3x192x256 required")
    _require(not frame.requires_grad and frame.grad_fn is None, "detached input required")
    owned = frame.clone()
    _require(bool(torch.isfinite(owned).all()) and bool((owned >= 0).all())
             and bool((owned <= 1).all()), "finite RGB in [0,1] required")
    rgb = (owned[0] * 255).round().to(torch.uint8).permute(1, 2, 0).contiguous()
    raw = rgb.numpy().tobytes()
    scanlines = b"".join(b"\0" + raw[row * 768:(row + 1) * 768] for row in range(192))

    def chunk(kind, payload):
        return (struct.pack(">I", len(payload)) + kind + payload
                + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff))

    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 256, 192, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(scanlines, 1)) + chunk(b"IEND", b""))
    _require(len(png) <= MAX_PNG_BYTES, "PNG byte limit")
    return png


class TrainingPreviewObserver:
    """In-memory prototype. Disabled by default; no hooks or filesystem access.

    Proposal: ordinal zero once per epoch, plus one failure reference to an
    already captured image. A failure reference is never an image of the failing
    forward. Failed historical runs cannot be supplied with reconstructed images.
    """

    def __init__(self, *, enable_component_only=False, identity_protocol=None):
        _require(type(enable_component_only) is bool, "enable flag")
        _require(identity_protocol in (None,"training-preview-diagnostic-record-v1"), "preview identity protocol unsupported")
        self.identity_protocol=identity_protocol
        self._enabled = enable_component_only
        self._epochs = set()
        self._emitted_bytes = 0
        self._records = 0
        self._last = None
        self._run = None
        self._failed = False
        self._meter = (0, 0)

    @property
    def emitted_bytes(self):
        return self._emitted_bytes

    def should_capture(self, identity):
        if not self._enabled:
            return False
        _require(not self._failed, "observer already ended on failure")
        _require(type(identity) is PreviewIdentity, "identity type")
        identity.validate(identity_protocol=self.identity_protocol)
        if self._run is not None:
            _require(self._run == self._run_key(identity), "run binding changed")
            _require(identity.epoch >= max(self._epochs), "epoch regression")
        return identity.train_ordinal == 0 and identity.epoch not in self._epochs

    @staticmethod
    def _run_key(identity):
        return tuple(getattr(identity, key) for key in (
            "run_id", "package_id", "capability_version", "model_capability_version",
            "execution_package", "plan", "model", "dataset_manifest",
            "configuration_sha256", "program_bindings_sha256"))

    def _commit(self, artifact, budget):
        _require(type(budget) is BudgetSnapshot, "budget snapshot type")
        _require(_integer(budget.accounted_bytes, 0, TOTAL_BYTES)
                 and _integer(budget.preview_accounted_bytes, 0, self._emitted_bytes)
                 and budget.preview_accounted_bytes <= budget.accounted_bytes,
                 "budget snapshot range")
        _require(budget.accounted_bytes >= self._meter[0]
                 and budget.preview_accounted_bytes >= self._meter[1], "budget meter regression")
        _require(self._records < MAX_RECORDS
                 and self._emitted_bytes + artifact.byte_count <= PREVIEW_BYTES,
                 "preview count/byte limit")
        available = (TOTAL_BYTES - CAPTURE_RESERVED_BYTES - CAPTURE_METADATA_RESERVED_BYTES
                     - TERMINAL_RESERVED_BYTES)
        _require(budget.accounted_bytes + self._emitted_bytes - budget.preview_accounted_bytes
                 + artifact.byte_count <= available, "existing execution reserves exhausted")
        self._emitted_bytes += artifact.byte_count
        self._records += 1
        self._meter = (budget.accounted_bytes, budget.preview_accounted_bytes)

    def observe(self, detached_cpu_frame, identity, budget):
        if not self.should_capture(identity):
            return None
        png = _png(detached_cpu_frame)
        path = f"training-previews/epoch-{identity.epoch:04d}.png"
        record = dict(_labels(), kind="captured_train_forward", capture=asdict(identity),
                      png_path=path, png_sha256=hashlib.sha256(png).hexdigest(),
                      png_bytes=len(png), rgb_encoding="RGB8_round_to_nearest_no_clamp")
        metadata = _json_bytes(record)
        artifact = PreviewArtifact(path[:-4] + ".json", metadata, path, png)
        self._commit(artifact, budget)
        self._epochs.add(identity.epoch)
        self._run = self._run_key(identity)
        self._last = (identity, path, record["png_sha256"])
        return artifact

    def mark_failure(self, *, epoch, train_ordinal, budget):
        if not self._enabled:
            return None
        _require(not self._failed, "failure already recorded")
        _require(_integer(epoch, 1, 24) and _integer(train_ordinal, 0, 47), "failure position")
        if self._last is None:
            self._failed = True
            return None
        identity, path, digest = self._last
        _require((epoch, train_ordinal) >= (identity.epoch, identity.train_ordinal),
                 "failure precedes capture")
        metadata = _json_bytes(dict(_labels(), kind="failure_reference_to_prior_capture",
            capture=asdict(identity), png_path=path, png_sha256=digest,
            failure_position=dict(epoch=epoch, train_ordinal=train_ordinal),
            image_is_failure_forward=False, regenerated=False))
        artifact = PreviewArtifact("training-previews/failure-reference.json", metadata)
        self._commit(artifact, budget)
        self._failed = True
        return artifact
