"""Image generation providers: wanx | mimo | mock | qwen."""
from __future__ import annotations

import asyncio
import base64
import struct
import time
import zlib
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Optional

import httpx

from app.config import settings


def _minimal_png(width: int = 64, height: int = 64, rgb=(120, 90, 200)) -> bytes:
    """Tiny solid-color PNG (no Pillow dependency)."""
    r, g, b = rgb
    raw = b"".join(
        b"\x00" + bytes([r, g, b] * width) for _ in range(height)
    )

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


class ImageProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_image(self, prompt: str, output_path: Path) -> Optional[str]:
        """Generate one image and save to output_path. Return path or None."""


class MockImageProvider(ImageProvider):
    """Offline provider for tests / no-key environments."""

    name = "mock"

    def __init__(self, rgb=(120, 90, 200)):
        self.rgb = rgb

    async def generate_image(self, prompt: str, output_path: Path) -> Optional[str]:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # vary color a bit from prompt length so panels differ
        seed = (len(prompt) * 17) % 120
        rgb = (
            (self.rgb[0] + seed) % 256,
            self.rgb[1],
            (self.rgb[2] + seed // 2) % 256,
        )
        output_path.write_bytes(_minimal_png(rgb=rgb))
        return str(output_path)


class WanxImageProvider(ImageProvider):
    """Aliyun DashScope WanX (existing production path)."""

    name = "wanx"

    def __init__(self):
        import dashscope
        from dashscope import ImageSynthesis

        self._ImageSynthesis = ImageSynthesis
        dashscope.api_key = settings.DASHSCOPE_API_KEY
        self.model = settings.WANX_MODEL

    async def generate_image(self, prompt: str, output_path: Path) -> Optional[str]:
        def _call():
            return self._ImageSynthesis.call(
                model=self.model,
                input={"prompt": prompt},
                parameters={"style": "<manga>", "size": "1024*1024", "n": 1},
            )

        rsp = await asyncio.to_thread(_call)
        if getattr(rsp, "status_code", None) != 200:
            print(f"WanX failed: {getattr(rsp, 'message', rsp)}")
            return None

        image_url = rsp.output.results[0].url
        output_path.parent.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            output_path.write_bytes(response.content)
        return str(output_path)


class MimoImageProvider(ImageProvider):
    """MiMo image generation via HTTP API.

    Default shape is OpenAI-compatible POST {base}/images/generations
    with optional b64_json response. Configure via:
      MIMO_IMAGE_BASE_URL, MIMO_IMAGE_API_KEY, MIMO_IMAGE_MODEL
    """

    name = "mimo"

    def __init__(self):
        self.base_url = settings.MIMO_IMAGE_BASE_URL.rstrip("/")
        self.api_key = settings.MIMO_IMAGE_API_KEY
        self.model = settings.MIMO_IMAGE_MODEL
        self.timeout = settings.MIMO_IMAGE_TIMEOUT

    def _endpoint(self) -> str:
        if self.base_url.endswith("/images/generations"):
            return self.base_url
        return f"{self.base_url}/images/generations"

    async def generate_image(self, prompt: str, output_path: Path) -> Optional[str]:
        if not self.base_url:
            print("MIMO_IMAGE_BASE_URL is empty")
            return None

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": settings.MIMO_IMAGE_SIZE,
            "response_format": "b64_json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    self._endpoint(), json=payload, headers=headers
                )
                if resp.status_code >= 400:
                    print(f"MiMo image HTTP {resp.status_code}: {resp.text[:300]}")
                    return None
                data = resp.json()
        except Exception as e:
            print(f"MiMo image request failed: {e}")
            return None

        item = None
        if isinstance(data, dict):
            images = data.get("data") or data.get("images") or data.get("output", {}).get(
                "results"
            )
            if images:
                item = images[0]
        if item is None:
            print(f"MiMo image unexpected response keys: {list(data) if isinstance(data, dict) else type(data)}")
            return None

        output_path.parent.mkdir(parents=True, exist_ok=True)

        # b64_json (OpenAI) or url (both styles)
        if isinstance(item, dict) and item.get("b64_json"):
            output_path.write_bytes(base64.b64decode(item["b64_json"]))
            return str(output_path)

        url = None
        if isinstance(item, dict):
            url = item.get("url") or item.get("image_url")
        elif isinstance(item, str) and item.startswith("http"):
            url = item
        if not url:
            print(f"MiMo image item missing url/b64: {item if not isinstance(item, dict) else list(item)}")
            return None

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url)
            response.raise_for_status()
            output_path.write_bytes(response.content)
        return str(output_path)


class QwenImageProvider(ImageProvider):
    """DashScope Qwen image models (default model: qwen-image-3.0).

    Modes (settings.QWEN_IMAGE_MODE):
      - sdk:   dashscope.ImageSynthesis.call
      - http:  native DashScope text2image HTTP API + task poll
      - openai: OpenAI-compatible /compatible-mode/v1/images/generations
    """

    name = "qwen"

    NATIVE_URL = (
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/"
        "text2image/image-synthesis"
    )
    OPENAI_URL = (
        "https://dashscope.aliyuncs.com/compatible-mode/v1/images/generations"
    )

    def __init__(self):
        self.api_key = settings.DASHSCOPE_API_KEY
        self.model = settings.QWEN_IMAGE_MODEL or "qwen-image-3.0"
        self.size = settings.QWEN_IMAGE_SIZE
        self.negative_prompt = settings.QWEN_IMAGE_NEGATIVE_PROMPT
        self.mode = (settings.QWEN_IMAGE_MODE or "sdk").lower().strip()
        self.timeout = 180.0

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-DashScope-DataInspection": "enable",
        }

    async def _save_from_url_or_b64(self, item, output_path: Path) -> Optional[str]:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(item, dict) and item.get("b64_json"):
            output_path.write_bytes(base64.b64decode(item["b64_json"]))
            return str(output_path)
        url = None
        if isinstance(item, dict):
            url = item.get("url") or item.get("image_url")
        elif isinstance(item, str) and item.startswith("http"):
            url = item
        if not url:
            return None
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            output_path.write_bytes(resp.content)
        return str(output_path)

    def _parameters(self) -> dict:
        params = {
            "size": self.size,
            "n": 1,
            "prompt_extend": True,
            "watermark": False,
        }
        if self.negative_prompt:
            params["negative_prompt"] = self.negative_prompt
        return params

    async def _call_sdk(self, prompt: str, output_path: Path) -> Optional[str]:
        import dashscope
        from dashscope import ImageSynthesis

        dashscope.api_key = self.api_key

        params = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": self.size,
            "prompt_extend": True,
            "watermark": False,
        }
        if self.negative_prompt:
            params["negative_prompt"] = self.negative_prompt

        def _sync():
            return ImageSynthesis.call(**params)

        rsp = await asyncio.to_thread(_sync)
        status = getattr(rsp, "status_code", None)
        if status == 200 and getattr(rsp, "output", None) is not None:
            out = rsp.output
            task_id = getattr(out, "task_id", None)
            if task_id and not getattr(out, "results", None):
                def _poll():
                    for _ in range(90):
                        fetched = ImageSynthesis.fetch(task_id=task_id)
                        if getattr(fetched, "status_code", None) == 200:
                            f_out = fetched.output
                            st = getattr(f_out, "task_status", None)
                            if st in ("SUCCEEDED", "success", "FAILED", "failed"):
                                return fetched
                        time.sleep(2)
                    return None

                rsp = await asyncio.to_thread(_poll)
                if rsp is None:
                    print(f"QwenImage SDK poll timeout model={self.model}")
                    return None

            results = getattr(getattr(rsp, "output", None), "results", None)
            if results:
                item = results[0]
                url = getattr(item, "url", None) or (
                    item.get("url") if isinstance(item, dict) else None
                )
                if url:
                    return await self._save_from_url_or_b64({"url": url}, output_path)
            if isinstance(getattr(rsp, "output", None), dict):
                images = rsp.output.get("results") or rsp.output.get("images")
                if images:
                    return await self._save_from_url_or_b64(images[0], output_path)

        msg = getattr(rsp, "message", rsp)
        code = getattr(rsp, "code", None)
        print(f"QwenImage SDK failed model={self.model} code={code}: {msg}")
        return None

    async def _call_http_native(self, prompt: str, output_path: Path) -> Optional[str]:
        payload = {
            "model": self.model,
            "input": {"prompt": prompt},
            "parameters": self._parameters(),
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                self.NATIVE_URL, json=payload, headers=self._headers()
            )
            if resp.status_code >= 400:
                print(f"QwenImage HTTP {resp.status_code}: {resp.text[:300]}")
                return None
            data = resp.json()

        output = data.get("output") or {}
        task_id = output.get("task_id")
        status = output.get("task_status") or output.get("code")

        if task_id and status not in ("SUCCEEDED", "success"):
            poll_url = f"{self.NATIVE_URL}/{task_id}"
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for _ in range(60):
                    await asyncio.sleep(2)
                    pr = await client.get(poll_url, headers=self._headers())
                    if pr.status_code >= 400:
                        continue
                    data = pr.json()
                    output = data.get("output") or {}
                    st = output.get("task_status")
                    if st in ("SUCCEEDED", "success"):
                        break
                    if st in ("FAILED", "failed"):
                        print(f"QwenImage task failed: {output}")
                        return None

        results = (data.get("output") or {}).get("results") or []
        if not results:
            print(f"QwenImage HTTP no results: {str(data)[:300]}")
            return None
        return await self._save_from_url_or_b64(results[0], output_path)

    async def _call_openai_compatible(self, prompt: str, output_path: Path) -> Optional[str]:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "n": 1,
            "size": self.size.replace("*", "x"),
        }
        if self.negative_prompt:
            payload["negative_prompt"] = self.negative_prompt
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                self.OPENAI_URL, json=payload, headers=self._headers()
            )
            if resp.status_code >= 400:
                print(f"QwenImage OpenAI-compat {resp.status_code}: {resp.text[:300]}")
                return None
            data = resp.json()
        items = data.get("data") or data.get("images") or []
        if not items:
            print(f"QwenImage OpenAI-compat empty data: {str(data)[:300]}")
            return None
        return await self._save_from_url_or_b64(items[0], output_path)

    async def generate_image(self, prompt: str, output_path: Path) -> Optional[str]:
        if not self.api_key or self.api_key.startswith("your-"):
            print("QwenImage: DASHSCOPE_API_KEY missing/placeholder")
            return None

        try:
            if self.mode == "openai":
                return await self._call_openai_compatible(prompt, output_path)
            if self.mode == "http":
                return await self._call_http_native(prompt, output_path)
            return await self._call_sdk(prompt, output_path)
        except Exception as e:
            print(f"QwenImage ({self.mode}) error: {e}")
            # last-resort fallback so one transport failure doesn't kill the panel
            try:
                return await self._call_openai_compatible(prompt, output_path)
            except Exception as e2:
                print(f"QwenImage openai fallback error: {e2}")
                return None


def create_image_provider(name: Optional[str] = None) -> ImageProvider:
    provider = (name or settings.IMAGE_PROVIDER or "mock").lower().strip()
    if provider in ("mimo",):
        return MimoImageProvider()
    if provider in ("wanx", "dashscope-wanx"):
        return WanxImageProvider()
    if provider in ("qwen", "qwen-image", "qwen_image", "qwen-image-3.0"):
        return QwenImageProvider()
    if provider == "mock":
        return MockImageProvider()
    raise ValueError(f"Unknown IMAGE_PROVIDER: {provider}")
