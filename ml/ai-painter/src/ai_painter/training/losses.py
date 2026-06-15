from __future__ import annotations


def build_image_loss(prediction, target, torch, config: dict[str, object], condition=None):
    weights = config.get("lossWeights", {})
    if not isinstance(weights, dict):
        weights = {}
    l1 = weighted_l1_loss(prediction, target, condition, torch, config)
    edge = edge_loss(prediction, target, torch)
    texture = texture_loss(prediction, target, torch)
    total = (
        l1 * float(weights.get("l1", 1.0))
        + edge * float(weights.get("edge", 0.0))
        + texture * float(weights.get("texture", 0.0))
    )
    return total, {"l1": l1, "edge": edge, "texture": texture}


def weighted_l1_loss(prediction, target, condition, torch, config: dict[str, object]):
    structure_weights = config.get("structureWeights", {})
    if condition is None or not isinstance(structure_weights, dict) or condition.shape[1] < 14:
        return torch.nn.functional.l1_loss(prediction, target)
    channel_indexes = {
        "water": 1, "shoreline": 2, "road": 3, "roadEdge": 4,
        "tree": 6, "rock": 7, "shelterFoundation": 8,
        "shelterWall": 9, "shelterRoof": 10, "constructionMaterial": 11,
    }
    weight_map = torch.ones_like(condition[:, :1])
    for name, index in channel_indexes.items():
        multiplier = float(structure_weights.get(name, 0.0))
        if multiplier > 0:
            weight_map = weight_map + condition[:, index:index + 1] * multiplier
    error = torch.abs(prediction - target)
    return (error * weight_map).sum() / (weight_map.sum() * prediction.shape[1]).clamp_min(1.0)


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
