"""Pure CPU authentication of an existing original gate traceback and tensors."""
import hashlib
from pathlib import Path
import types

ROOT = Path(__file__).absolute().parents[3]

def require(ok, text):
    if not ok:
        raise ValueError(text)


def code_identity(code):
    return (code.co_code, tuple(code_identity(v) if isinstance(v, types.CodeType) else v for v in code.co_consts),
            code.co_names, code.co_varnames, code.co_freevars, code.co_cellvars, code.co_flags,
            code.co_argcount, code.co_kwonlyargcount, code.co_firstlineno, code.co_linetable, code.co_exceptiontable)


def authenticate_gate(error, observation, programs):
    import torch
    from ai_painter.complete_world import object_joint_rgb_structure_priority_update_cpu_v1 as gate
    from ai_painter.complete_world.parameter40_qualification_observation_v1 import Target0Observation, Target40Observation, sha
    targets = {
        0: (Target0Observation, "core.core.terrain.base_stem.layers.0.weight", (48, 31, 3, 3)),
        40: (Target40Observation, "core.core.terrain.decode_2.layers.0.weight", (96, 192, 3, 3)),
    }
    index = getattr(observation, "index", None)
    require(type(index) is int and index in targets, "fixed original gradient target required")
    target_type, target_name, target_shape = targets[index]
    require(type(observation) is target_type and observation.name == target_name
            and observation.shape == target_shape, "original gradient target identity differs")
    require(type(error) is ValueError
            and str(error) == "actual four-term total gradient identity differs at parameter " + str(index),
            "not the original target gradient gate")
    names = ("total_gradients", "structured_gradients", "whole_frame_gradients", "core_gradients", "support_gradients")
    raw = getattr(observation, "raw", None)
    require(type(raw) in (list, tuple) and len(raw) == len(names), "complete five original gradient sets required")

    def validate_target(value):
        # Reject devices before sha(), whose normalization otherwise calls cpu().
        # Individual terms are finite; their ordered sum may legitimately overflow
        # at the original gate and must remain available as failure evidence.
        require(type(value) is torch.Tensor and value.device.type == "cpu"
                and value.dtype == torch.float32 and value.layout == torch.strided
                and tuple(value.shape) == target_shape and not value.requires_grad,
                "original target gradient metadata differs")
        require(bool(torch.isfinite(value).all()), "finite original target gradient required")

    for captured in raw:
        validate_target(captured)
    function = gate.apply_object_joint_rgb_structure_priority_update_cpu
    for fn in (function, gate.require):
        logical = Path(fn.__code__.co_filename).absolute().relative_to(ROOT).as_posix()
        source = (ROOT / logical).read_bytes()
        require(hashlib.sha256(source).hexdigest() == programs[logical]["sha256"], "gate/helper source identity differs")
        compiled = compile(source, fn.__code__.co_filename, "exec", dont_inherit=True)
        expected = next(v for v in compiled.co_consts if isinstance(v, types.CodeType) and v.co_name == fn.__name__)
        require(code_identity(expected) == code_identity(fn.__code__), "loaded gate/helper code differs")
    frames, tb = [], error.__traceback__
    while tb is not None:
        frames.append(tb)
        tb = tb.tb_next
    matches = [t for t in frames if t.tb_frame.f_code is function.__code__]
    require(len(matches) == 1 and frames[-1].tb_frame.f_code is gate.require.__code__, "original gate traceback differs")
    local = matches[0].tb_frame.f_locals
    require(local.get("i") == index, "wrong original failed parameter")
    for position, name in enumerate(names):
        rows = local.get(name)
        require(type(rows) in (list, tuple) and len(rows) == 108, "complete original gate gradient set required")
        validate_target(rows[index])
        require(sha(rows[index]) == sha(raw[position]), "gate and same-call gradient bytes differ")
    return {"type": type(error).__name__, "message": str(error), "parameterIndex": index,
            "gateLine": matches[0].tb_lineno, "sameCallInputsVerified": True,
            "verifiedGradientSets": len(names), "historicalReplay": False}

