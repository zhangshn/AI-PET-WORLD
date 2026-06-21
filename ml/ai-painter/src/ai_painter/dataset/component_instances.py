from __future__ import annotations

from collections import deque
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class Component:
    pixels: int
    x0: int
    y0: int
    x1: int
    y1: int
    mask: np.ndarray


def connected_components(mask: np.ndarray, minimum_pixels: int = 8) -> list[Component]:
    binary = mask > 0
    height, width = binary.shape
    visited = np.zeros_like(binary, dtype=bool)
    result: list[Component] = []
    for start_y, start_x in zip(*np.where(binary & ~visited)):
        if visited[start_y, start_x]:
            continue
        queue = deque([(int(start_x), int(start_y))])
        visited[start_y, start_x] = True
        coordinates: list[tuple[int, int]] = []
        while queue:
            x, y = queue.popleft()
            coordinates.append((x, y))
            for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= next_x < width and 0 <= next_y < height and binary[next_y, next_x] and not visited[next_y, next_x]:
                    visited[next_y, next_x] = True
                    queue.append((next_x, next_y))
        if len(coordinates) < minimum_pixels:
            continue
        xs = [value[0] for value in coordinates]
        ys = [value[1] for value in coordinates]
        component_mask = np.zeros_like(mask, dtype=np.uint8)
        component_mask[tuple(zip(*[(y, x) for x, y in coordinates]))] = 255
        result.append(Component(len(coordinates), min(xs), min(ys), max(xs), max(ys), component_mask))
    return sorted(result, key=lambda item: item.pixels, reverse=True)


def padded_square(component: Component, width: int, height: int, padding: int = 8, minimum_size: int = 32) -> tuple[int, int, int]:
    center_x = (component.x0 + component.x1) // 2
    center_y = (component.y0 + component.y1) // 2
    size = max(minimum_size, component.x1 - component.x0 + 1 + padding * 2, component.y1 - component.y0 + 1 + padding * 2)
    size = min(width, height, size)
    x = max(0, min(width - size, center_x - size // 2))
    y = max(0, min(height - size, center_y - size // 2))
    return x, y, size
