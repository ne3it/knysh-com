from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_prefix": "WB_CALC_"}

    TRANSIT_RB_RF: float = 120.0
    BASE_LOGISTICS_WB: float = 50.0
    OVERVOLUME_LITER_PRICE: float = 7.0
    BACK_DELIVERY_RUB: float = 50.0
    TAX_RATE: float = 0.06
    BUFFER_CONVERSION: float = 0.02

    NBRB_API_URL: str = "https://nbrb.by/api/exrates/rates/100RUB"
    CACHE_TTL_SECONDS: int = 3600
    FALLBACK_RUB_TO_BYN: float = 0.03  # ~3 копейки за 1 рубль

    @property
    def RUB_TO_BYN_WITH_BUFFER(self) -> float:
        return self.FALLBACK_RUB_TO_BYN * (1 + self.BUFFER_CONVERSION)


settings = Settings()
