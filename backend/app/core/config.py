from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=(ROOT_DIR / ".env", BACKEND_DIR / ".env"),
        extra="ignore",
    )

    mongo_uri: str = "mongodb://127.0.0.1:27017/ai-resume"
    openai_api_key: str | None = None
    embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    llm_model: str = "gpt-4o-mini"
    faiss_index_path: str = "./faiss/jobs.index"
    allowed_origins: str = "*"
    port: int = 8000


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
