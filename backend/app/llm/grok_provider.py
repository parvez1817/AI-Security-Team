import asyncio

import httpx

from app.llm.base import LLMProvider

RETRY_STATUS = {408, 409, 425, 429, 500, 502, 503, 504}


class GrokProvider(LLMProvider):
    """OpenAI-compatible chat client, used for both Groq and xAI."""

    def __init__(self, base_url: str, api_key: str, model: str, max_tokens: int = 16000, retries: int = 4):
        self.base_url, self.api_key, self.model = base_url, api_key, model
        self.max_tokens, self.retries = max_tokens, retries

    async def chat(self, system: str, user: str) -> str:
        payload = {"model": self.model, "temperature": 0.1, "max_tokens": self.max_tokens,
                   "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        if "gpt-oss" in self.model:  # reasoning models: keep thinking short so the answer fits in the token budget
            payload["reasoning_effort"] = "low"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        last: Exception | None = None
        async with httpx.AsyncClient(timeout=240) as c:
            for attempt in range(self.retries):
                try:
                    r = await c.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                    if r.status_code in RETRY_STATUS:
                        wait = float(r.headers.get("retry-after", 0) or 0) or 2 ** attempt
                        last = httpx.HTTPStatusError(f"HTTP {r.status_code}", request=r.request, response=r)
                        await asyncio.sleep(min(wait, 30))
                        continue
                    r.raise_for_status()
                    content = (r.json()["choices"][0]["message"].get("content") or "").strip()
                    if content:
                        return content
                    last = RuntimeError("model returned an empty reply")
                except (httpx.TransportError, KeyError, IndexError) as e:
                    last = e
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError(f"LLM request failed after {self.retries} attempts: {last}")
