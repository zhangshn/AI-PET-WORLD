"""Pure timing consistency; never authenticates/adopts a policy or starts a Run."""
import math

LEGACY_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_v1"
COMPLETION_CAPABILITY = "stage4_mvp256_dry_decode1_entry_weight_quality24_completion_v1"
COMPLETION_SELECTOR = "decode1-entry-weight-quality-completion-v1"


def require(ok, message):
    if not ok: raise ValueError(message)


def _finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def validate_training_clock(capability_version, ceiling, contract=None):
    require(type(ceiling) is dict, "training ceiling required")
    for key, value in dict(epochs=24, generatorOptimizerSteps=1152, discriminatorOptimizerSteps=1152).items():
        require(type(ceiling.get(key)) is int and ceiling[key] == value, "fixed completion schedule " + key)
    if capability_version == LEGACY_CAPABILITY:
        require(type(ceiling.get("maxWallSeconds")) is int and ceiling["maxWallSeconds"] == 8400,
            "legacy training deadline stays8400")
        require(ceiling.get("trainingWallMode", "wall_clock") == "wall_clock", "legacy cannot inherit completion mode")
        require(contract is None or contract.get("capabilityVersion") == LEGACY_CAPABILITY, "cross-route timing contract")
        return dict(trainingWallMode="wall_clock", maxWallSeconds=8400)
    require(capability_version == COMPLETION_CAPABILITY, "unknown training capability")
    require(ceiling.get("trainingWallMode") == "completion", "explicit completion mode required")
    require("maxWallSeconds" in ceiling and ceiling["maxWallSeconds"] is None, "completion deadline must be actual null")
    require(type(contract) is dict and contract.get("capabilityVersion") == COMPLETION_CAPABILITY
        and contract.get("trainingWallMode") == "completion" and "maxWallSeconds" in contract
        and contract["maxWallSeconds"] is None and contract.get("candidateSelection") == COMPLETION_SELECTOR,
        "registered contract values required")
    return dict(trainingWallMode="completion", maxWallSeconds=None)


def phase_maximum_seconds(phase, timing):
    if phase == "training":
        require(type(timing) is dict and timing.get("trainingWallMode") in ("wall_clock", "completion"), "training timing required")
        expected = None if timing["trainingWallMode"] == "completion" else 8400
        require(timing.get("maxWallSeconds", object()) == expected, "training mode/ceiling differs")
        return expected
    phases = dict(cpu=240, qualification=720, review=120, validation=120, adjudication=120, finalization=120)
    require(phase in phases, "unknown finite phase")
    return phases[phase]


def execution_deadline(started_seconds, timing):
    require(_finite(started_seconds) and started_seconds >= 0, "finite actual start required")
    seconds = phase_maximum_seconds("training", timing)
    return None if seconds is None else started_seconds + seconds


def require_execution_time(now, deadline):
    require(_finite(now) and now >= 0, "finite monotonic observation required")
    if deadline is not None:
        require(_finite(deadline) and deadline >= 0, "finite deadline or explicit null required")
        require(now < deadline, "training wall deadline exhausted")


def publication_deadline(now, deadline):
    require_execution_time(now, deadline)
    return now + .250 if deadline is None else min(deadline, now + .250)


def observed_elapsed_seconds(started, ended):
    require(_finite(started) and started >= 0, "actual monotonic start required")
    if ended is None: return None
    require(_finite(ended) and ended >= started, "actual monotonic end required")
    return ended - started
