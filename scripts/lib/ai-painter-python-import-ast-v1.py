from __future__ import annotations

import ast
import json
import sys


def main() -> None:
    request = json.load(sys.stdin)
    source = request.get("source")
    logical_path = request.get("logicalPath")
    if not isinstance(source, str) or not isinstance(logical_path, str):
        raise ValueError("python_import_ast_request_invalid")
    tree = ast.parse(source, filename=logical_path, mode="exec")
    imports: list[dict[str, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append({"kind": "python_static", "specifier": alias.name})
        elif isinstance(node, ast.ImportFrom):
            prefix = "." * node.level
            if node.module:
                imports.append({
                    "kind": "python_static",
                    "specifier": f"{prefix}{node.module}",
                })
            else:
                for alias in node.names:
                    if alias.name != "*":
                        imports.append({
                            "kind": "python_static",
                            "specifier": f"{prefix}{alias.name}",
                        })
        elif isinstance(node, ast.Call) and _is_dynamic_import_call(node.func):
            imports.append({
                "kind": "nonliteral_dynamic",
                "specifier": f"nonliteral:{logical_path}",
            })
    json.dump(imports, sys.stdout, separators=(",", ":"), sort_keys=True)


def _is_dynamic_import_call(function: ast.expr) -> bool:
    if isinstance(function, ast.Name):
        return function.id == "__import__"
    if isinstance(function, ast.Attribute):
        return function.attr in {"import_module", "spec_from_file_location"}
    return False


if __name__ == "__main__":
    main()
