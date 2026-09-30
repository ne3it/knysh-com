from __future__ import annotations

from dataclasses import dataclass

from .config import settings
from .currency import (
    CurrencyService,
    convert_byn_to_rub,
    convert_rub_to_byn,
)
from .schemas import CalculationRequest, CalculationResponse


class CalculatorError(Exception):
    """Raised on invalid calculation parameters."""


@dataclass(frozen=True)
class LogisticsInfo:
    volume_liters: float
    single_delivery_rub: float
    transit_rub: float
    back_delivery_rub: float
    total_delivery_rub: float


@dataclass(frozen=True)
class PriceBreakdown:
    recommended_price_rub: float
    commission_rub: float
    tax_rub: float


class WbUnitCalculator:
    """Калькулятор юнит-экономики для Wildberries (РБ -> РФ)."""

    def __init__(self, currency_service: CurrencyService | None = None) -> None:
        self._currency_service: CurrencyService = (
            currency_service if currency_service is not None else CurrencyService()
        )

    # --- Static calculation methods (for unit testing) ---

    @staticmethod
    def calculate_volume(length: float, width: float, height: float) -> float:
        """Объем упаковки в литрах."""
        return (length * width * height) / 1000

    @staticmethod
    def calculate_delivery(volume_liters: float, buyout_rate: float) -> LogisticsInfo:
        """Логистические расходы по одной единице (с учетом выкупа)."""
        if buyout_rate <= 0 or buyout_rate > 1:
            raise CalculatorError(
                f"buyout_rate должен быть в диапазоне (0, 1], получено: {buyout_rate}"
            )

        single_delivery_rub: float = (
            settings.BASE_LOGISTICS_WB
            + max(0.0, volume_liters - 1) * settings.OVERVOLUME_LITER_PRICE
            + settings.TRANSIT_RB_RF
        )
        back_delivery_rub: float = (
            (1 - buyout_rate) / buyout_rate
        ) * settings.BACK_DELIVERY_RUB
        total_delivery_rub: float = single_delivery_rub + back_delivery_rub

        return LogisticsInfo(
            volume_liters=round(volume_liters, 3),
            single_delivery_rub=round(single_delivery_rub, 2),
            transit_rub=settings.TRANSIT_RB_RF,
            back_delivery_rub=round(back_delivery_rub, 2),
            total_delivery_rub=round(total_delivery_rub, 2),
        )

    @staticmethod
    def calculate_price(
        cost_rub: float,
        total_delivery_rub: float,
        desired_profit_rub: float,
        commission_rate: float,
    ) -> PriceBreakdown:
        """Рекомендованная розничная цена (РРЦ) с разбивкой по комиссии и налогу."""
        denominator: float = 1 - commission_rate - settings.TAX_RATE
        if denominator <= 0:
            raise CalculatorError(
                f"Сумма комиссии ({commission_rate}) и налога ({settings.TAX_RATE}) "
                f"должна быть меньше 1. Проверьте входные параметры."
            )

        recommended_price_rub: float = (
            cost_rub + total_delivery_rub + desired_profit_rub
        ) / denominator
        commission_rub: float = recommended_price_rub * commission_rate
        tax_rub: float = recommended_price_rub * settings.TAX_RATE

        return PriceBreakdown(
            recommended_price_rub=recommended_price_rub,
            commission_rub=commission_rub,
            tax_rub=tax_rub,
        )

    @staticmethod
    def _calculate_roi(
        revenue_rub: float,
        cost_rub: float,
        delivery_rub: float,
        commission_rub: float,
        tax_rub: float,
    ) -> float:
        """ROI = (чистая прибыль / инвестиции) * 100."""
        total_investment: float = cost_rub + delivery_rub
        if total_investment <= 0:
            return 0.0
        profit: float = revenue_rub - commission_rub - tax_rub - total_investment
        return (profit / total_investment) * 100

    # --- Main calculation entry point ---

    async def calculate(self, request: CalculationRequest) -> CalculationResponse:
        """Полный расчет юнит-экономики: цена, логистика, налоги, ROI."""
        rate: float = await self._currency_service.get_rub_to_byn_rate()

        # Convert cost to RUB (working currency for formulas)
        if request.currency == "BYN":
            cost_rub: float = convert_byn_to_rub(request.cost_price, rate)
            cost_byn: float = request.cost_price
        else:  # RUB
            cost_rub = request.cost_price
            cost_byn = convert_rub_to_byn(cost_rub, rate)

        desired_profit_rub: float = convert_byn_to_rub(
            request.desired_profit_byn, rate
        )

        # Logistics
        volume_liters: float = self.calculate_volume(
            request.length, request.width, request.height
        )
        logistics: LogisticsInfo = self.calculate_delivery(volume_liters, request.buyout_rate)

        # Price
        price: PriceBreakdown = self.calculate_price(
            cost_rub,
            logistics.total_delivery_rub,
            desired_profit_rub,
            request.commission_rate,
        )

        # ROI
        roi_percent: float = self._calculate_roi(
            price.recommended_price_rub,
            cost_rub,
            logistics.total_delivery_rub,
            price.commission_rub,
            price.tax_rub,
        )

        return CalculationResponse(
            recommended_price_rub=round(price.recommended_price_rub, 2),
            recommended_price_byn=round(
                convert_rub_to_byn(price.recommended_price_rub, rate), 2
            ),
            cost_rub=round(cost_rub, 2),
            cost_byn=round(cost_byn, 2),
            desired_profit_rub=round(desired_profit_rub, 2),
            desired_profit_byn=request.desired_profit_byn,
            volume_liters=logistics.volume_liters,
            single_delivery_rub=logistics.single_delivery_rub,
            single_delivery_byn=round(
                convert_rub_to_byn(logistics.single_delivery_rub, rate), 2
            ),
            back_delivery_rub=logistics.back_delivery_rub,
            back_delivery_byn=round(
                convert_rub_to_byn(logistics.back_delivery_rub, rate), 2
            ),
            total_delivery_rub=logistics.total_delivery_rub,
            total_delivery_byn=round(
                convert_rub_to_byn(logistics.total_delivery_rub, rate), 2
            ),
            transit_rub=logistics.transit_rub,
            transit_byn=round(
                convert_rub_to_byn(logistics.transit_rub, rate), 2
            ),
            commission_rub=round(price.commission_rub, 2),
            commission_byn=round(
                convert_rub_to_byn(price.commission_rub, rate), 2
            ),
            tax_rub=round(price.tax_rub, 2),
            tax_byn=round(convert_rub_to_byn(price.tax_rub, rate), 2),
            roi_percent=round(roi_percent, 2),
            exchange_rate_rub_to_byn=round(rate, 6),
        )
