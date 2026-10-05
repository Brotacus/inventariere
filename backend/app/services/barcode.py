"""Code 128 barcodes for inventory labels.

python-barcode computes the symbol (character-set switching and checksum);
this module only draws it. Its own SVG writer sizes bars in millimetres without
a viewBox, which does not scale inside a label template.
"""

from barcode import Code128

# Code 128 requires a quiet zone of at least 10 module widths on each side.
QUIET_ZONE_MODULES = 10
BAR_HEIGHT_MODULES = 40


def code128_svg(value: str) -> str:
    modules = Code128(value).build()[0]
    width = len(modules) + 2 * QUIET_ZONE_MODULES

    bars = []
    start = None
    for index, module in enumerate(modules + "0"):
        if module == "1" and start is None:
            start = index
        elif module == "0" and start is not None:
            bars.append(f'<rect x="{start + QUIET_ZONE_MODULES}" width="{index - start}" height="{BAR_HEIGHT_MODULES}"/>')
            start = None

    # preserveAspectRatio="none" lets a label stretch the bars to any box;
    # every bar scales by the same factor, so the symbol stays readable. The
    # width/height only give browsers an intrinsic size for <img>.
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width * 2}" height="{BAR_HEIGHT_MODULES * 2}" '
        f'viewBox="0 0 {width} {BAR_HEIGHT_MODULES}" '
        f'preserveAspectRatio="none" shape-rendering="crispEdges">'
        f'<rect width="{width}" height="{BAR_HEIGHT_MODULES}" fill="#fff"/>'
        f'<g fill="#000">{"".join(bars)}</g></svg>'
    )
