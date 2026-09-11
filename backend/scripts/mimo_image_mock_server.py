"""Minimal OpenAI-compatible image API for local MiMo provider integration tests.

POST /v1/images/generations
→ {"data":[{"b64_json":"<png>"}]}
"""
from __future__ import annotations

import base64
import struct
import zlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import sys


def _png(width: int = 96, height: int = 96, rgb=(40, 120, 200)) -> bytes:
    r, g, b = rgb
    raw = b"".join(b"\x00" + bytes([r, g, b] * width) for _ in range(height))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[mimo-mock] " + (fmt % args) + "\n")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            payload = json.loads(body or b"{}")
        except json.JSONDecodeError:
            payload = {}
        prompt = payload.get("prompt", "")
        # tint by prompt so panels differ
        seed = (len(prompt) * 13) % 180
        png = _png(rgb=((30 + seed) % 256, 90, (200 - seed // 2) % 256))
        data = {
            "created": 0,
            "data": [{"b64_json": base64.b64encode(png).decode("ascii")}],
        }
        raw = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 18081
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"mimo mock image API on http://127.0.0.1:{port}/v1/images/generations")
    server.serve_forever()


if __name__ == "__main__":
    main()
