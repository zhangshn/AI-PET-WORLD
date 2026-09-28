"""One bounded foundation epoch; component only, never a training admission gate.

The enclosing local lifecycle must authenticate the dataset release, program
graph, GPU budget and new model identity before invoking this component.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import math

import torch
from torch.utils.data import DataLoader

from .split_release import SplitReleaseDataset, canonical_bytes, digest
from .split_training import state_hash


def _require(value, message):
    if not value:
        raise ValueError(message)


def _loss(reconstruction, image, weights):
    result = torch.nn.functional.l1_loss(reconstruction, image) * weights["pixel"]
    if weights["edge"]:
        dx = torch.nn.functional.l1_loss(reconstruction[:, :, :, 1:] - reconstruction[:, :, :, :-1],
                                         image[:, :, :, 1:] - image[:, :, :, :-1])
        dy = torch.nn.functional.l1_loss(reconstruction[:, :, 1:, :] - reconstruction[:, :, :-1, :],
                                         image[:, :, 1:, :] - image[:, :, :-1, :])
        result = result + (dx + dy) * weights["edge"]
    if weights["laplacian"]:
        kernel = image.new_tensor([[0., -1., 0.], [-1., 4., -1.], [0., -1., 0.]])
        kernel = kernel.view(1, 1, 3, 3).repeat(image.shape[1], 1, 1, 1)
        lap = torch.nn.functional.l1_loss(
            torch.nn.functional.conv2d(reconstruction, kernel, padding=1, groups=image.shape[1]),
            torch.nn.functional.conv2d(image, kernel, padding=1, groups=image.shape[1]))
        result = result + lap * weights["laplacian"]
    return result


def _check_batch(batch, split, expected_id, release_identity):
    _require(batch.get("sampleId") == [expected_id] and batch.get("split") == [split]
             and batch.get("datasetReleaseIdentity") == [release_identity],
             "foundation batch identity mismatch")
    image = batch.get("image")
    _require(isinstance(image, torch.Tensor) and image.is_floating_point()
             and tuple(image.shape) == (1, 3, 192, 256)
             and torch.isfinite(image).all().item() and ((image >= 0) & (image <= 1)).all().item(),
             "foundation RGB tensor invalid")
    return image


@dataclass(frozen=True)
class PreparedFoundationData:
    """Authenticated train/validation RGB tensors for repeated bounded epochs."""

    dataset_binding: dict
    release_identity: str
    train_selection_sha256: str
    validation_selection_sha256: str
    train_sample_ids: tuple[str, ...]
    validation_sample_ids: tuple[str, ...]
    train_images: tuple[torch.Tensor, ...]
    validation_images: tuple[torch.Tensor, ...]


def prepare_isolated_foundation_data(*, train_dataset, validation_dataset):
    """Authenticate and decode the two permitted splits exactly once.

    Challenge and regression are deliberately not accepted as arguments and are
    never instantiated by this component.
    """
    _require(isinstance(train_dataset, SplitReleaseDataset)
             and isinstance(validation_dataset, SplitReleaseDataset), "bound Datasets required")
    _require(train_dataset.split == "train" and validation_dataset.split == "validation",
             "foundation split roles changed")
    _require(train_dataset.binding == validation_dataset.binding
             and train_dataset.manifest == validation_dataset.manifest
             and train_dataset.root == validation_dataset.root,
             "foundation dataset release mismatch")
    _require(not train_dataset.manifest.get("reviewOnly"),
             "review-only candidate cannot train the foundation")
    qualification = train_dataset.manifest.get("qualification", {})
    _require(qualification.get("foundationTrainingAllowed") is True
             and qualification.get("foundationTrainingRole") == "fresh_foundation_autoencoder_only"
             and qualification.get("denoiserTrainingAllowed") is False
             and qualification.get("trainingAllowed") is False,
             "foundation dataset does not permit the isolated fresh-foundation role")
    release_identity = train_dataset.manifest.get("datasetReleaseIdentity")
    _require(isinstance(release_identity, str) and bool(release_identity),
             "foundation dataset release identity missing")
    _require(train_dataset.image_size == validation_dataset.image_size == (256, 192),
             "foundation Stage0 resolution mismatch")
    ids = {}
    for split, dataset, count in (("train", train_dataset, 48),
                                  ("validation", validation_dataset, 8)):
        rows = dataset.rows
        ids[split] = [row["sampleId"] for row in rows]
        _require(len(dataset) == len(rows) == len(set(ids[split])) == count
                 and all(row["split"] == split for row in rows),
                 "foundation split membership invalid: " + split)
        _require(dataset.selection_sha256 == digest(canonical_bytes(rows)),
                 "foundation selected rows changed: " + split)
    _require(not set(ids["train"]) & set(ids["validation"]),
             "foundation train/validation overlap")

    verified = {}
    for split, dataset in (("train", train_dataset), ("validation", validation_dataset)):
        images = []
        for index, batch in enumerate(DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)):
            images.append(_check_batch(batch, split, ids[split][index], release_identity).cpu())
        _require(len(images) == len(ids[split]), "foundation preflight incomplete: " + split)
        verified[split] = tuple(images)
    return PreparedFoundationData(
        dataset_binding=deepcopy(train_dataset.binding), release_identity=release_identity,
        train_selection_sha256=train_dataset.selection_sha256,
        validation_selection_sha256=validation_dataset.selection_sha256,
        train_sample_ids=tuple(ids["train"]), validation_sample_ids=tuple(ids["validation"]),
        train_images=verified["train"], validation_images=verified["validation"],
    )


def run_isolated_foundation_epoch(*, autoencoder, optimizer, train_dataset,
                                  validation_dataset, device, loss_weights,
                                  prepared_data=None):
    """Train on 48 train images, then evaluate 8 validation images without updates.

    Never instantiate or read challenge/regression. No checkpoint, registry,
    qualification or retry is issued here. Exceptions propagate to the caller.
    """
    prepared = prepared_data or prepare_isolated_foundation_data(
        train_dataset=train_dataset, validation_dataset=validation_dataset)
    _require(isinstance(prepared, PreparedFoundationData), "prepared foundation data invalid")
    _require(prepared.dataset_binding == train_dataset.binding
             and prepared.release_identity == train_dataset.manifest.get("datasetReleaseIdentity")
             and prepared.train_selection_sha256 == train_dataset.selection_sha256
             and prepared.validation_selection_sha256 == validation_dataset.selection_sha256,
             "prepared foundation data no longer matches the bound release")
    _require(isinstance(autoencoder, torch.nn.Module)
             and callable(getattr(autoencoder, "encode", None))
             and callable(getattr(autoencoder, "decode", None)),
             "autoencoder implementation invalid")
    parameters = list(autoencoder.parameters())
    optimized = [value for group in optimizer.param_groups for value in group["params"]]
    _require(parameters and len(parameters) == len(optimized)
             and {id(value) for value in parameters} == {id(value) for value in optimized}
             and all(value.requires_grad for value in parameters),
             "foundation optimizer parameters differ")
    _require(isinstance(loss_weights, dict) and set(loss_weights) == {"pixel", "edge", "laplacian"}
             and all(type(value) in (float, int) and math.isfinite(value) and value >= 0
                     for value in loss_weights.values()) and sum(loss_weights.values()) > 0,
             "foundation loss weights invalid")
    weights = deepcopy(loss_weights)
    device = torch.device(device)
    autoencoder.train()
    before_training_model = state_hash(autoencoder.state_dict())
    train_losses = []
    for image in prepared.train_images:
        image = image.to(device)
        optimizer.zero_grad(set_to_none=True)
        reconstruction = autoencoder.decode(autoencoder.encode(image))
        loss = _loss(reconstruction, image, weights)
        _require(torch.isfinite(loss).item(), "foundation train loss nonfinite")
        loss.backward()
        optimizer.step()
        train_losses.append(float(loss.detach()))
    _require(len(train_losses) == 48, "foundation train epoch incomplete")
    _require(state_hash(autoencoder.state_dict()) != before_training_model,
             "foundation optimizer made no model update")
    autoencoder.eval()
    before_validation_model = state_hash(autoencoder.state_dict())
    before_validation_optimizer = state_hash(optimizer.state_dict())
    validation_losses = []
    with torch.no_grad():
        for image in prepared.validation_images:
            image = image.to(device)
            reconstruction = autoencoder.decode(autoencoder.encode(image))
            loss = _loss(reconstruction, image, weights)
            _require(torch.isfinite(loss).item(), "foundation validation loss nonfinite")
            validation_losses.append(float(loss))
    _require(len(validation_losses) == 8, "foundation validation epoch incomplete")
    _require(state_hash(autoencoder.state_dict()) == before_validation_model
             and state_hash(optimizer.state_dict()) == before_validation_optimizer,
             "foundation validation changed model or optimizer")
    return {"status": "component_epoch_complete_not_training_qualified",
            "datasetManifest": deepcopy(train_dataset.binding),
            "trainSampleIds": list(prepared.train_sample_ids),
            "validationSampleIds": list(prepared.validation_sample_ids),
            "optimizerSteps": len(train_losses), "nonTrainOptimizerSteps": 0,
            "trainLoss": sum(train_losses) / len(train_losses),
            "validationLoss": sum(validation_losses) / len(validation_losses),
            "challengeRead": False, "regressionRead": False,
            "checkpointWritten": False, "trainingAllowed": False}
