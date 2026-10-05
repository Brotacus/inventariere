"""Barcodes are decoded by an independent reader (zxing-cpp), not re-derived."""
import xml.etree.ElementTree as ET

import pytest
import zxingcpp
from PIL import Image, ImageDraw

from app.services.barcode import QUIET_ZONE_MODULES, code128_svg

SVG = "{http://www.w3.org/2000/svg}"


def bars(svg):
    root = ET.fromstring(svg)
    width, height = (float(value) for value in root.get("viewBox").split()[2:])
    rects = [(float(rect.get("x")), float(rect.get("width"))) for rect in root.iter(f"{SVG}rect") if rect.get("x")]
    return width, height, rects


def scan(svg, pixels_per_module=2.5):
    # A fractional scale mimics the label template stretching the barcode.
    width, height, rects = bars(svg)
    image = Image.new("L", (round(width * pixels_per_module), 80), 255)
    draw = ImageDraw.Draw(image)
    for x, bar_width in rects:
        draw.rectangle([round(x * pixels_per_module), 0, round((x + bar_width) * pixels_per_module) - 1, 79], fill=0)
    return [(result.text, result.format.name) for result in zxingcpp.read_barcodes(image)]


@pytest.mark.parametrize("code", ["INV-000001", "INV-000042", "INV-999999", "INV-1234567", "DEV-00042"])
def test_code128_svg_scans_back_with_a_quiet_zone(code):
    svg = code128_svg(code)
    assert scan(svg) == [(code, "Code128")]
    width, _, rects = bars(svg)
    assert rects[0][0] >= QUIET_ZONE_MODULES
    assert rects[-1][0] + rects[-1][1] <= width - QUIET_ZONE_MODULES

