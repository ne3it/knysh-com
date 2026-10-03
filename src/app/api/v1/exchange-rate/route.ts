import { NextResponse } from 'next/server';
import { CurrencyService } from '@/lib/services/currencyService';

/**
 * Курс берётся из CurrencyService, где он кэшируется на CACHE_TTL_SECONDS (1 час).
 * Маршрут намеренно динамический, чтобы не «запекать» курс на этапе сборки.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rubToByn = await CurrencyService.getRubToBynRate();
    return NextResponse.json({
      rub_to_byn: rubToByn,
      source: CurrencyService.getCurrentSource(),
    });
  } catch {
    return NextResponse.json(
      { detail: 'Не удалось получить курс НБРБ', code: 'RATE_ERROR' },
      { status: 500 }
    );
  }
}
