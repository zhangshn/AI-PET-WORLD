"""One-coordinate FP64 products/fsum of captured FP32 inputs, never model math."""
import math
import torch
from ai_painter.complete_world.parameter40_qualification_observation_v1 import (
    LABELS, SHAPE, TARGET0_NAME, TARGET0_SHAPE, TARGET0_SPATIAL, classified_scalar, require, sha)


def contrast(packet, metadata, resource):
    target0 = metadata.get("parameterIndex") == 0
    shape, spatial = (TARGET0_SHAPE, TARGET0_SPATIAL) if target0 else (SHAPE, (96, 128))
    if target0:
        require(metadata.get("parameterName") == TARGET0_NAME and metadata.get("shape") == list(shape),
                "exact target0 reference identity required")
    coordinate = tuple(metadata["coordinate"])
    require(len(coordinate) == 4 and all(type(v) is int and 0 <= v < size for v, size in zip(coordinate, shape)),
            "bound target40 coordinate required")
    require(set(packet) == {"input", *("adjoint." + label for label in LABELS), *("gradient." + label for label in LABELS)},
            "exact compact packet fields required")
    hashes = {key: sha(value) for key, value in packet.items()}
    require(all(hashes[key] == metadata["descriptors"][key]["sha256"] for key in packet), "packet byte digest differs")
    x = packet["input"]
    require(x.device.type == "cpu" and x.dtype == torch.float32 and not x.requires_grad
            and x.ndim == 4 and tuple(x.shape[:2]) == (1, 1), "detached single CPU input plane required")
    height, width = x.shape[-2:]
    require(0 < height <= spatial[0] and 0 < width <= spatial[1], "bounded reference spatial dimensions required")
    if target0:
        require(not metadata["productionGeometry"] or (height, width) == spatial, "target0 production plane geometry differs")
        gradients = [packet["gradient." + label] for label in LABELS]
        for label in LABELS:
            dy, dw = packet["adjoint." + label], packet["gradient." + label]
            require(dy.shape == x.shape and tuple(dw.shape) == shape and all(
                v.device.type == "cpu" and v.dtype == torch.float32 and not v.requires_grad
                and bool(torch.isfinite(v).all()) for v in (dy, dw)), "finite CPU reference evidence differs")
        expected = ((gradients[1] + gradients[2]) + gradients[3]) + gradients[4]
        sum_finite = bool(torch.isfinite(expected).all())
        require(metadata.get("componentSumFinite") is sum_finite
                and metadata.get("selectedExpected") == classified_scalar(expected[coordinate])
                and metadata.get("selectedValues") == {label: classified_scalar(value[coordinate])
                    for label, value in zip(LABELS, gradients)}, "target0 original value classification differs")
        require(not bool(torch.isclose(gradients[0][coordinate], expected[coordinate], atol=1e-6, rtol=1e-5)),
                "target0 selected coordinate is not an original violation")
        if not sum_finite:
            require({key: sha(value) for key, value in packet.items()} == hashes, "reference changed packet bytes")
            return dict(status="evidence_only", reasonCode="ordered_component_sum_nonfinite",
                coordinate=list(coordinate), componentSumFinite=False, localReferenceCount=0,
                selectedExpected=metadata["selectedExpected"], selectedValues=metadata["selectedValues"],
                originalAtol=1e-6, originalRtol=1e-5, productionGeometry=metadata["productionGeometry"],
                scope="saved_original_target_gradients_no_nonfinite_local_reference", modelUpdated=False)
    _, _, ky, kx = coordinate
    h0, h1 = max(0, 1 - ky), min(height, height + 1 - ky)
    w0, w1 = max(0, 1 - kx), min(width, width + 1 - kx)
    reference, native = [], []
    for label in LABELS:
        resource()
        dy, dw = packet["adjoint." + label], packet["gradient." + label]
        require(dy.shape == x.shape and tuple(dw.shape) == shape and all(
            v.device.type == "cpu" and v.dtype == torch.float32 and not v.requires_grad
            and bool(torch.isfinite(v).all()) for v in (dy, dw)), "finite CPU reference evidence differs")
        products = x[0, 0, h0 + ky - 1:h1 + ky - 1, w0 + kx - 1:w1 + kx - 1].double() * dy[0, 0, h0:h1, w0:w1].double()
        reference.append(math.fsum(products.reshape(-1).tolist()))
        native.append(dw[coordinate].clone())
    a = float(native[0])
    e = float(((native[1] + native[2]) + native[3]) + native[4])
    b, t, s = math.fsum(float(v) for v in native[1:]), reference[0], math.fsum(reference[1:])
    terms = {"upstreamAdjoints": t - s, "totalWeightReduction": a - t,
             "componentWeightReduction": b - s, "fp32ComponentSumRounding": b - e}
    reconstructed = ((terms["upstreamAdjoints"] + terms["totalWeightReduction"]) - terms["componentWeightReduction"]) + terms["fp32ComponentSumRounding"]
    residual = (a - e) - reconstructed
    require(all(math.isfinite(v) for v in (*reference, *terms.values(), residual)), "finite local reference required")
    require({key: sha(value) for key, value in packet.items()} == hashes, "reference changed packet bytes")
    return dict(coordinate=list(coordinate), nativeValues=[float(v) for v in native], referenceValues=reference,
        method="CPU_FP64_products_of_captured_FP32_planes_then_math_fsum", localReferenceCount=5,
        formula="A-E=(T-S)+(A-T)-(B-S)+(B-E)", observedDifference=a - e,
        terms=terms, reconstructionResidual=residual, originalAtol=1e-6, originalRtol=1e-5,
        scope="one_observed_weight_coordinate_not_full_model_reference_or_root_cause_proof",
        productionGeometry=metadata["productionGeometry"], modelUpdated=False)
