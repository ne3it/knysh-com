from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

from .config import settings

logger = logging.getLogger(__name__)


class CurrencyError(Exception):
    """Raised when currency rate cannot be retrieved or parsed."""


@dataclass(frozen=True)
class ExchangeRate:
    rub_to_byn: float
    retrieved_at: float
    source: str  # 'nbrb' or 'fallback'

    def is_expired(self, ttl: int) -> bool:
        return (time.time() - self.retrieved_at) > ttl


class CurrencyService:
    _instance: CurrencyService | None = None
    _initialized: bool = False
    _rate: ExchangeRate | None = None
    _lock: asyncio.Lock | None = None

    def __new__(cls) -> CurrencyService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @classmethod
    def _ensure_lock(cls) -> asyncio.Lock:
        if cls._lock is None:
            cls._lock = asyncio.Lock()
        return cls._lock

    @staticmethod
    def _fallback_rate() -> ExchangeRate:
        rate: float = settings.FALLBACK_RUB_TO_BYN * (1 + settings.BUFFER_CONVERSION)
        return ExchangeRate(
            rub_to_byn=rate,
            retrieved_at=time.time(),
            source="fallback",
        )

    async def _fetch_from_nbrb(self) -> ExchangeRate:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response: httpx.Response = await client.get(settings.NBRB_API_URL)
            response.raise_for_status()
            data: dict = response.json()

        official_rate: float = data["Cur_OfficialRate"]
        scale: int = data.get("Cur_Scale", 100)
        raw_rate: float = official_rate / scale  # BYN per 1 RUB
        buffered_rate: float = raw_rate * (1 + settings.BUFFER_CONVERSION)

        return ExchangeRate(
            rub_to_byn=buffered_rate,
            retrieved_at=time.time(),
            source="nbrb",
        )

    @property
    def cache_seconds(self) -> int:
        return self._rate.retrieved_at if self._rate else 0.0

    async def get_rate(self, force_refresh: bool = False) -> ExchangeRate:
        """Returns the current exchange rate. Uses cache if available and not expired."""
        lock: asyncio.Lock = self._ensure_lock()
        async with lock:
            if (
                force_refresh is False
                and self._rate is not None
                and not self._rate.is_expired(settings.CACHE_TTL_SECONDS)
            ):
                return self._rate

            try:
                self._rate = await self._fetch_from_nbrb()
            except (httpx.HTTPError, KeyError, ValueError, TypeError) as exc:
                logger.warning(
                    "NBRB API unavailable (%s). Using fallback rate.", exc
                )
                self._rate = self._fallback_rate()

            return self._rate

    async def get_rub_to_byn_rate(self, force_refresh: bool = False) -> float:
        """Convenience method: returns just the rate as a float."""
        return (await self.get_rate(force_refresh)).rub_to_byn

    @property
    def current_rate(self) -> float | None:
        """Synchronous access to the cached rate (or None if not yet fetched)."""
        if self._rate is not None and not self._rate.is_expired(settings.CACHE_TTL_SECONDS):
            return self._rate.rub_to_byn
        return None

    @property
    def current_source(self) -> str | None:
        if self._rate is not None:
            return self._rate.source
        return None


def convert_rub_to_byn(rub: float, rate: float) -> float:
    """Convert RUB to BYN."""
    return rub * rate


def convert_byn_to_rub(byn: float, rate: float) -> float:
    """Convert BYN to RUB."""
    return byn / rate
