"""Private Stage0 candidate. A four-season projection conditions only the existing masked road role."""
from collections.abc import Mapping
from contextvars import ContextVar
import hashlib

import torch
from torch import nn
from torch.nn import functional as F

from .native_stage_geometry_v1 import validate_geometry
from .object_appearance_regime_input_cpu import validate_regime
from .split_release import canonical_bytes
from .terrain_ecology_native_recomputed_stage_v1 import validate_model_identity


ARCHITECTURE = "stage0_private_seasonal_road_role_8x4_v1"
PARENT_STATE = "a6ade5559b8e565fa2427b007fda2c3e73038ddbcba273331f2d17e5e8717659"
SCHEMA = "private-seasonal-road-role-projection-v1"
DECODER = "core.core.final_rgb_decoder.base.layers"
ROAD = "terrain_path_ground"
_OBSERVATION = ContextVar("private_seasonal_road_role_observation", default=None)


def _require(valid, message):
    if not valid:
        raise ValueError(message)


def _tensor_bytes(value):
    return value.detach().contiguous().numpy().tobytes()


def _parent_digest(model):
    h = hashlib.sha256()
    for name, value in model.state_dict().items():
        _require(value.device.type == "cpu", "only a CPU Stage0 parent is supported")
        h.update(canonical_bytes([name, str(value.dtype), list(value.shape)]))
        h.update(_tensor_bytes(value))
    return h.hexdigest()


def _valid_sha(value):
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


class SeasonalRoadReadout(nn.Module):
    """The only trainable tensor maps the existing four-way one-hot to eight road feature offsets."""

    def __init__(self):
        super().__init__()
        self.weight = nn.Parameter(torch.zeros(8, 4, dtype=torch.float32, device="cpu"))

    def forward(self, decoder_input, road, season, object_residual_sum, decoder):
        validate_regime(season)
        tensors = (decoder_input, road, object_residual_sum, self.weight)
        _require(all(v.dtype == torch.float32 and v.device.type == "cpu" and torch.isfinite(v).all() for v in tensors)
                 and self.weight.shape == (8, 4) and decoder_input.shape == (1, 111, 192, 256)
                 and road.shape == (1, 1, 192, 256) and ((road == 0) | (road == 1)).all()
                 and object_residual_sum.shape == (1, 3, 192, 256), "invalid Stage0 seasonal road input")
        _require(len(decoder) == 5 and isinstance(decoder[1], nn.SiLU) and isinstance(decoder[3], nn.SiLU)
                 and tuple(decoder[0].weight.shape) == (48, 111, 3, 3)
                 and tuple(decoder[2].weight.shape) == (48, 48, 3, 3)
                 and tuple(decoder[4].weight.shape) == (3, 48, 1, 1), "wrong terrain readout")
        offset = (self.weight @ season).view(1, 8, 1, 1)
        original = decoder_input[:, 48:56].detach()
        shift = offset * road.detach()
        # -0 + +0 loses the parent's sign. Subtracting from +0 before
        # negation preserves it with either zero shift and still has derivative +1.
        negative_zero = (original == 0) & torch.signbit(original)
        masked_role = torch.where(negative_zero, -((-original) - shift), original + shift)
        x = torch.cat((decoder_input[:, :48].detach(), masked_role, decoder_input[:, 56:].detach()), dim=1)
        for index in (0, 2):
            layer = decoder[index]
            x = F.silu(F.conv2d(x, layer.weight.detach(), layer.bias.detach(), padding=1))
        final = decoder[4]
        terrain = torch.sigmoid(F.conv2d(x, final.weight.detach(), final.bias.detach()))
        rgb = torch.sigmoid(torch.logit(terrain.clamp(1e-5, 1-1e-5)) + object_residual_sum.detach())
        _require(torch.isfinite(rgb).all(), "invalid seasonal road RGB")
        return rgb, terrain, masked_role

    def export_projection_state(self, parent_state_sha256):
        _require(_valid_sha(parent_state_sha256), "missing parent state identity")
        w = self.weight.detach().clone()
        _require(w.shape == (8, 4) and w.device.type == "cpu" and w.dtype == torch.float32
                 and torch.isfinite(w).all(), "invalid seasonal projection state")
        return {"schema": SCHEMA, "architecture": ARCHITECTURE, "parentStateSha256": parent_state_sha256,
                "projectionSha256": hashlib.sha256(_tensor_bytes(w)).hexdigest(), "projection": w}

    def load_projection_state(self, state, parent_state_sha256):
        _require(isinstance(state, Mapping) and set(state) == {
            "schema", "architecture", "parentStateSha256", "projectionSha256", "projection"
        } and state["schema"] == SCHEMA and state["architecture"] == ARCHITECTURE
                 and _valid_sha(parent_state_sha256) and state["parentStateSha256"] == parent_state_sha256,
                 "seasonal road state identity mismatch")
        w = state["projection"]
        _require(type(w) == torch.Tensor and w.dtype == torch.float32 and w.device.type == "cpu"
                 and w.shape == (8, 4) and w.is_contiguous() and not w.requires_grad and torch.isfinite(w).all()
                 and hashlib.sha256(_tensor_bytes(w)).hexdigest() == state["projectionSha256"],
                 "seasonal road projection shape, finite values or digest differ")
        with torch.no_grad():
            self.weight.copy_(w)


class SeasonalRoadRoleStage(nn.Module):
    """One normal parent call supplies the frozen features and object branch, followed by the learned readout."""
    architecture_id = ARCHITECTURE
    execution_qualified = False

    def __init__(self, parent):
        super().__init__()
        validate_model_identity(parent)
        geometry = validate_geometry(parent.native_stage_geometry)
        _require(geometry.stage == 0 and _parent_digest(parent) == PARENT_STATE,
                 "exact Stage0 private road-role parent required")
        self.parent = parent.eval().requires_grad_(False)
        self.seasonal_readout = SeasonalRoadReadout()
        self.native_stage_geometry = geometry
        self.condition_channel_order = tuple(parent.condition_channel_order)
        self.eval()

    def train(self, mode=True):
        _require(type(mode) is bool, "model mode must be boolean")
        self.training = mode
        self.parent.eval()
        self.seasonal_readout.train(mode)
        return self

    def _check_parent(self):
        _require(not any(m.training for m in self.parent.modules()) and
                 not any(p.requires_grad for p in self.parent.parameters()) and
                 _parent_digest(self.parent) == PARENT_STATE, "private parent state or mode differs")

    def export_projection_state(self):
        self._check_parent()
        return self.seasonal_readout.export_projection_state(PARENT_STATE)

    def load_projection_state(self, state):
        self._check_parent()
        self.seasonal_readout.load_projection_state(state, PARENT_STATE)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        raise ValueError("use load_projection_state with the unchanged registered parent")

    def forward(self, conditions, instance_table, *, appearance_regime, ecology_regime, return_evidence=False):
        self._check_parent()
        validate_regime(appearance_regime)
        _require(conditions.shape == (1, 23, 192, 256) and conditions.device.type == "cpu"
                 and conditions.dtype == torch.float32 and torch.isfinite(conditions).all()
                 and _OBSERVATION.get() is None, "invalid or reentrant seasonal Stage0 observation")
        decoder = self.parent.get_submodule(DECODER)
        observed = []
        marker = object()

        def observe(_, args):
            if _OBSERVATION.get() is marker:
                _require(len(args) == 1 and not observed, "expected one original terrain decoder invocation")
                observed.append(args[0].detach())

        token = _OBSERVATION.set(marker)
        try:
            handle = decoder[0].register_forward_pre_hook(observe)
            try:
                with torch.no_grad():
                    parent_rgb, evidence = self.parent(conditions, instance_table, appearance_regime=appearance_regime,
                                                       ecology_regime=ecology_regime, return_evidence=True)
            finally:
                handle.remove()
        finally:
            _OBSERVATION.reset(token)
        _require(len(observed) == 1, "missing original terrain decoder input")
        idx = self.condition_channel_order.index(ROAD)
        road = conditions[:, idx:idx+1]
        original_role = evidence["terrainResponsibilityFeatures"][ROAD]
        _require(torch.equal(road, evidence["responsibilityConditions"][ROAD]) and
                 torch.equal(original_role, observed[0][:, 48:56]), "original road-role binding differs")
        rgb, terrain, role = self.seasonal_readout(observed[0], road, appearance_regime,
                                                   evidence["objectResidualSum"], decoder)
        if torch.equal(original_role, role.detach()):
            _require(torch.equal(original_role.view(torch.int32), role.detach().view(torch.int32))
                     and torch.equal(parent_rgb, rgb.detach()) and torch.equal(evidence["terrainRgb"], terrain.detach()),
                     "inactive projection failed to reproduce the actual parent")
        if return_evidence:
            return rgb, {**evidence, "terrainRgb": terrain, "parentTerrainRgb": evidence["terrainRgb"],
                         "terrainResponsibilityFeatures": {**evidence["terrainResponsibilityFeatures"], ROAD: role},
                         "parentRgb": parent_rgb, "parentMaskedRoadFeatures": original_role,
                         "seasonalMaskedRoadFeatures": role}
        return rgb


def build_seasonal_road_role_stage(parent):
    return SeasonalRoadRoleStage(parent)
