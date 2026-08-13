from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import time
from uuid import uuid4


WINDOWS_ATOMIC_REPLACE_RETRY_ATTEMPTS = 8
WINDOWS_ATOMIC_REPLACE_RETRY_BASE_SECONDS = 0.05
WINDOWS_TRANSIENT_ATOMIC_REPLACE_ERROR_CODES = frozenset({5, 32, 33})


def build_live_progress(
    *,
    phase,
    epoch,
    epoch_target,
    batch,
    batch_target,
    optimizer_step,
    optimizer_step_target,
    started_monotonic,
    batch_loss=None,
    rolling_epoch_loss=None,
    last_batch_duration_seconds=None,
    samples_in_batch=None,
    validation_score=None,
    checkpoint_score=None,
    local_denoiser_sample_forward_passes=None,
    local_training_token_count=None,
):
    elapsed_seconds = max(0.0, time.perf_counter() - started_monotonic)
    steps_per_second = optimizer_step / elapsed_seconds if optimizer_step > 0 and elapsed_seconds > 0 else None
    remaining_steps = max(0, optimizer_step_target - optimizer_step)
    eta_seconds = remaining_steps / steps_per_second if steps_per_second else None
    percentage = (
        min(100.0, optimizer_step / optimizer_step_target * 100.0)
        if optimizer_step_target > 0
        else None
    )
    return {
        "schemaVersion": "ai-assisted-v7-batch-live-progress-v1",
        "recordedAtUtc": utc_now(),
        "recordedAtAsiaShanghai": asia_shanghai_now(),
        "phase": phase,
        "epoch": epoch,
        "epochTarget": epoch_target,
        "batch": batch,
        "batchTarget": batch_target,
        "optimizerStep": optimizer_step,
        "optimizerStepTarget": optimizer_step_target,
        "percentage": round(percentage, 4) if percentage is not None else None,
        "elapsedSeconds": round(elapsed_seconds, 3),
        "etaSeconds": round(eta_seconds, 3) if eta_seconds is not None else None,
        "optimizerStepsPerSecond": round(steps_per_second, 6) if steps_per_second is not None else None,
        "batchLoss": round(float(batch_loss), 8) if batch_loss is not None else None,
        "rollingEpochLoss": round(float(rolling_epoch_loss), 8) if rolling_epoch_loss is not None else None,
        "lastBatchDurationSeconds": round(float(last_batch_duration_seconds), 6) if last_batch_duration_seconds is not None else None,
        "samplesInBatch": int(samples_in_batch) if samples_in_batch is not None else None,
        "validationCompositeScore": round(float(validation_score), 8) if validation_score is not None else None,
        "checkpointSelectionScore": round(float(checkpoint_score), 8) if checkpoint_score is not None else None,
        "localDenoiserSampleForwardPasses": int(local_denoiser_sample_forward_passes) if local_denoiser_sample_forward_passes is not None else None,
        "localTrainingTokenCount": int(local_training_token_count) if local_training_token_count is not None else None,
        "localTrainingTokenUnit": "one_latent_spatial_position_processed_by_one_denoiser_sample_forward_pass",
    }


def write_json_atomic(path, value):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(
        f".{target.name}.{os.getpid()}.{uuid4().hex}.tmp"
    )
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        replace_atomic_with_bounded_windows_retry(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()


def replace_atomic_with_bounded_windows_retry(source, target):
    attempts = WINDOWS_ATOMIC_REPLACE_RETRY_ATTEMPTS if os.name == "nt" else 1
    for attempt in range(attempts):
        try:
            os.replace(source, target)
            return
        except PermissionError as error:
            if (
                os.name != "nt"
                or getattr(error, "winerror", None)
                not in WINDOWS_TRANSIENT_ATOMIC_REPLACE_ERROR_CODES
                or attempt + 1 >= attempts
            ):
                raise
            time.sleep(WINDOWS_ATOMIC_REPLACE_RETRY_BASE_SECONDS * (attempt + 1))


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def asia_shanghai_now():
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")
