"""Private Stage0 road appearance model. References and map IDs are not inference inputs."""
import hashlib
from collections.abc import Mapping

import torch
from torch import nn
from torch.nn import functional as F

from .native_stage_geometry_v1 import validate_geometry
from .object_appearance_regime_input_cpu import validate_regime
from .seasonal_road_role_stage_v1 import PARENT_STATE, _parent_digest
from .terrain_ecology_native_recomputed_stage_v1 import validate_model_identity


ARCH = "stage0_private_local_road_appearance_v1"
SCHEMA = "private_local_road_readout_state_v1"
WIDTH = {"constant": 1, "affine": 5}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def digest(t):
    return hashlib.sha256(t.detach().contiguous().numpy().tobytes()).hexdigest()


def road_features(parent_rgb, road):
    require(parent_rgb.shape == (1, 3, 192, 256) and road.shape == (1, 1, 192, 256) and
            all(t.device.type == "cpu" and t.dtype == torch.float32 and torch.isfinite(t).all() for t in (road,parent_rgb))
            and ((road == 0) | (road == 1)).all() and parent_rgb.min() >= 0 and parent_rgb.max() <= 1,
            "invalid canonical Stage0 RGB or discrete road mask")
    # Outside the canvas contributes zero to the density; the denominator is nine everywhere.
    density = F.avg_pool2d(road.detach(), kernel_size=3, stride=1, padding=1, count_include_pad=True)
    return torch.cat((torch.ones_like(road), parent_rgb.detach() - 0.5, density), dim=1)


class LocalRoadAppearanceReadout(nn.Module):
    def __init__(self, arm):
        super().__init__()
        require(arm in WIDTH, "unknown local road readout")
        self.arm = arm
        self.weight = nn.Parameter(torch.zeros(4, 3, WIDTH[arm], dtype=torch.float32, device="cpu"))

    def forward(self, parent_rgb, road, season):
        validate_regime(season)
        features = road_features(parent_rgb, road)[:, :WIDTH[self.arm]]
        require(self.weight.dtype == torch.float32 and self.weight.device.type == "cpu"
                and torch.isfinite(self.weight).all(), "invalid local road coefficients")
        selected = self.weight[int(season.argmax())]
        residual = F.conv2d(features, selected[:, :, None, None])
        parent = parent_rgb.detach()
        # Preserve even the signed-zero representation when a seasonal column has no effect.
        shifted = torch.where((parent == 0) & torch.signbit(parent), -((-parent) - residual), parent + residual)
        rgb = torch.where(road.bool(), shifted.clamp(0, 1), parent)
        return rgb, features, torch.where(road.bool(), residual, torch.zeros_like(residual))

    def export_state(self):
        w = self.weight.detach().clone()
        require(w.device.type == "cpu" and w.dtype == torch.float32 and w.shape == (4,3,WIDTH[self.arm])
                and torch.isfinite(w).all(), "invalid stored coefficients")
        return {"schema":SCHEMA, "architecture":ARCH, "parentStateSha256":PARENT_STATE,
                "arm":self.arm, "weightSha256":digest(w), "weight":w}

    def load_state(self, state):
        require(isinstance(state, Mapping) and set(state) == {"schema","architecture","parentStateSha256","arm","weightSha256","weight"}
                and state["schema"] == SCHEMA and state["architecture"] == ARCH and state["parentStateSha256"] == PARENT_STATE
                and state["arm"] == self.arm, "wrong road readout identity")
        w=state["weight"]
        require(type(w) is torch.Tensor and w.dtype == torch.float32 and w.device.type == "cpu"
                and w.is_contiguous() and not w.requires_grad and w.shape == self.weight.shape
                and torch.isfinite(w).all() and digest(w) == state["weightSha256"], "invalid readout checkpoint")
        with torch.no_grad():
            self.weight.copy_(w)


class LocalRoadAppearanceStage(nn.Module):
    architecture_id = ARCH
    execution_qualified = False

    def __init__(self, parent, arm):
        super().__init__()
        validate_model_identity(parent)
        require(validate_geometry(parent.native_stage_geometry).stage == 0 and _parent_digest(parent) == PARENT_STATE,
                "exact frozen Stage0 parent is required")
        self.parent = parent.eval().requires_grad_(False)
        self.readout = LocalRoadAppearanceReadout(arm)
        self.native_stage_geometry = parent.native_stage_geometry
        self.condition_channel_order = tuple(parent.condition_channel_order)
        self.eval()

    def _check(self):
        require(all(not m.training for m in self.parent.modules()) and all(not p.requires_grad for p in self.parent.parameters())
                and _parent_digest(self.parent) == PARENT_STATE, "frozen parent changed")

    def train(self, mode=True):
        require(type(mode) is bool, "invalid model mode")
        self.training = mode
        self.parent.eval()
        self.readout.train(mode)
        return self

    def export_readout_state(self):
        self._check()
        return self.readout.export_state()

    def load_readout_state(self, state):
        self._check()
        self.readout.load_state(state)

    def load_state_dict(self, state_dict, strict=True, assign=False):
        raise ValueError("load_readout_state requires the original parent identity")

    def forward(self, conditions, instance_table, *, appearance_regime, ecology_regime, return_evidence=False):
        self._check()
        validate_regime(appearance_regime)
        require(conditions.shape == (1,23,192,256) and conditions.dtype == torch.float32
                and conditions.device.type == "cpu" and torch.isfinite(conditions).all(), "invalid Stage0 conditions")
        with torch.no_grad():
            parent_rgb, evidence = self.parent(conditions,instance_table,appearance_regime=appearance_regime,
                                               ecology_regime=ecology_regime,return_evidence=True)
        i=self.condition_channel_order.index("terrain_path_ground")
        road=conditions[:,i:i+1]
        require(torch.equal(road,evidence["responsibilityConditions"]["terrain_path_ground"]),
                "road mask differs from the original generator input")
        rgb,features,residual=self.readout(parent_rgb,road,appearance_regime)
        if return_evidence:
            return rgb,{**evidence,"parentRgb":parent_rgb,"parentRoadMask":road,"localRoadFeatures":features,
                        "localRoadResidual":residual}
        return rgb


def build_local_road_appearance_stage(parent, arm):
    return LocalRoadAppearanceStage(parent, arm)
