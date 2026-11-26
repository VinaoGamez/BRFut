"""Headless regressions for restored alpha masks and PNG -> WebP conversion."""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TEST_TEMP = Path(tempfile.gettempdir()) / "opencode"
TEST_TEMP.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location("asset_optimizer", ROOT / "scripts" / "optimize-assets.py")
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)
restore_spec = importlib.util.spec_from_file_location("alpha_restorer", ROOT / "scripts" / "restore-asset-transparency.py")
restorer = importlib.util.module_from_spec(restore_spec)
restore_spec.loader.exec_module(restorer)


class TransparencyTests(unittest.TestCase):
    def test_all_corrected_masks_match_audited_source_alpha(self):
        manifest = json.loads((ROOT / "scripts" / "asset-transparency-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(len(manifest["assets"]), 19)
        for entry in manifest["assets"]:
            with self.subTest(path=entry["path"]), Image.open(ROOT / entry["path"]) as image:
                self.assertEqual(list(image.size), entry["size"])
                alpha = image.convert("RGBA").getchannel("A").tobytes()
                self.assertEqual(hashlib.sha256(alpha).hexdigest(), entry["alpha_sha256"])
                self.assertEqual(alpha.count(0), entry["transparent_pixels"])
                self.assertGreater(alpha.count(0), 0)
                self.assertGreaterEqual(max(alpha), 128)

    def test_dashboard_corners_adapt_to_any_background(self):
        for name in ["stats-scorer", "stats-assist", "stats-overall"]:
            with self.subTest(icon=name), Image.open(ROOT / "public" / "brand" / (name + ".webp")) as image:
                image = image.convert("RGBA")
                corners = [(0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)]
                for pixel in corners:
                    self.assertEqual(image.getpixel(pixel)[3], 0)
                for background in ["#071923", "#173f50", "#eeeeee"]:
                    canvas = Image.new("RGBA", image.size, background)
                    composed = Image.alpha_composite(canvas, image)
                    for pixel in corners:
                        self.assertEqual(composed.getpixel(pixel), canvas.getpixel(pixel))

    def test_rgba_conversion_preserves_alpha_and_visible_rgb(self):
        with tempfile.TemporaryDirectory(prefix="brfut-alpha-", dir=TEST_TEMP) as directory:
            path = Path(directory) / "rgba.png"
            image = Image.new("RGBA", (16, 16), (255, 0, 255, 0))
            for x in range(4, 12):
                for y in range(4, 12):
                    image.putpixel((x, y), (20, 180, 240, 128 if x == 4 else 255))
            image.save(path)
            output = optimizer.aplicar(path, None, None, 88)
            with Image.open(output) as converted:
                converted = converted.convert("RGBA")
                self.assertEqual(converted.getchannel("A").tobytes(), image.getchannel("A").tobytes())
                self.assertEqual(converted.getpixel((4, 5)), image.getpixel((4, 5)))
                self.assertEqual(converted.getpixel((5, 5)), image.getpixel((5, 5)))
            self.assertTrue(path.exists(), "conversion function must not delete its source")

    def test_resize_preserves_antialiased_alpha(self):
        with tempfile.TemporaryDirectory(prefix="brfut-alpha-", dir=TEST_TEMP) as directory:
            path = Path(directory) / "resized.png"
            image = Image.new("RGBA", (32, 32), (255, 0, 255, 0))
            for x in range(8, 24):
                for y in range(8, 24):
                    image.putpixel((x, y), (10, 180, 240, 255))
            image.save(path)
            expected = image.resize((16, 16), Image.Resampling.LANCZOS)
            output = optimizer.aplicar(path, 16, 16, 88)
            with Image.open(output) as converted:
                self.assertEqual(converted.size, (16, 16))
                alpha = converted.convert("RGBA").getchannel("A").tobytes()
                self.assertEqual(alpha, expected.getchannel("A").tobytes())
                self.assertTrue(any(0 < value < 255 for value in alpha))

    def test_palette_transparency_is_not_flattened(self):
        with tempfile.TemporaryDirectory(prefix="brfut-alpha-", dir=TEST_TEMP) as directory:
            path = Path(directory) / "palette.png"
            image = Image.new("P", (8, 8), 0)
            image.putpalette([255, 0, 255, 0, 180, 240] + [0] * 762)
            image.putpixel((4, 4), 1)
            image.save(path, transparency=0)
            output = optimizer.aplicar(path, None, None, 88)
            with Image.open(output) as converted:
                rgba = converted.convert("RGBA")
                self.assertEqual(rgba.getpixel((0, 0))[3], 0)
                self.assertEqual(rgba.getpixel((4, 4)), (0, 180, 240, 255))

    def test_opaque_artwork_remains_opaque(self):
        with tempfile.TemporaryDirectory(prefix="brfut-alpha-", dir=TEST_TEMP) as directory:
            path = Path(directory) / "opaque.png"
            Image.new("RGB", (16, 16), (20, 80, 140)).save(path)
            output = optimizer.aplicar(path, None, None, 88)
            with Image.open(output) as converted:
                self.assertEqual(converted.convert("RGBA").getchannel("A").getextrema(), (255, 255))

    def test_assist_icon_has_negative_space_not_a_white_canvas(self):
        with Image.open(ROOT / "assets" / "ui" / "assist-boot.webp") as image:
            rgba = image.convert("RGBA")
            self.assertEqual(rgba.getpixel((0, 0))[3], 0)
            self.assertEqual(rgba.getpixel((rgba.width - 1, rgba.height - 1))[3], 0)
            # Existing CSS invert changes black ink to white, not its alpha.
            inverted = Image.new("RGBA", rgba.size, "white")
            inverted.putalpha(rgba.getchannel("A"))
            background = Image.new("RGBA", rgba.size, "#071923")
            composed = Image.alpha_composite(background, inverted)
            self.assertEqual(composed.getpixel((0, 0)), background.getpixel((0, 0)))

    def test_edge_cleanup_preserves_interior_colours_and_cyan_outline(self):
        image = Image.new("RGBA", (40, 40), (255, 0, 255, 0))
        for x in range(4, 36):
            for y in range(4, 36):
                image.putpixel((x, y), (0, 180, 240, 255))
        image.putpixel((4, 20), (220, 20, 220, 255))
        image.putpixel((20, 20), (220, 20, 220, 255))
        fixed, removed = restorer.clean_magenta_boundary(image)
        self.assertEqual(removed, 1)
        self.assertEqual(fixed.getpixel((4, 20))[3], 0)
        self.assertEqual(fixed.getpixel((20, 20)), image.getpixel((20, 20)))
        self.assertEqual(fixed.getpixel((5, 20)), image.getpixel((5, 20)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
