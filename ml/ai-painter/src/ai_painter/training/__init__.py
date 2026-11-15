"""Public training exports, loaded only when the corresponding API is requested.

Importing a runtime query must not require dataset or trainer dependencies.
Keep explicit imports so source-binding tools can still discover every module.
"""

__all__ = ["MASK_NAMES", "WorldSceneDataset", "build_tiny_unet", "describe_torch_runtime", "train"]


def __getattr__(name):
    if name in ("MASK_NAMES", "WorldSceneDataset"):
        from .dataset import MASK_NAMES, WorldSceneDataset
        value = MASK_NAMES if name == "MASK_NAMES" else WorldSceneDataset
    elif name == "build_tiny_unet":
        from .model import build_tiny_unet
        value = build_tiny_unet
    elif name == "describe_torch_runtime":
        from .torch_runtime import describe_torch_runtime
        value = describe_torch_runtime
    elif name == "train":
        from .trainer import train
        value = train
    else:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    globals()[name] = value
    return value


def __dir__():
    return sorted(set(globals()) | set(__all__))
