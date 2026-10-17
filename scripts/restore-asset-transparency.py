"""Recover optimized assets from original RGBA PNGs, without colour-key removal.

Default is audit-only; --apply restores only assets whose alpha was discarded.
Dimensions stay unchanged. Requires local git history and Pillow, no network.
"""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE_REV = "3f433db8a1e3df1cf3cfae0434be0e28e481feaf"
ASSET_DIRS = ("public", "assets", "brand")
MONOCHROME_ASSETS = ("assets/ui/assist-boot.webp",)
MAGENTA_EDGE_ASSETS = (
    "public/brand/stats-scorer.webp", "public/brand/stats-assist.webp", "public/brand/stats-overall.webp",
    "assets/match-view/tokens/away-gk.webp", "assets/match-view/tokens/away-outfield.webp",
    "assets/match-view/tokens/ball.webp", "assets/match-view/tokens/home-gk.webp", "assets/match-view/tokens/home-outfield.webp",
)


def git_bytes(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def transparent_monochrome(image):
    """White is negative space for this one monochrome icon, not painted art.

    Its existing CSS inverts black ink to white. Express coverage in alpha so
    the same filter no longer creates a black rectangular background.
    """
    alpha = ImageOps.invert(ImageOps.grayscale(image))
    rgba = Image.new("RGBA", image.size, (0, 0, 0, 0))
    rgba.putalpha(alpha)
    return rgba


def clean_magenta_boundary(image):
    """Remove legacy key-colour residue only inside the existing mask boundary.

    Do not globally remove hues: a purple detail in the interior is artwork.
    These eight audited icons have magenta residue within seven source pixels
    of transparency. Resize afterwards to create clean antialiased edges.
    """
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    eroded = alpha.filter(ImageFilter.MinFilter(15))
    values = list(rgba.getdata())
    border = list(eroded.getdata())
    removed = 0
    for index, (red, green, blue, opacity) in enumerate(values):
        if opacity > 0 and border[index] < opacity and min(red, blue) > green + 20:
            values[index] = (red, green, blue, 0)
            removed += 1
    rgba.putdata(values)
    return rgba, removed


def find_lost_alpha():
    sources = set(git_bytes("ls-tree", "-r", "--name-only", SOURCE_REV).decode("utf-8").splitlines())
    for folder in ASSET_DIRS:
        for path in sorted((ROOT / folder).rglob("*.webp")):
            source_path = path.relative_to(ROOT).with_suffix(".png").as_posix()
            if source_path not in sources:
                continue
            with Image.open(path) as current:
                if current.convert("RGBA").getchannel("A").getextrema()[0] < 255:
                    continue
                size = current.size
            source_bytes = git_bytes("show", SOURCE_REV + ":" + source_path)
            with Image.open(io.BytesIO(source_bytes)) as original:
                rgba = original.convert("RGBA")
                if rgba.getchannel("A").getextrema()[0] == 255:
                    continue
                restored = rgba.resize(size, Image.Resampling.LANCZOS) if rgba.size != size else rgba.copy()
            yield path, source_path, source_bytes, restored


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    manifest_path = ROOT / "scripts" / "asset-transparency-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {"source_revision": SOURCE_REV, "assets": []}
    entries = {entry["path"]: entry for entry in manifest["assets"]}
    count = 0
    edge_count = 0
    for path, source_path, source_bytes, restored in find_lost_alpha():
        count += 1
        relative = path.relative_to(ROOT).as_posix()
        print(("RESTORE " if args.apply else "LOST ") + relative)
        if not args.apply:
            continue
        restored.save(path, "WEBP", lossless=True, method=6)
        expected_alpha = restored.getchannel("A").tobytes()
        with Image.open(path) as verified:
            assert verified.convert("RGBA").getchannel("A").tobytes() == expected_alpha, relative
        entries[relative] = {
            "path": relative,
            "source_path": source_path,
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
            "size": list(restored.size),
            "alpha_sha256": hashlib.sha256(expected_alpha).hexdigest(),
            "transparent_pixels": expected_alpha.count(0),
            "partial_alpha_pixels": sum(0 < alpha < 255 for alpha in expected_alpha),
        }
    for relative in MAGENTA_EDGE_ASSETS:
        entry = entries.get(relative)
        if entry and entry.get("edge_treatment") == "magenta-boundary-cleanup":
            continue
        path = ROOT / relative
        edge_count += 1
        print(("CLEAN EDGE " if args.apply else "EDGE RESIDUE ") + relative)
        if not args.apply:
            continue
        source_path = Path(relative).with_suffix(".png").as_posix()
        source_bytes = git_bytes("show", SOURCE_REV + ":" + source_path)
        with Image.open(path) as current:
            size = current.size
        with Image.open(io.BytesIO(source_bytes)) as original:
            restored, removed = clean_magenta_boundary(original)
            if restored.size != size:
                restored = restored.resize(size, Image.Resampling.LANCZOS)
        restored.save(path, "WEBP", lossless=True, method=6)
        expected_alpha = restored.getchannel("A").tobytes()
        with Image.open(path) as verified:
            assert verified.convert("RGBA").getchannel("A").tobytes() == expected_alpha, relative
        entries[relative] = {
            "path": relative, "source_path": source_path,
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
            "edge_treatment": "magenta-boundary-cleanup", "removed_source_pixels": removed,
            "size": list(size), "alpha_sha256": hashlib.sha256(expected_alpha).hexdigest(),
            "transparent_pixels": expected_alpha.count(0),
            "partial_alpha_pixels": sum(0 < alpha < 255 for alpha in expected_alpha),
        }
    for relative in MONOCHROME_ASSETS:
        path = ROOT / relative
        with Image.open(path) as current:
            if current.convert("RGBA").getchannel("A").getextrema()[0] < 255:
                continue
            size = current.size
        count += 1
        print(("RESTORE MONOCHROME " if args.apply else "WHITE MATTE ") + relative)
        if not args.apply:
            continue
        source_path = Path(relative).with_suffix(".png").as_posix()
        source_bytes = git_bytes("show", SOURCE_REV + ":" + source_path)
        with Image.open(io.BytesIO(source_bytes)) as original:
            restored = transparent_monochrome(original)
            if restored.size != size:
                restored = restored.resize(size, Image.Resampling.LANCZOS)
        restored.save(path, "WEBP", lossless=True, method=6)
        expected_alpha = restored.getchannel("A").tobytes()
        with Image.open(path) as verified:
            assert verified.convert("RGBA").getchannel("A").tobytes() == expected_alpha, relative
        entries[relative] = {
            "path": relative,
            "source_path": source_path,
            "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
            "transformation": "monochrome-white-to-alpha",
            "size": list(size),
            "alpha_sha256": hashlib.sha256(expected_alpha).hexdigest(),
            "transparent_pixels": expected_alpha.count(0),
            "partial_alpha_pixels": sum(0 < alpha < 255 for alpha in expected_alpha),
        }
    if args.apply:
        manifest["assets"] = [entries[key] for key in sorted(entries)]
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{'Restored' if args.apply else 'Lost alpha assets'}: {count}")
    print(f"{'Cleaned boundary assets' if args.apply else 'Pending boundary assets'}: {edge_count}")


if __name__ == "__main__":
    main()
