from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from .calculator_service import WbUnitCalculator, CalculatorError
from .schemas import CalculationRequest, CalculationResponse, CalculationError as CalculationErrorResponse

router: APIRouter = APIRouter(
    prefix="/api/v1",
    tags=["wb-calculator"],
)

_calculator: WbUnitCalculator = WbUnitCalculator()


@router.post(
    "/calculate-wb-unit",
    response_model=CalculationResponse,
    responses={
        400: {
            "description": "Invalid input",
            "content": {
                "application/json": {
                    "example": {"detail": "...", "code": "CALCULATION_ERROR"}
                }
            },
        },
        500: {
            "description": "Internal error",
            "content": {
                "application/json": {
                    "example": {"detail": "...", "code": "INTERNAL_ERROR"}
                }
            },
        },
    },
    summary="Калькулятор юнит-экономики Wildberries (РБ → РФ)",
    description=(
        "Вычисляет РРЦ для Wildberries с учетом логистики РБ, "
        "курса валют (НБРБ), комиссии, налога (6% НДС), выкупа и ROI. "
        "Для селлеров из Беларуси, поставляющих товары в РФ."
    ),
)
async def calculate_wb_unit(request: CalculationRequest) -> CalculationResponse:
    """Расчитать юнит-экономику Wildberries за один клик."""
    try:
        result: CalculationResponse = await _calculator.calculate(request)
    except CalculatorError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=CalculationErrorResponse(
                detail=str(exc), code="CALCULATION_ERROR"
            ).model_dump(),
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=CalculationErrorResponse(
                detail=f"Внутренняя ошибка: {exc}", code="INTERNAL_ERROR"
            ).model_dump(),
        ) from exc

    return result
