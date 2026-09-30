from __future__ import annotations

from pydantic import BaseModel, Field, ConfigDict


class CalculationRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "cost_price": 15.0,
                    "currency": "BYN",
                    "desired_profit_byn": 5.0,
                    "commission_rate": 0.23,
                    "buyout_rate": 0.40,
                    "length": 20.0,
                    "width": 15.0,
                    "height": 10.0,
                }
            ]
        }
    )

    cost_price: float = Field(
        ...,
        gt=0,
        description="Себестоимость товара",
    )
    currency: str = Field(
        ...,
        pattern=r"^(BYN|RUB)$",
        description="Валюта закупки — строго 'BYN' или 'RUB'",
    )
    desired_profit_byn: float = Field(
        ...,
        gt=0,
        description="Желаемая чистая прибыль в BYN с одной продажи",
    )
    commission_rate: float = Field(
        ...,
        ge=0,
        le=1,
        description="Комиссия категории WB, например 0.23 для 23%",
    )
    buyout_rate: float = Field(
        ...,
        gt=0,
        le=1,
        description="Процент выкупа категории, например 0.40 для 40%",
    )
    length: float = Field(
        ...,
        gt=0,
        description="Длина упаковки в см",
    )
    width: float = Field(
        ...,
        gt=0,
        description="Ширина упаковки в см",
    )
    height: float = Field(
        ...,
        gt=0,
        description="Высота упаковки в см",
    )


class CalculationError(BaseModel):
    detail: str
    code: str | None = None


class CalculationResponse(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "recommended_price_rub": 198.02,
                    "recommended_price_byn": 6.21,
                    "cost_rub": 503.79,
                    "cost_byn": 15.81,
                    "desired_profit_rub": 158.11,
                    "desired_profit_byn": 5.0,
                    "volume_liters": 3.0,
                    "single_delivery_rub": 1.23,
                    "single_delivery_byn": 0.04,
                    "back_delivery_rub": 75.0,
                    "back_delivery_byn": 2.36,
                    "total_delivery_rub": 76.23,
                    "total_delivery_byn": 2.4,
                    "transit_rub": 120.0,
                    "transit_byn": 3.78,
                    "commission_rub": 45.54,
                    "commission_byn": 1.43,
                    "tax_rub": 11.88,
                    "tax_byn": 0.37,
                    "roi_percent": 21.43,
                    "exchange_rate_rub_to_byn": 0.0314,
                }
            ]
        }
    )

    recommended_price_rub: float = Field(..., description="Рекомендованная розничная цена (РРЦ) в RUB для кабинета WB")
    recommended_price_byn: float = Field(..., description="Рекомендованная розничная цена (РРЦ) в BYN")
    cost_rub: float = Field(..., description="Себестоимость в RUB")
    cost_byn: float = Field(..., description="Себестоимость в BYN")
    desired_profit_rub: float = Field(..., description="Желаемая прибыль в RUB")
    desired_profit_byn: float = Field(..., description="Желаемая прибыль в BYN")
    volume_liters: float = Field(..., description="Объем упаковки в литрах")
    single_delivery_rub: float = Field(..., description="Стоимость доставки одной единицы в RUB")
    single_delivery_byn: float = Field(..., description="Стоимость доставки одной единицы в BYN")
    back_delivery_rub: float = Field(..., description="Расходы на невыкупы (обратная логистика) в RUB")
    back_delivery_byn: float = Field(..., description="Расходы на невыкупы (обратная логистика) в BYN")
    total_delivery_rub: float = Field(..., description="Полные логистические расходы в RUB")
    total_delivery_byn: float = Field(..., description="Полные логистические расходы в BYN")
    transit_rub: float = Field(..., description="Транзит РБ -> РФ в RUB")
    transit_byn: float = Field(..., description="Транзит РБ -> РФ в BYN")
    commission_rub: float = Field(..., description="Комиссия WB в RUB")
    commission_byn: float = Field(..., description="Комиссия WB в BYN")
    tax_rub: float = Field(..., description="Налог (6% НДС) в RUB")
    tax_byn: float = Field(..., description="Налог (6% НДС) в BYN")
    roi_percent: float = Field(..., description="ROI в процентах")
    exchange_rate_rub_to_byn: float = Field(..., description="Курс 1 RUB = BYN (с буфером)")
