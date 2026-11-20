from app.config import settings
from app.llm.base import LLMProvider
from app.llm.grok_provider import GrokProvider


def get_llm(agent: str | None = None) -> LLMProvider:
    if not settings.api_key:
        raise RuntimeError(f"{settings.llm_provider.upper()}_API_KEY is not set. Add it to .env and restart the backend.")
    override = getattr(settings, f"model_{agent}", "") if agent else ""
    if settings.llm_provider == "groq":
        return GrokProvider(settings.groq_base_url, settings.groq_api_key, override or settings.groq_model)
    return GrokProvider(settings.xai_base_url, settings.xai_api_key, override or settings.xai_model)