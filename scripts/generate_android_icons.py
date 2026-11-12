import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES_DIR = ROOT / "android" / "app" / "src" / "main" / "res"

SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def encode_png(width: int, height: int, rgba: bytearray) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def blend(dst: bytearray, idx: int, r: int, g: int, b: int, a: float):
    if a <= 0:
        return
    a = min(1.0, max(0.0, a))
    inv = 1.0 - a
    dst[idx] = int(dst[idx] * inv + r * a)
    dst[idx + 1] = int(dst[idx + 1] * inv + g * a)
    dst[idx + 2] = int(dst[idx + 2] * inv + b * a)
    dst[idx + 3] = min(255, int(dst[idx + 3] + 255 * a * (1 - dst[idx + 3] / 255.0)))


def render_icon(size: int, round_mask: bool = False, transparent_bg: bool = False) -> bytes:
    buf = bytearray(size * size * 4)
    cx = cy = size / 2.0
    rad = size * 0.46

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4
            nx = (x + 0.5) / size
            ny = (y + 0.5) / size

            # Masking for rounded square or circle
            dx = abs(x + 0.5 - cx)
            dy = abs(y + 0.5 - cy)
            if round_mask:
                dist = math.hypot(dx, dy)
                if dist > rad + 1:
                    continue
                alpha_mask = max(0.0, min(1.0, rad + 0.5 - dist))
            elif transparent_bg:
                alpha_mask = 1.0
            else:
                corner = size * 0.22
                limit = size * 0.46 - corner
                ox = max(0.0, dx - limit)
                oy = max(0.0, dy - limit)
                dist = math.hypot(ox, oy)
                if dist > corner + 1:
                    continue
                alpha_mask = max(0.0, min(1.0, corner + 0.5 - dist))

            if not transparent_bg:
                # Emerald felt gradient
                t = max(0.0, min(1.0, ny))
                bg_r = int(20 * (1 - t) + 9 * t)
                bg_g = int(142 * (1 - t) + 92 * t)
                bg_b = int(66 * (1 - t) + 39 * t)
                buf[idx] = bg_r
                buf[idx + 1] = bg_g
                buf[idx + 2] = bg_b
                buf[idx + 3] = int(255 * alpha_mask)

            # Cream solitaire card in center
            cw = 0.50
            ch = 0.64
            card_dx = abs(nx - 0.5) - cw / 2
            card_dy = abs(ny - 0.5) - ch / 2
            r_card = 0.06
            cdist = math.hypot(max(0.0, card_dx + r_card), max(0.0, card_dy + r_card)) - r_card
            if cdist < 0.015:
                # Gold border + cream card center
                if cdist > -0.028:
                    blend(buf, idx, 245, 184, 46, alpha_mask)
                else:
                    blend(buf, idx, 255, 253, 246, alpha_mask)

            # Gold Crown emblem in upper-center & emerald football circle below
            # Crown base y: 0.34..0.46, x: 0.36..0.64
            if 0.35 <= nx <= 0.65 and 0.33 <= ny <= 0.47:
                # 3 crown peaks
                rel_x = (nx - 0.35) / 0.30
                peak = 0.40 - 0.07 * abs(math.sin(rel_x * math.pi * 2.5))
                if ny >= peak:
                    blend(buf, idx, 245, 158, 11, alpha_mask)

            # Football pentagon/circle icon in lower half of card
            ball_d = math.hypot(nx - 0.5, ny - 0.60)
            if ball_d <= 0.115:
                if ball_d >= 0.095:
                    blend(buf, idx, 30, 41, 59, alpha_mask)
                elif ball_d <= 0.042:
                    blend(buf, idx, 30, 41, 59, alpha_mask)
                else:
                    blend(buf, idx, 241, 245, 249, alpha_mask)

    return encode_png(size, size, buf)


def main():
    for folder, size in SIZES.items():
        out_dir = RES_DIR / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "ic_launcher.png").write_bytes(render_icon(size, round_mask=False))
        (out_dir / "ic_launcher_round.png").write_bytes(render_icon(size, round_mask=True))
        (out_dir / "ic_launcher_foreground.png").write_bytes(
            render_icon(int(size * 1.4), transparent_bg=True)
        )
    print("Generated Android launcher icons cleanly.")


if __name__ == "__main__":
    main()
