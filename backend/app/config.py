from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT / ".env", extra="ignore")
    llm_provider: str = "groq"  # groq | xai
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-20b"
    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-4"
    model_manager: str = ""
    model_risk: str = ""
    model_sast: str = ""
    model_pentest: str = ""
    model_implementer: str = ""
    model_crypto: str = ""
    sandbox_dir: Path = PROJECT / "sandbox"
    workspace_dir: Path = PROJECT / "workspace"
    samples_dir: Path = PROJECT / "backend" / "samples"
    handoff_pause: float = 3.0

    @property
    def api_key(self) -> str:
        return self.groq_api_key if self.llm_provider == "groq" else self.xai_api_key


settings = Settings()