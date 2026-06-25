from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import re
import shutil


def preserve_runtime_dir_before_clear(target: Path, reason: str) -> Path | None:
    target = Path(target)
    if not target.exists() or not target.is_dir():
        return None

    runtime_root = Path(".runtime") / "ai-painter"
    try:
        relative = target.resolve().relative_to(runtime_root.resolve())
    except ValueError:
        return None

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S-%fZ")
    backup_root = runtime_root / "training-run-history" / "pre-clear" / f"{stamp}-{_safe_segment(reason)}"
    backup_dir = backup_root / relative
    backup_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(target, backup_dir)
    return backup_dir


def _safe_segment(value: str) -> str:
    segment = re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-")
    return segment or "training-output"
