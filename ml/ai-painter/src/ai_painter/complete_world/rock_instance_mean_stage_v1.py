"""Private instance-mean correction on exact registered rock cores of the frozen affine road model."""
import hashlib
import json
import math

import torch
from torch import nn
from torch.nn import functional as F

from .local_road_appearance_stage_v1 import LocalRoadAppearanceStage, PARENT_STATE, digest


ARCH = "private_stage0_rock_instance_mean_v1"
B_WEIGHT_SHA = "d978b5001495aafd7c0b6df3d7b76e9911aec3cc9bdc82de0f58a8cc7c2d782f"
WEIGHTS_FILE_SHA = "5d85400ef1ced73392c861af8427f51180060f0873e9dccc5ca2a15598d51282"
WEIGHT_FP32_SHA = "da3e998e659c7f27957de2db960f337a4e5bccd4978b97f101b6d60c08ceb012"
TRAIN_SPLIT_SHA = "36fe4bb66eb7844f9eeb0b231eaae807af26305ac84a7d807e7f449c20105186"
FEATURES = ("intercept","coreRedMinusHalf","coreGreenMinusHalf","coreBlueMinusHalf","coreMinusRingRed",
            "coreMinusRingGreen","coreMinusRingBlue","log2CorePixelsOver16","moistureMinusHalf")


def _require(ok, message):
    if not ok:
        raise ValueError(message)


def load_279_weights(raw):
    _require(type(raw) is bytes and hashlib.sha256(raw).hexdigest() == WEIGHTS_FILE_SHA, "wrong sealed 279 artifact")
    state = json.loads(raw)
    _require(state["schema"] == "private-rock-mean-offset-277-v1" and state["parent"] == "268_affine"
             and state["trainMembership"]["sha256"] == TRAIN_SPLIT_SHA and state["features"] == list(FEATURES)
             and state["ridge"] == 0.001 and state["fitMaps"] == 48 and state["fitInstances"] == 444,
             "wrong fitted source, feature order or scope")
    full = torch.tensor(state["weightFp64"], dtype=torch.float64, device="cpu")
    fitted = torch.tensor(state["weightFp32"], dtype=torch.float32, device="cpu")
    _require(full.shape == fitted.shape == (9,3) and torch.isfinite(full).all() and torch.isfinite(fitted).all()
             and digest(full) == state["weightFp64Sha256"] and digest(fitted) == state["weightFp32Sha256"] == WEIGHT_FP32_SHA
             and torch.equal(full.float().view(torch.int32), fitted.view(torch.int32)), "wrong sealed rock coefficients")
    return fitted


def _bound_parent(parent):
    _require(type(parent) is LocalRoadAppearanceStage and parent.readout.arm == "affine" and parent.native_stage_geometry.stage == 0,
             "original Stage0 affine parent required")
    state = parent.export_readout_state()
    _require(state["parentStateSha256"] == PARENT_STATE and state["weightSha256"] == B_WEIGHT_SHA,
             "wrong affine B state")


def rock_instance_features(rgb, conditions, order, table):
    """Yield each original indexed rock, its pixel coordinates and the same nine features used in 279."""
    _require(rgb.shape == (1,3,192,256) and conditions.shape == (1,23,192,256) and len(order) == len(set(order)) == 23
             and all(t.dtype == torch.float32 and t.device.type == "cpu" and torch.isfinite(t).all() for t in (rgb,conditions))
             and rgb.min() >= 0 and rgb.max() <= 1, "invalid Stage0 input")
    inst, footprint, rock, moisture = (conditions[0,order.index(k)] for k in
                                      ("object_instance","object_footprints","object_rock","moisture_proximity"))
    _require(inst.min() >= 0 and inst.max() <= 1 and moisture.min() >= 0 and moisture.max() <= 1
             and ((rock == 0) | (rock == 1)).all() and ((footprint == 0) | (footprint == 1)).all(),
             "invalid authoritative instance, rock or moisture plane")
    code = inst * 255
    _require((code-code.round()).abs().max() <= 2e-5, "object_instance is not a normalized uint8 plane")
    labels = code.round().to(torch.int32)
    occupied = labels > 0
    _require(torch.equal(footprint.bool(), occupied), "footprints and instance labels differ")
    _require(isinstance(table,(list,tuple)) and all(isinstance(t,dict) and type(t.get("value")) is int and
             0 < t["value"] <= 255 and isinstance(t.get("objectId"),str) and t["objectId"] and
             t.get("kind") in {"rock","tree","grass_detail","shrub"} for t in table), "invalid instance table")
    values = {t["value"] for t in table}
    _require(len(values) == len(table) == len({t["objectId"] for t in table})
             and values == set(labels[occupied].unique().tolist()), "duplicate, unbound or missing instance")
    cores = torch.zeros_like(occupied)
    base = rgb[0].permute(1,2,0)
    records = []
    for item in table:
        if item["kind"] != "rock":
            continue
        own = labels == item["value"]
        _require(own.any() and rock[own].bool().all(), "instance rock class is misaligned")
        cores |= own
        ys,xs = own.nonzero(as_tuple=True)
        ring = F.max_pool2d(own[None,None].float(),5,stride=1,padding=2)[0,0].bool() & ~occupied
        mean = base[own].double().mean(0)
        ring_pixels = int(ring.sum())
        context = base[ring].double().mean(0) if ring_pixels else mean
        x = torch.cat((mean.new_ones(1),mean-0.5,mean-context,
                       mean.new_tensor([math.log2(len(xs)/16.)]),moisture[own].double().mean().view(1)-0.5))
        records.append({"objectId":item["objectId"],"value":item["value"],"ys":ys,"xs":xs,
                        "features":x,"parentMean":mean,"ringPixels":ring_pixels})
    _require(torch.equal(cores,rock.bool()), "rock pixels are not assigned to rock instances")
    return records


def apply_rock_instance_mean(rgb, conditions, order, table, weight):
    """Apply a common shift to every pixel of an individual rock; never touch other storage locations."""
    _require(weight.shape == (9,3) and weight.dtype == torch.float32 and weight.device.type == "cpu"
             and torch.isfinite(weight).all(), "invalid rock feature weights")
    sites = rock_instance_features(rgb,conditions,order,table)
    out = rgb.clone()
    mask = torch.zeros((1,1,192,256),dtype=torch.bool,device="cpu")
    offset_image = torch.zeros_like(rgb)
    stats = []
    for s in sites:
        ys,xs = s["ys"],s["xs"]
        delta = s["features"] @ weight.double()
        before = rgb[0,:,ys,xs].double()
        shifted = before + delta[:,None]
        actual = shifted.clamp(0,1).float()
        out[0,:,ys,xs] = actual
        mask[0,0,ys,xs] = True
        offset_image[0,:,ys,xs] = delta.float()[:,None]
        stats.append({"objectId":s["objectId"],"value":s["value"],"pixels":len(xs),"ringPixels":s["ringPixels"],
                      "features":s["features"].tolist(),"parentMean":s["parentMean"].tolist(),"offset":delta.tolist(),
                      "outputMean":actual.double().mean(1).tolist(),"clippedComponents":int(((shifted<0)|(shifted>1)).sum())})
    return out,mask,offset_image,stats


class RockInstanceMeanStage(nn.Module):
    architecture_id = ARCH
    execution_qualified = False

    def __init__(self,parent_b,weights_bytes):
        super().__init__()
        _bound_parent(parent_b)
        self.parent_b=parent_b.eval().requires_grad_(False)
        self.native_stage_geometry=parent_b.native_stage_geometry
        self.condition_channel_order=tuple(parent_b.condition_channel_order)
        self.register_buffer("weight",load_279_weights(weights_bytes))
        self.eval()

    def train(self,mode=True):
        _require(mode is False,"rock mean candidate is inference-only")
        return super().train(False)

    def load_state_dict(self,state_dict,strict=True,assign=False):
        raise ValueError("load the bound 279 weights with the verified affine B parent")

    @torch.no_grad()
    def forward(self,conditions,instance_table,*,appearance_regime,ecology_regime,return_evidence=False):
        _bound_parent(self.parent_b)
        _require(not self.training and not self.parent_b.training and not any(p.requires_grad for p in self.parent_b.parameters())
                 and digest(self.weight)==WEIGHT_FP32_SHA,"changed rock-mean inference identity")
        parent,evidence=self.parent_b(conditions,instance_table,appearance_regime=appearance_regime,
                                     ecology_regime=ecology_regime,return_evidence=True)
        rgb,mask,offset,items=apply_rock_instance_mean(parent,conditions,self.condition_channel_order,instance_table,self.weight)
        if return_evidence:
            return rgb,{"parentRgb":parent,"parentEvidence":evidence,"rockOwnedMask":mask,"rockMeanOffset":offset,
                        "instances":items,"weightsSha256":WEIGHTS_FILE_SHA,"weightFp32Sha256":WEIGHT_FP32_SHA,
                        "responsibilityScope":"parent evidence only; no separately qualified seven-role candidate output"}
        return rgb


def build_rock_instance_mean_stage(parent_b,weights_bytes):
    return RockInstanceMeanStage(parent_b,weights_bytes)
