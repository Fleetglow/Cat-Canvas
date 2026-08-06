# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path
import sys

root = Path(SPECPATH).parent
runtime_dlls = [
    (str(Path(sys.base_prefix) / name), ".")
    for name in ("VCRUNTIME140.dll", "VCRUNTIME140_1.dll")
    if (Path(sys.base_prefix) / name).is_file()
]

datas = [
    (str(root / "static"), "static"),
    (str(root / "VERSION"), "."),
]
if (root / "workflows").is_dir():
    datas.append((str(root / "workflows"), "workflows"))

analysis = Analysis(
    [str(root / "main.py")],
    pathex=[str(root)],
    binaries=runtime_dlls,
    datas=datas,
    hiddenimports=[
        "uvicorn.logging",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan.on",
        "websockets.legacy.server",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["brotli", "brotlicffi"],
    noarchive=False,
)
pyz = PYZ(analysis.pure)
exe = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="cat-canvas-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)
coll = COLLECT(
    exe,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=True,
    name="cat-canvas-backend",
)
