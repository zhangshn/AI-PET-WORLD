"""Target48 qualification bridge: five actual VJPs, genuine parent CPU arithmetic."""
from contextlib import contextmanager
from contextvars import ContextVar
import torch
from ai_painter.complete_world import object_ecology_decode1_entry_weight_precision_v1 as identity
from ai_painter.complete_world import object_ecology_final_rgb_base_weight_precision_v1 as parent
from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as frozen
from ai_painter.complete_world.object_head_core_priority_update_v24_cpu import OBJECT_HEAD_KEYS, _validate_model_and_parameters
from ai_painter.complete_world.object_head_core_priority_update_v24 import _autocast_enabled, generator_full_fp32_backend

CAPABILITY = "stage4_mvp256_dry_decode1_entry_gpu_qualification_v1"
MODEL_CAPABILITY = identity.CAPABILITY
CANDIDATE_ID = CAPABILITY
UPDATE_RULE_ID = frozen.CANDIDATE_ID
EXECUTION_QUALIFIED = False
COMPONENTS_IN_ORDER = frozen.COMPONENTS_IN_ORDER
require = frozen.require
_OBSERVER = ContextVar("decode1_entry_qualification_gradient_observer", default=None)


@contextmanager
def observe_generator_gradients(observer):
    token = _OBSERVER.set(observer)
    try:
        yield
    finally:
        _OBSERVER.reset(token)


def bind_parameters(model):
    identity.validate_model_identity(model)
    parameters = tuple(model.parameters())
    device = parameters[0].device
    require(torch.get_num_threads() <= 2 and not _autocast_enabled(torch), "CPU<=2/no autocast required")
    require(all(p.requires_grad and p.device == device and p.dtype == torch.float32 for p in parameters)
        and all(v.device == device for v in model.buffers()), "complete trainable single-device FP32 generator required")
    if device.type == "cuda":
        require(torch.backends.cuda.matmul.fp32_precision == "ieee" and torch.backends.cudnn.conv.fp32_precision == "ieee",
                "generator IEEE FP32 required")
    require(set(model.object_rgb_heads) == set(OBJECT_HEAD_KEYS), "four actual heads required")
    by_id = {id(p): i for i, p in enumerate(parameters)}
    groups = {key: tuple(by_id[id(p)] for p in model.object_rgb_heads[key].parameters()) for key in OBJECT_HEAD_KEYS}
    if device.type == "cpu":
        checked, cpu_groups = _validate_model_and_parameters(model, parameters)
        require(all(a is b for a, b in zip(checked, parameters)) and cpu_groups == groups, "canonical CPU groups differ")
    owned = [i for rows in groups.values() for i in rows]
    require(len(owned) == len(set(owned)) == 16 and sum(parameters[i].numel() for i in owned) == 4876
        and all(len(rows) == 4 and sum(parameters[i].numel() for i in rows) == 1219 for rows in groups.values()), "head groups differ")
    season = by_id[id(identity.seasonal_parameter(model))]
    ecology = by_id[id(identity.ecological_parameter(model))]
    require(season != ecology and season not in owned and ecology not in owned, "season/ecology/head aliases")
    return parameters, groups, season, ecology


def _verify_carrier(model, carrier):
    identity.validate_model_identity(model)
    frozen.bind_parameters(carrier)
    actual, copied = tuple(model.named_parameters()), tuple(carrier.named_parameters())
    require(len(actual) == len(copied) == 108 and carrier.capability_version == parent.CAPABILITY
        and carrier.capability_version != MODEL_CAPABILITY and not carrier.execution_qualified,
        "genuine distinct inactive finalRGB arithmetic carrier required")
    for (name, value), (other, target) in zip(actual, copied):
        require(name == other and value.shape == target.shape and value.dtype == target.dtype
            and value is not target and value.untyped_storage()._cdata != target.untyped_storage()._cdata
            and torch.equal(value.detach().cpu().contiguous().reshape(-1).view(torch.uint8),
                            target.detach().reshape(-1).view(torch.uint8)), "carrier full parameter name/shape/byte/isolation differs")


def _cpu_carrier(model):
    identity.validate_model_identity(model)
    carrier = parent.build_fresh_object_ecology_final_rgb_base_weight_precision(condition_channel_order=model.condition_channel_order)
    state = {name: value.detach().clone() for name, value in carrier.state_dict().items()}
    for name, value in model.named_parameters():
        require(name in state and state[name].shape == value.shape, "carrier parameter graph differs")
        state[name] = value.detach().cpu().clone()
    carrier.load_state_dict(state, strict=True, assign=False)
    _verify_carrier(model, carrier)
    return carrier


def _validated(rows, parameters, label):
    require(len(rows) == len(parameters), label + " complete gradients required")
    values, used = [], set()
    for value, parameter in zip(rows, parameters):
        if value is None:
            values.append(torch.zeros_like(parameter))
            continue
        require(isinstance(value, torch.Tensor) and id(value) not in used and value.shape == parameter.shape
            and value.device == parameter.device and value.dtype == torch.float32 and bool(torch.isfinite(value).all()),
            label + " gradient metadata/finite/alias differs")
        used.add(id(value))
        values.append(value)
    return tuple(values)


def compute_generator_candidate_gradients(*, model, critic, sample, actual_total, structured_objective,
        whole_frame_fidelity, object_core_rgb, object_support_structure):
    parameters, groups, season, ecology = bind_parameters(model)
    device = parameters[0].device
    require(sample.get("split") == "train", "train-only generator gradients")
    for key, shape in (("image", (3, 192, 256)), ("conditions", (23, 192, 256))):
        value = sample.get(key)
        require(isinstance(value, torch.Tensor) and tuple(value.shape) == shape and value.device == device
            and value.dtype == torch.float32 and not value.requires_grad and bool(torch.isfinite(value).all())
            and bool(((value >= 0) & (value <= 1)).all()), "detached device FP32 train tensors required")
    require(isinstance(critic, torch.nn.Module) and all(not m.training for m in critic.modules())
        and all(not p.requires_grad for p in critic.parameters()) and all(v.device == device
            and (not v.is_floating_point() or v.dtype == torch.float32) and bool(torch.isfinite(v).all())
            for v in (*critic.parameters(), *critic.buffers())), "finite frozen eval device critic required")
    losses = (actual_total, structured_objective, whole_frame_fidelity, object_core_rgb, object_support_structure)
    require(all(isinstance(v, torch.Tensor) and v.shape == torch.Size([]) and v.device == device
        and v.dtype == torch.float32 and v.requires_grad and bool(torch.isfinite(v.detach())) for v in losses),
        "five differentiable device FP32 scalar objectives required")
    expected = (((structured_objective.float() + whole_frame_fidelity).float() + object_core_rgb).float() + object_support_structure)
    require(torch.equal(actual_total.detach(), expected.detach()), "exact ordered four-term scalar formula differs")
    raw = []
    try:
        observer = _OBSERVER.get()
        for i, (label, loss) in enumerate(zip(COMPONENTS_IN_ORDER, losses)):
            if observer is not None:
                observer("attempt", label, None)
            rows = torch.autograd.grad(loss, parameters, retain_graph=i < 4, create_graph=False, allow_unused=True)
            raw.append(rows)
            if observer is not None:
                observer("complete", label, rows)
        actual = _validated(raw[0], parameters, "actualTotal")
        for label, rows in zip(COMPONENTS_IN_ORDER[1:], raw[1:]):
            _validated(rows, parameters, label)
        carrier = _cpu_carrier(model)
        copied = [tuple(None if v is None else v.detach().cpu().clone() for v in rows) for rows in raw]
        cpu_candidate, facts = frozen.apply_object_joint_rgb_structure_priority_update_cpu(model=carrier,
            parameters=tuple(carrier.parameters()), total_gradients=copied[0], structured_gradients=copied[1],
            whole_frame_gradients=copied[2], core_gradients=copied[3], support_gradients=copied[4])
        _verify_carrier(model, carrier)
        result = list(actual)
        for key, indexes in groups.items():
            for index in indexes:
                if facts["headDiagnostics"][key]["branch"] == "conflict_projected":
                    result[index] = cpu_candidate[index].to(device=device)
                else:
                    require(torch.equal(cpu_candidate[index].reshape(-1).view(torch.uint8),
                        actual[index].detach().cpu().reshape(-1).view(torch.uint8)), "nonconflict actual head bytes changed")
        owned = {i for indexes in groups.values() for i in indexes}
        require(all(result[i] is actual[i] for i in range(108) if i not in owned)
            and result[season] is actual[season] and result[ecology] is actual[ecology], "nonhead actual gradient identity changed")
        facts.update(candidateId=CAPABILITY, modelCapabilityVersion=MODEL_CAPABILITY, updateRuleId=UPDATE_RULE_ID,
            arithmeticCarrierCapabilityVersion=parent.CAPABILITY, carrierAllParameterNamesShapesBytesVerified=True,
            carrierQualificationInherited=False, jointCpuAlgorithmUnchanged=True, actualTotalProvenanceVerified=True,
            autogradGradCalls=5, independentFullParameterGradientTensorCounts=[108] * 5,
            actualTotalIndependentFullModelGradient=True, cpuCopiedParameterTensorCount=108, cpuCopiedParameterElementCount=2242687,
            scalarValues={label: float(loss.detach()) for label, loss in zip(COMPONENTS_IN_ORDER, losses)},
            generatorGradientFacts={"tensorCount": 108, "allFinite": True,
                "nonzeroTensorCount": sum(bool(v.count_nonzero()) for v in result),
                "headCandidateL2": {key: float(torch.cat([result[i].reshape(-1) for i in indexes]).norm())
                    for key, indexes in groups.items()}})
        return tuple(result), facts
    except BaseException as error:
        # Bounded diagnostics only: never attach/serialize a full saved-gradient archive.
        try:
            error.decode1_entry_gradient_summary = {"gradientSetsAvailable": len(raw), "sets": [
                {"label": COMPONENTS_IN_ORDER[i], "tensorCount": len(rows), "unusedTensorCount": sum(v is None for v in rows),
                 "allFinite": all(v is None or bool(torch.isfinite(v).all()) for v in rows)} for i, rows in enumerate(raw)]}
        except BaseException:
            pass
        raise
