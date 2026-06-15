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
        ("stripe-noise", draw_stripe_noise, ["树冠被规则条纹噪声覆盖。", "机械纹理破坏自然材质。"]),
        ("checker-noise", draw_checker_noise, ["树冠使用棋盘格重复纹理。", "重复图案不符合自然像素细节。"]),
        ("floating-crown", draw_floating_crown, ["树冠与树干明显断开。", "主体结构缺乏物理连接。"]),
        ("missing-trunk", draw_missing_trunk, ["树木完全缺少树干结构。", "资产锚点与材质分层不成立。"]),
        ("side-clipped", draw_side_clipped, ["主体从画布侧边被严重裁切。", "轮廓和安全边距不完整。"]),
        ("top-clipped", draw_top_clipped, ["树冠顶部被画布截断。", "主体构图缺少完整轮廓。"]),
        ("hollow-center", draw_hollow_center, ["树冠中心存在不合理巨大空洞。", "视觉重心破碎。"]),
        ("single-tone", draw_single_tone, ["整棵树只有单一颜色。", "无法区分树干、树冠和光影。"]),
        ("neon-palette", draw_neon_palette, ["高饱和荧光色破坏项目自然风格。", "颜色关系缺乏材质可信度。"]),
        ("horizontal-smear", draw_horizontal_smear, ["主体被拉伸成水平色带。", "树木轮廓不可识别。"]),
        ("vertical-smear", draw_vertical_smear, ["主体被压缩成垂直色带。", "树冠结构不可读。"]),
        ("random-dots", draw_random_dots, ["主体由离散随机点组成。", "缺少连续轮廓和结构。"]),
        ("inverted-material", draw_inverted_material, ["树冠呈木色而树干呈叶色。", "材质语义完全颠倒。"]),
        ("double-shadow", draw_double_shadow, ["主体出现不一致的双重暗影。", "光照方向互相冲突。"]),
        ("flat-triangle", draw_flat_triangle, ["树冠为单一几何三角形。", "缺少自然轮廓和内部层次。"]),
        ("detached-branches", draw_detached_branches, ["枝条与主干、树冠互不连接。", "结构关系不成立。"]),
        ("bottom-clipped", draw_bottom_clipped, ["树干和根部被画布底部截断。", "锚点无法用于世界摆放。"]),
        ("staircase-crown", draw_staircase_crown, ["树冠由阶梯状硬边矩形堆叠。", "轮廓呈人工图表结构而非自然树木。"]),
        ("upside-down", draw_upside_down, ["树冠位于树干下方。", "树木上下结构和锚点关系颠倒。"]),
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


def draw_stripe_noise(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 58, 69, 118), fill="#714426")
    draw.ellipse((20, 12, 108, 91), fill="#26783b")
    for y in range(18, 88, 5):
        draw.rectangle((24, y, 104, y + 2), fill="#a8d65b")


def draw_checker_noise(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 58, 69, 118), fill="#704326")
    for y in range(16, 88, 10):
        for x in range(24, 104, 10):
            draw.rectangle((x, y, x + 8, y + 8), fill="#2a7138" if (x + y) % 20 else "#9ed356")


def draw_floating_crown(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 81, 69, 119), fill="#794526")
    draw.ellipse((22, 8, 106, 70), fill="#347f3d")


def draw_missing_trunk(draw: ImageDraw.ImageDraw) -> None:
    draw.ellipse((20, 18, 108, 94), fill="#347f3d")
    draw.ellipse((39, 32, 91, 78), fill="#65a84b")


def draw_side_clipped(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((4, 58, 14, 118), fill="#724225")
    draw.ellipse((-48, 9, 57, 94), fill="#347f3d")


def draw_top_clipped(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 54, 69, 118), fill="#724225")
    draw.ellipse((21, -46, 107, 70), fill="#347f3d")


def draw_hollow_center(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 60, 69, 118), fill="#724225")
    draw.ellipse((20, 12, 108, 94), fill="#347f3d")
    draw.ellipse((43, 32, 85, 73), fill=(0, 0, 0, 0))


def draw_single_tone(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 7, 69, 120), fill="#3d7d40")
    draw.rectangle((8, 43, 120, 55), fill="#3d7d40")
    draw.rectangle((22, 24, 106, 35), fill="#3d7d40")
    draw.rectangle((31, 65, 97, 76), fill="#3d7d40")


def draw_neon_palette(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 63, 69, 119), fill="#00ffff")
    draw.polygon(((14, 58), (28, 17), (52, 30), (64, 5), (77, 31),
                  (104, 14), (115, 61), (93, 89), (35, 91)), fill="#ff00ff")
    draw.rectangle((28, 51, 101, 61), fill="#ffff00")


def draw_horizontal_smear(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(((2, 45), (126, 45), (110, 53), (126, 61), (106, 69),
                  (126, 77), (2, 77), (20, 69), (2, 61), (22, 53)), fill="#347f3d")
    draw.rectangle((61, 77, 67, 119), fill="#724225")


def draw_vertical_smear(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((55, 8, 73, 119), fill="#347f3d")
    draw.rectangle((61, 72, 67, 120), fill="#724225")


def draw_random_dots(draw: ImageDraw.ImageDraw) -> None:
    for index in range(85):
        x = (index * 37) % 104 + 12
        y = (index * 53) % 94 + 9
        draw.rectangle((x, y, x + 2, y + 2), fill="#347f3d" if index % 3 else "#724225")


def draw_inverted_material(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(((58, 39), (70, 39), (79, 117), (49, 117)), fill="#3b8a43")
    draw.rectangle((12, 17, 116, 38), fill="#82502c")
    draw.rectangle((27, 4, 101, 53), fill="#aa7340")
    draw.rectangle((45, 12, 83, 61), fill="#d49a58")


def draw_double_shadow(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 58, 69, 118), fill="#724225")
    draw.ellipse((20, 12, 108, 91), fill="#397f40")
    draw.ellipse((10, 76, 80, 99), fill=(15, 28, 24, 255))
    draw.ellipse((55, 83, 126, 106), fill=(15, 28, 24, 255))


def draw_flat_triangle(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 61, 69, 118), fill="#724225")
    draw.polygon(((64, 5), (17, 91), (111, 91)), fill="#347f3d")


def draw_detached_branches(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 67, 69, 118), fill="#724225")
    draw.line((18, 58, 42, 38), fill="#724225", width=5)
    draw.line((87, 57, 108, 34), fill="#724225", width=5)
    draw.ellipse((16, 8, 51, 38), fill="#347f3d")
    draw.ellipse((76, 7, 111, 38), fill="#347f3d")


def draw_bottom_clipped(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((45, 70, 82, 127), fill="#724225")
    draw.ellipse((8, 5, 119, 84), fill="#347f3d")
    draw.ellipse((31, 17, 94, 71), fill="#65a84b")


def draw_staircase_crown(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((61, 76, 67, 119), fill="#724225")
    for index, width in enumerate((20, 38, 58, 78, 98)):
        left = 64 - width // 2
        y = 8 + index * 14
        draw.rectangle((left, y, left + width, y + 10), fill="#347f3d")


def draw_upside_down(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((59, 9, 69, 72), fill="#724225")
    draw.polygon(((64, 123), (13, 78), (34, 61), (64, 77), (94, 61), (115, 78)), fill="#347f3d")
    draw.ellipse((35, 76, 93, 124), fill="#65a84b")


if __name__ == "__main__":
    main()
