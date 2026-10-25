"""Assemble bound existing PNGs; no model loading or inference."""
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).absolute().parents[3]
sys.path[:0] = [str(ROOT / "ml/ai-painter/scripts"), str(ROOT / "ml/ai-painter/src")]
from decode1_entry_weight_quality_auth_v1 import Reader
from current_checkpoint_fit_metrics_v1 import summarize

CASE = ".runtime/ai-painter/controller-repair-reviews/fit-comparison-006-20261022/evaluation-v1"


def build():
    reader = Reader(ROOT)
    terminal_binding = {"path": CASE + "/terminal.json", "sha256": "2bfc0384f7a0d93041451edb4de84040dd485542d3007f98bb5d5915affa8cfe"}
    terminal = reader.json(terminal_binding)
    if terminal["status"] != "completed" or terminal["modelForwardCalls"] != 56:
        raise ValueError("exact completed FIT006 required")
    rows = terminal["trainRows"]
    # Deterministic samples, not manually selected good-looking outputs.
    selected = [rows[i] for i in (0, 18, 24, 47)]
    canvas = Image.new("RGB", (512, 4 * 220 + 32), "#f4f6fa")
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 8), "Train reference (256 x 192) | Final checkpoint prediction", fill="#122030")
    for index, row in enumerate(selected):
        y = 32 + index * 220
        reference = Image.open(io.BytesIO(reader.read(row["sourceRgb"]))).convert("RGB").resize((256, 192), Image.Resampling.LANCZOS)
        prediction = Image.open(io.BytesIO(reader.read(row["predictionPng"]))).convert("RGB")
        if prediction.size != (256, 192):
            raise ValueError("prediction size differs")
        canvas.paste(reference, (0, y)); canvas.paste(prediction, (256, y))
        draw.text((8, y + 196), row["sampleId"].split("slot-")[-1], fill="#122030")
    raw = io.BytesIO(); canvas.save(raw, format="PNG")
    output = CASE + "/train-reference-prediction-grid-v1.png"
    target = reader.path(output)
    if target.exists():
        raise ValueError("comparison grid already exists")
    # 1 MiB reserved for native transport evidence outside this evaluation root.
    existing_bytes = sum(p.stat().st_size for p in target.parent.rglob("*") if p.is_file())
    if existing_bytes + len(raw.getvalue()) > 7 * 1024 ** 2:
        raise ValueError("bounded comparison output exhausted")
    reader.unchanged()
    with target.open("xb") as stream:
        stream.write(raw.getvalue())
    grid = {"path": output, "sha256": hashlib.sha256(raw.getvalue()).hexdigest()}
    print(json.dumps({"observedAtUtc": datetime.now(timezone.utc).isoformat(), "terminal": terminal_binding,
                      "train": summarize(rows), "validation": summarize(terminal["validationRows"]),
                      "grid": grid, "gridSampleIds": [r["sampleId"] for r in selected], "modelForwardCalls": 0}))


if __name__ == "__main__":
    build()
