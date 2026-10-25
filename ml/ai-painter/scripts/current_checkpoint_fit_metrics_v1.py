"""Diagnostic regions only. No critic, Loss, optimizer or acceptance threshold."""
import math

ROLES = ("object_footprints", "object_tree", "object_rock", "object_vegetation")


def region_metrics(prediction, reference, mask):
    import torch
    pixels = int(mask.sum())
    result = {"pixels": pixels, "rgbMae": None, "correlation": None, "naReason": None}
    if not pixels:
        result["naReason"] = "empty_region"
        return result
    result["rgbMae"] = float((prediction[:, mask] - reference[:, mask]).abs().mean())
    if pixels < 2:
        result["naReason"] = "fewer_than_two_pixels"
        return result
    weights = prediction.new_tensor((.2126, .7152, .0722))[:, None, None]
    a = (prediction * weights).sum(0)[mask]
    b = (reference * weights).sum(0)[mask]
    a, b = a - a.mean(), b - b.mean()
    energy = b.square().sum()
    if float(energy) < 1e-8:
        result["naReason"] = "constant_reference_region"
    else:
        result["correlation"] = float(((a * b).sum() / torch.sqrt(a.square().sum() * energy + 1e-8)).clamp(-1, 1))
    return result


def sample_metrics(prediction, sample, order):
    from ai_painter.complete_world.native_rgb_object_support_structure_candidate_cpu_v1 import _visible_support
    support = _visible_support(sample["conditions"], sample["objectInstanceTable"], order)
    core = {role: sample["conditions"][list(order).index(role)] > .5 for role in ROLES}
    typed = {role: value[0, 0] for role, value in support.items()}
    union = core["object_footprints"].clone().fill_(False)
    for mask in typed.values():
        union |= mask
    typed["object_footprints"] = union
    return {"fullRgbMae": float((prediction[0] - sample["image"]).abs().mean()),
            "regions": {kind: {role: region_metrics(prediction[0], sample["image"], masks[role]) for role in ROLES}
                        for kind, masks in (("core", core), ("support", typed))}}


def summarize(rows):
    def aggregate(values):
        valid = [(sid, value) for sid, value in values if value is not None]
        return {"validCount": len(valid), "naCount": len(values) - len(valid),
                "mean": sum(v for _, v in valid) / len(valid) if valid else None,
                "minimum": min(valid, key=lambda pair: pair[1]) if valid else None,
                "maximum": max(valid, key=lambda pair: pair[1]) if valid else None}
    if not rows:
        return {"sampleCount": 0, "meanRgbMae": None, "regions": {}}
    for row in rows:
        if not math.isfinite(row["fullRgbMae"]):
            raise ValueError("nonfinite observation")
    return {"sampleCount": len(rows), "meanRgbMae": sum(r["fullRgbMae"] for r in rows) / len(rows),
            "regions": {kind: {role: {metric: aggregate([(r["sampleId"], r["regions"][kind][role][metric]) for r in rows])
                                      for metric in ("rgbMae", "correlation")}
                               for role in ROLES} for kind in ("core", "support")}}
