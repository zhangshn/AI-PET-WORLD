from __future__ import annotations


def build_image_loss(prediction, target, torch, config: dict[str, object], condition=None):
    weights = config.get("lossWeights", {})
    if not isinstance(weights, dict):
        weights = {}
    focus_mask = build_focus_loss_mask(condition, torch, config)
    loss_prediction = focus_prediction_for_loss(prediction, target, focus_mask)
    l1 = weighted_l1_loss(loss_prediction, target, condition, torch, config, focus_mask)
    edge = edge_loss(loss_prediction, target, torch)
    texture = texture_loss(loss_prediction, target, torch)
    laplacian = laplacian_loss(loss_prediction, target, torch)
    gradient = gradient_loss(loss_prediction, target, torch)
    color_range = color_range_loss(loss_prediction, target, torch)
    water_periodicity_weight = float(weights.get("waterPeriodicity", 0.0))
    water_periodicity = (
        water_periodicity_loss(prediction, target, condition, torch, config)
        if water_periodicity_weight > 0.0
        else prediction.new_tensor(0.0)
    )
    total = (
        l1 * float(weights.get("l1", 1.0))
        + edge * float(weights.get("edge", 0.0))
        + texture * float(weights.get("texture", 0.0))
        + laplacian * float(weights.get("laplacian", 0.0))
        + gradient * float(weights.get("gradient", 0.0))
        + color_range * float(weights.get("colorRange", 0.0))
        + water_periodicity * water_periodicity_weight
    )
    return total, {
        "l1": l1,
        "edge": edge,
        "texture": texture,
        "laplacian": laplacian,
        "gradient": gradient,
        "colorRange": color_range,
        "waterPeriodicity": water_periodicity,
    }


def weighted_l1_loss(prediction, target, condition, torch, config: dict[str, object], focus_mask=None):
    structure_weights = config.get("structureWeights", {})
    if condition is None or not isinstance(structure_weights, dict) or condition.shape[1] < 14:
        return torch.nn.functional.l1_loss(prediction, target)
    channel_indexes = {
        "grass": 0, "water": 1, "shoreline": 2, "road": 3, "roadEdge": 4,
        "tree": 6, "rock": 7, "shelterFoundation": 8,
        "shelterWall": 9, "shelterRoof": 10, "constructionMaterial": 11,
    }
    weight_map = torch.ones_like(condition[:, :1])
    for name, index in channel_indexes.items():
        multiplier = float(structure_weights.get(name, 0.0))
        if multiplier > 0:
            weight_map = weight_map + condition[:, index:index + 1] * multiplier
    if focus_mask is not None:
        weight_map = weight_map + focus_mask * float(config.get("focusLossBoost", 4.0))
    error = torch.abs(prediction - target)
    return (error * weight_map).sum() / (weight_map.sum() * prediction.shape[1]).clamp_min(1.0)


def build_focus_loss_mask(condition, torch, config: dict[str, object]):
    if condition is None or condition.shape[1] < 14:
        return None
    channels = config.get("focusLossChannels", [])
    if not isinstance(channels, list) or not channels:
        return None
    channel_indexes = {
        "grass": 0,
        "water_body": 1,
        "shoreline": 2,
        "road_center": 3,
        "road_edge": 4,
        "tree_trunk": 5,
        "tree_crown": 6,
        "rock": 7,
        "walkable": 12,
        "depth": 13,
    }
    mask = torch.zeros_like(condition[:, :1])
    for channel in channels:
        index = channel_indexes.get(str(channel))
        if index is not None:
            mask = torch.maximum(mask, condition[:, index:index + 1])
    return mask.clamp(0.0, 1.0)


def focus_prediction_for_loss(prediction, target, focus_mask):
    if focus_mask is None:
        return prediction
    return prediction * focus_mask + target.detach() * (1.0 - focus_mask)


def edge_loss(prediction, target, torch):
    return torch.nn.functional.l1_loss(image_edges(prediction, torch), image_edges(target, torch))


def texture_loss(prediction, target, torch):
    return torch.nn.functional.l1_loss(local_contrast(prediction, torch), local_contrast(target, torch))


def laplacian_loss(prediction, target, torch):
    return torch.nn.functional.l1_loss(laplacian_filter(prediction, torch), laplacian_filter(target, torch))


def gradient_loss(prediction, target, torch):
    pred_horizontal, pred_vertical = image_gradients(prediction)
    target_horizontal, target_vertical = image_gradients(target)
    return (
        torch.nn.functional.l1_loss(pred_horizontal, target_horizontal)
        + torch.nn.functional.l1_loss(pred_vertical, target_vertical)
    ) * 0.5


def color_range_loss(prediction, target, torch):
    pred_range = prediction.amax(dim=(2, 3)) - prediction.amin(dim=(2, 3))
    target_range = target.amax(dim=(2, 3)) - target.amin(dim=(2, 3))
    return torch.nn.functional.l1_loss(pred_range, target_range)


def water_periodicity_loss(prediction, target, condition, torch, config: dict[str, object]):
    if condition is None or condition.shape[1] < 2:
        return prediction.new_tensor(0.0)

    guard = config.get("waterArtifactGuard", {})
    if not isinstance(guard, dict):
        guard = {}
    periods = guard.get("periods", [8, 16, 24, 32])
    if not isinstance(periods, list) or not periods:
        periods = [8, 16, 24, 32]
    allowed_ratio = float(guard.get("allowedRatio", 1.08))
    margin = float(guard.get("margin", 0.0025))

    water_mask = condition[:, 1:2].clamp(0.0, 1.0)
    prediction_excess = periodic_grid_excess(prediction, water_mask, torch, periods, allowed_ratio)
    target_excess = periodic_grid_excess(target, water_mask, torch, periods, allowed_ratio).detach()
    return torch.relu(prediction_excess - target_excess - margin)


def periodic_grid_excess(image, water_mask, torch, periods, allowed_ratio: float):
    gray = image.mean(dim=1, keepdim=True)
    horizontal = torch.abs(gray[:, :, :, 1:] - gray[:, :, :, :-1])
    vertical = torch.abs(gray[:, :, 1:, :] - gray[:, :, :-1, :])
    mask_horizontal = water_mask[:, :, :, 1:] * water_mask[:, :, :, :-1]
    mask_vertical = water_mask[:, :, 1:, :] * water_mask[:, :, :-1, :]

    baseline = masked_mean(horizontal, mask_horizontal) + masked_mean(vertical, mask_vertical)
    penalties = []
    for raw_period in periods:
        period = int(raw_period)
        if period <= 1:
            continue
        horizontal_grid = periodic_column_mask(horizontal, torch, period)
        vertical_grid = periodic_row_mask(vertical, torch, period)
        grid_value = (
            masked_mean(horizontal, mask_horizontal * horizontal_grid)
            + masked_mean(vertical, mask_vertical * vertical_grid)
        )
        penalties.append(torch.relu(grid_value - baseline * allowed_ratio))
    if not penalties:
        return image.new_tensor(0.0)
    return torch.stack(penalties).mean()


def periodic_column_mask(value, torch, period: int):
    width = value.shape[3]
    columns = torch.arange(width, device=value.device)
    mask = ((columns + 1) % period == 0).to(dtype=value.dtype)
    return mask.view(1, 1, 1, width)


def periodic_row_mask(value, torch, period: int):
    height = value.shape[2]
    rows = torch.arange(height, device=value.device)
    mask = ((rows + 1) % period == 0).to(dtype=value.dtype)
    return mask.view(1, 1, height, 1)


def masked_mean(value, mask):
    return (value * mask).sum() / mask.sum().clamp_min(1.0)


def image_edges(image, torch):
    horizontal = image[:, :, :, 1:] - image[:, :, :, :-1]
    vertical = image[:, :, 1:, :] - image[:, :, :-1, :]
    return torch.cat((horizontal[:, :, :-1, :], vertical[:, :, :, :-1]), dim=1)


def image_gradients(image):
    horizontal = image[:, :, :, 1:] - image[:, :, :, :-1]
    vertical = image[:, :, 1:, :] - image[:, :, :-1, :]
    return horizontal, vertical


def laplacian_filter(image, torch):
    kernel = image.new_tensor([[0.0, 1.0, 0.0], [1.0, -4.0, 1.0], [0.0, 1.0, 0.0]])
    kernel = kernel.view(1, 1, 3, 3).repeat(image.shape[1], 1, 1, 1)
    return torch.nn.functional.conv2d(image, kernel, padding=1, groups=image.shape[1])


def local_contrast(image, torch):
    mean = torch.nn.functional.avg_pool2d(image, kernel_size=3, stride=1, padding=1)
    return torch.abs(image - mean)
