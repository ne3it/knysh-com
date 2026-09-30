import { NextRequest, NextResponse } from 'next/server';
import { WbUnitCalculator, CalculatorError, type CalculationRequest } from '@/lib/services/wbCalculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validated: CalculationRequest = {
      cost_price: body.cost_price,
      currency: body.currency,
      desired_profit_byn: body.desired_profit_byn,
      commission_rate: body.commission_rate,
      buyout_rate: body.buyout_rate,
      length: body.length,
      width: body.width,
      height: body.height,
      warehouse_coefficient:
        typeof body.warehouse_coefficient === 'number'
          ? body.warehouse_coefficient
          : 1,
    };

    if (typeof validated.cost_price !== 'number' || validated.cost_price <= 0) {
      return NextResponse.json(
        { detail: 'cost_price must be a positive number', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!['BYN', 'RUB'].includes(validated.currency)) {
      return NextResponse.json(
        { detail: 'currency must be "BYN" or "RUB"', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (typeof validated.desired_profit_byn !== 'number' || validated.desired_profit_byn <= 0) {
      return NextResponse.json(
        { detail: 'desired_profit_byn must be a positive number', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (typeof validated.commission_rate !== 'number' || validated.commission_rate < 0 || validated.commission_rate > 1) {
      return NextResponse.json(
        { detail: 'commission_rate must be between 0 and 1', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (typeof validated.buyout_rate !== 'number' || validated.buyout_rate <= 0 || validated.buyout_rate > 1) {
      return NextResponse.json(
        { detail: 'buyout_rate must be between 0 and 1', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    for (const field of ['length', 'width', 'height'] as const) {
      if (typeof validated[field] !== 'number' || validated[field] <= 0) {
        return NextResponse.json(
          { detail: `${field} must be a positive number`, code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
    }

    if (
      typeof validated.warehouse_coefficient !== 'number' ||
      validated.warehouse_coefficient <= 0
    ) {
      return NextResponse.json(
        {
          detail: 'warehouse_coefficient must be a positive number',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const result = await WbUnitCalculator.calculate(validated);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CalculatorError) {
      return NextResponse.json(
        { detail: err.message, code: 'CALCULATION_ERROR' },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка';
    return NextResponse.json(
      { detail: `Внутренняя ошибка: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
