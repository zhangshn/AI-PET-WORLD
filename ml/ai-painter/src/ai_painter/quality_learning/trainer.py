from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from PIL import Image

from ai_painter.dataset.hashing import sha256_file
from .contract import read_quality_sample
from .model import build_quality_judge_model


def train_quality_judge(dataset_root: Path, output_dir: Path, epochs: int = 30) -> dict[str, Any]:
    import numpy as np
    import torch
    import torch.nn.functional as functional

    records = _records(dataset_root / "samples")
    train_records, validation_records = _stratified_split(records)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_quality_judge_model().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-4, weight_decay=1e-4)
    best_accuracy = -1.0
    output_dir.mkdir(parents=True, exist_ok=True)
    weights_path = output_dir / "quality-judge.pt"

    for _ in range(epochs):
        model.train()
        random.shuffle(train_records)
        for image_path, label in train_records:
            image = _tensor(image_path, np, torch).unsqueeze(0).to(device)
            target = torch.tensor([label], dtype=torch.long, device=device)
            optimizer.zero_grad(set_to_none=True)
            loss = functional.cross_entropy(model(image), target)
            loss.backward()
            optimizer.step()
        accuracy = _accuracy(model, validation_records, device, np, torch)
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            torch.save(model.state_dict(), weights_path)

    manifest = {
        "schemaVersion": "vj-b2-model-manifest-v1",
        "architecture": "project-tiny-quality-judge-v1",
        "classes": ["unacceptable", "acceptable"],
        "inputSize": [128, 128],
        "acceptableThreshold": 0.8,
        "trainSampleCount": len(train_records),
        "validationSampleCount": len(validation_records),
        "bestValidationAccuracy": round(best_accuracy, 4),
        "weights": {"path": weights_path.name, "sha256": sha256_file(weights_path)},
        "device": str(device),
        "approvedForProduction": False,
    }
    (output_dir / "model-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    return manifest


def _records(samples_root: Path) -> list[tuple[Path, int]]:
    records = []
    for sample_dir in sorted(path for path in samples_root.iterdir() if path.is_dir()):
        value = read_quality_sample(sample_dir)
        records.append((sample_dir / "sprite.png", 1 if value["qualityLabel"] == "acceptable" else 0))
    return records


def _stratified_split(records: list[tuple[Path, int]]) -> tuple[list[tuple[Path, int]], list[tuple[Path, int]]]:
    train, validation = [], []
    for label in (0, 1):
        group = [record for record in records if record[1] == label]
        random.Random(20260614 + label).shuffle(group)
        validation_count = max(1, round(len(group) * 0.2))
        validation.extend(group[:validation_count])
        train.extend(group[validation_count:])
    return train, validation


def _tensor(path: Path, np, torch):
    with Image.open(path) as source:
        image = source.convert("RGB").resize((128, 128), Image.Resampling.NEAREST)
    array = np.asarray(image, dtype=np.float32) / 127.5 - 1.0
    return torch.from_numpy(array).permute(2, 0, 1)


def _accuracy(model, records, device, np, torch) -> float:
    model.eval()
    correct = 0
    with torch.no_grad():
        for image_path, label in records:
            prediction = model(_tensor(image_path, np, torch).unsqueeze(0).to(device)).argmax(1).item()
            correct += int(prediction == label)
    return correct / max(1, len(records))
