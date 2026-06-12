from __future__ import annotations


def build_image_loss(prediction, target, torch, config: dict[str, object]):
    weights = config.get("lossWeights", {})
    if not isinstance(weights, dict):
        weights = {}
    l1 = torch.nn.functional.l1_loss(prediction, target)
    edge = edge_loss(prediction, target, torch)
    texture = texture_loss(prediction, target, torch)
    total = (
        l1 * float(weights.get("l1", 1.0))
        + edge * float(weights.get("edge", 0.0))
        + texture * float(weights.get("texture", 0.0))
    )
    return total, {"l1": l1, "edge": edge, "texture": texture}


def edge_loss(prediction, target, torch):
    return torch.nn.functional.l1_loss(image_edges(prediction, torch), image_edges(target, torch))


def texture_loss(prediction, target, torch):
    return torch.nn.functional.l1_loss(local_contrast(prediction, torch), local_contrast(target, torch))


def image_edges(image, torch):
    horizontal = image[:, :, :, 1:] - image[:, :, :, :-1]
    vertical = image[:, :, 1:, :] - image[:, :, :-1, :]
    return torch.cat((horizontal[:, :, :-1, :], vertical[:, :, :, :-1]), dim=1)


def local_contrast(image, torch):
    mean = torch.nn.functional.avg_pool2d(image, kernel_size=3, stride=1, padding=1)
    return torch.abs(image - mean)
