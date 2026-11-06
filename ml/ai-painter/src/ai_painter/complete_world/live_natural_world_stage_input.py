"""Registered Stage0 conditions for the current natural world, directly from its original PNGs."""
from copy import deepcopy
from dataclasses import replace
from hashlib import sha256
from io import BytesIO

from .live_natural_world_input import load_live_natural_world_input
from .natural_world_input_v1 import _Reader, _digest
from .native_stage_geometry_v1 import NativeStageGeometry


def _need(ok, message):
    if not ok:
        raise ValueError("live Stage0 input: " + message)


def _tensor_sha(tensor):
    return sha256(tensor.detach().contiguous().cpu().numpy().tobytes()).hexdigest()


def _channel_modes(contract, order):
    groups = contract["typePartitions"]
    discrete, continuous = groups["discrete"], groups["continuous"]
    resize = contract["resize"]
    _need(len(order) == len(set(order)) == 23 and order == contract["channelOrder"], "unexpected channel order")
    _need(len(discrete) == len(set(discrete)) == 15 and len(continuous) == len(set(continuous)) == 8 and
          set(discrete).isdisjoint(continuous) and set(discrete).union(continuous) == set(order), "invalid channel partition")
    _need(resize["contractId"] == "discrete_nearest_continuous_bilinear_v1" and
          resize["typePartitionMustOccurBeforeResize"] is True and resize["discrete"]["mode"] == "nearest" and
          resize["discrete"]["storageCodepointsMustRemainExact"] is True and resize["continuous"]["mode"] == "bilinear" and
          resize["continuous"]["alignCorners"] is False, "different resampling policy")
    return tuple("bilinear" if name in continuous else "nearest" for name in order)


def _resample(raw, method, geometry, native_pixel_sha):
    import numpy as np
    import torch
    from PIL import Image
    from .dataset import read_image
    with Image.open(BytesIO(raw)) as image:
        _need(image.format == "PNG" and image.mode == "L" and image.size == (1024, 768), "invalid native channel PNG")
        native = image.tobytes()
        _need(sha256(native).hexdigest() == native_pixel_sha, "native channel pixels changed")
    _need(method in ("nearest", "bilinear"), "unknown channel resampling")
    resampling = Image.Resampling.NEAREST if method == "nearest" else Image.Resampling.BILINEAR
    values = read_image(BytesIO(raw), "L", (geometry.width,geometry.height), resampling)
    if method == "nearest":
        # Stage0 centers are (4*x+2, 4*y+2) in the original coordinate space.
        xs = geometry.native_pixel_centers(np.arange(geometry.width))
        ys = geometry.native_pixel_centers(np.arange(geometry.height))
        expected = np.frombuffer(native,dtype=np.uint8).reshape(768,1024)[np.ix_(ys,xs)]
        _need(np.array_equal(values,expected), "discrete source centers differ")
    return torch.from_numpy(values).float().div(255), sha256(values.tobytes()).hexdigest()


def _instance_geometry(conditions, table, order, geometry):
    from .native_rgb_structured_object_cpu_v17 import validate_bound_object_views
    _need(len({r["objectId"] for r in table}) == len(table), "duplicate object identity")
    views = validate_bound_object_views(conditions,table,order,geometry=geometry)
    _need(len(views) == len(table), "missing stage instance")
    rows = []
    for r,view in zip(table,views,strict=True):
        _need(view.instance_value == r["value"] and view.kind == r["kind"], "instance changed at stage resolution")
        core = int(view.subject_mask.sum().item())
        support = int(view.support_mask.sum().item())
        _need(0 < core <= support <= int(view.valid_mask.sum().item()), "invalid core/support area")
        rows.append({"objectId":r["objectId"],"value":r["value"],"kind":r["kind"],"footprint":deepcopy(r["footprint"]),
                     "role":view.role,"sourceCenterTolerance":geometry.native_half_pixel_tolerance,
                     "stagePatch":[view.left,view.top,geometry.patch_size,geometry.patch_size],
                     "corePixels":core,"supportPixels":support,"supportRadius":geometry.support_radius(view.role)})
    return rows


def load_live_natural_world_stage_input(*, root, descriptor_binding, stage=0):
    """Return the existing NaturalWorldModelInput type with a stage-specific tensor and provenance."""
    if type(stage) is not int or stage != 0:
        raise ValueError("only registered live Stage0 input is supported")
    import torch
    geometry = NativeStageGeometry(stage)
    # The existing native reader verifies the current Store, original receipts, world facts,
    # published weather capability, original spatial PNG pixels, table and visual regimes.
    native = load_live_natural_world_input(root=root,descriptor_binding=descriptor_binding,stage=2)
    reader = _Reader(root)
    desc = reader.json(descriptor_binding)
    _need(native.provenance["snapshot"] == descriptor_binding and native.identity == desc["identity"] and
          native.geometry.stage == 2 and list(native.conditions.shape) == desc["nativeShape"] == [1,23,768,1024],
          "wrong verified world or native geometry")
    _need(native.instance_table == desc["objectInstanceTable"] and native.provenance["weatherFieldsEncoded"] == [],
          "unverified objects or weather rendering")
    order = [channel["id"] for channel in desc["channels"]]
    contract = reader.json(desc["contract"])["tensorContract"]
    modes = _channel_modes(contract,order)
    channels, tensors = [], []
    for entry,mode in zip(desc["channels"],modes,strict=True):
        values,pixel_sha = _resample(reader.bytes(entry),mode,geometry,entry["pixelSha256"])
        tensors.append(values)
        channels.append({"id":entry["id"],"path":entry["path"],"sourceSha256":entry["sha256"],
                         "sourcePixelSha256":entry["pixelSha256"],"resample":mode,"stagePixelSha256":pixel_sha,
                         "stageFloatSha256":_tensor_sha(values)})
    conditions = torch.stack(tensors).contiguous()
    _need(conditions.shape == (23,192,256) and conditions.device.type == "cpu" and conditions.dtype == torch.float32
          and not conditions.requires_grad and bool(torch.isfinite(conditions).all()) and bool((conditions>=0).all())
          and bool((conditions<=1).all()), "invalid model input")
    records = _instance_geometry(conditions,native.instance_table,order,geometry)
    # Original world and immutable bytes must still agree at handoff.
    for entry in desc["channels"]:
        reader.verify(entry)
    reader.verify(desc["contract"])
    reader.verify(descriptor_binding)
    reader.verify(desc["head"])
    provenance = {**native.provenance,"stage":0,"nativeShape":desc["nativeShape"],"stageShape":[1,23,192,256],
        "channelOrder":order,"stageGeometry":list(geometry.identity()),"channels":channels,
        "instanceCoordinateSpace":"original_1024x768","stageCenterFormula":"4*i+2",
        "instanceGeometry":records,"instanceGeometrySha256":_digest(records),"stageTensorSha256":_tensor_sha(conditions),
        "originalSourceResizeOnly":True,"executionQualificationGranted":False}
    return replace(native,conditions=conditions.unsqueeze(0),geometry=geometry,provenance=provenance,
                   consumed_bindings=[*native.consumed_bindings,*reader.receipts])
