import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import dashscope
from dashscope import ImageSynthesis

from app.config import settings

dashscope.api_key = settings.DASHSCOPE_API_KEY

candidates = [
    "qwen-image-3.0",
    "qwen-image",
    "qwen-image-plus",
    "qwen-image-v1",
    "wanx-v1",
    "wanx2.1-t2i-turbo",
    "wanx2.1-t2i-plus",
    "wanx2.2-t2i-flash",
    "wanx2.2-t2i-plus",
]

prompt = "A simple red circle on white background, minimal icon"
for m in candidates:
    try:
        rsp = ImageSynthesis.call(
            model=m,
            prompt=prompt,
            n=1,
            size="1024*1024",
            watermark=False,
        )
        code = getattr(rsp, "code", None)
        msg = str(getattr(rsp, "message", ""))[:140]
        sc = getattr(rsp, "status_code", None)
        results = getattr(getattr(rsp, "output", None), "results", None)
        task_id = getattr(getattr(rsp, "output", None), "task_id", None)
        print(f"{m:24} status={sc} code={code} results={bool(results)} task={bool(task_id)} msg={msg}")
    except Exception as e:
        print(f"{m:24} EXC {e}")
