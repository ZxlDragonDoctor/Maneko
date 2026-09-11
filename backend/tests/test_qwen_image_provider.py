from app.agents.image_providers import QwenImageProvider, create_image_provider
from app.config import settings


def test_create_provider_qwen_aliases():
    for alias in ("qwen", "qwen-image", "qwen_image", "qwen-image-3.0"):
        p = create_image_provider(alias)
        assert isinstance(p, QwenImageProvider)
        assert p.name == "qwen"


def test_qwen_default_model_and_mode():
    p = QwenImageProvider()
    assert p.model == settings.QWEN_IMAGE_MODEL or p.model == "qwen-image-3.0"
    assert p.mode in ("sdk", "http", "openai")
    assert p.size
    assert "Authorization" in p._headers()


def test_qwen_parameters_include_negative_prompt():
    p = QwenImageProvider()
    params = p._parameters()
    assert params["n"] == 1
    assert "size" in params
    if settings.QWEN_IMAGE_NEGATIVE_PROMPT:
        assert params.get("negative_prompt")


def test_qwen_endpoints():
    p = QwenImageProvider()
    assert "image-synthesis" in p.NATIVE_URL
    assert "compatible-mode" in p.OPENAI_URL
