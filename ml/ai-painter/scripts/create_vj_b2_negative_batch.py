from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image, ImageDraw

from ai_painter.quality_learning import register_quality_sample


DATASET_ROOT = Path("data/ai-painter-quality/vj-b2")


def main() -> None:
    variants = [
        ("flat-canopy", draw_flat_canopy, ["树冠为大面积单色平涂。", "没有叶片材质和明暗层次。"]),
        ("block-canopy", draw_block_canopy, ["主体由简单矩形组成。", "轮廓机械且缺乏自然像素细节。"]),
        ("low-contrast", draw_low_contrast, ["树干与树冠明度接近。", "体积、材质和焦点难以辨识。"]),
        ("fragmented", draw_fragmented, ["树冠轮廓破碎且缺乏整体结构。", "内部空洞与噪点影响可读性。"]),
        ("tiny-subject", draw_tiny_subject, ["主体占画布比例过低。", "作为世界资产时无法保持可读性。"]),
        ("oversized-subject", draw_oversized_subject, ["主体越界并压满画布。", "缺少稳定锚点与安全边距。"]),
        ("material-confusion", draw_material_confusion, ["树干和树冠使用近似颜色。", "木质与叶片材质无法区分。"]),
    ]
    with TemporaryDirectory() as temporary:
        temporary_root = Path(temporary)
        for index, (kind, painter, evidence) in enumerate(variants, start=2):
            sample_id = f"tree-unacceptable-{index:03d}"
            if (DATASET_ROOT / "samples" / sample_id).exists():
                continue
            image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
            painter(ImageDraw.Draw(image))
            source = temporary_root / f"{sample_id}.png"
            image.save(source, "PNG", optimize=True)
            register_quality_sample(
                source,
                DATASET_ROOT,
                sample_id,
                "tree",
                "unacceptable",
                evidence,
                f"project-negative-tree-{kind}-v1",
                kind,
                "project_procedural_quality_fixture",
            )
            print(f"已生成：{sample_id} / {kind}")


def draw_flat_canopy(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((57, 62, 70, 116), fill="#70502e")
    draw.ellipse((22, 14, 106, 88), fill="#3f8b42")


def draw_block_canopy(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((58, 59, 70, 118), fill="#784626")
    draw.rectangle((22, 18, 105, 72), fill="#28723a")
    draw.rectangle((34, 8, 91, 88), fill="#348b40")


def draw_low_contrast(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((58, 58, 70, 117), fill="#566f48")
    draw.ellipse((25, 15, 103, 89), fill="#647b50")
    draw.ellipse((41, 28, 88, 69), fill="#6b8057")


def draw_fragmented(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 65, 69, 118), fill="#6f4225")
    for box in ((10, 18, 37, 43), (47, 7, 72, 34), (87, 19, 116, 45), (24, 52, 53, 79), (72, 50, 101, 80)):
        draw.ellipse(box, fill="#2f7d3e")


def draw_tiny_subject(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((62, 70, 66, 91), fill="#724526")
    draw.ellipse((50, 50, 78, 75), fill="#388a43")


def draw_oversized_subject(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((52, 54, 78, 127), fill="#754224")
    draw.ellipse((-24, -31, 153, 102), fill="#317c3c")


def draw_material_confusion(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((57, 57, 71, 118), fill="#456f3e")
    draw.ellipse((20, 12, 108, 91), fill="#4b7542")
    draw.ellipse((35, 25, 93, 75), fill="#527b49")


if __name__ == "__main__":
    main()
