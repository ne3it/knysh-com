import { NextRequest, NextResponse } from 'next/server';
import { CurrencyService } from '@/lib/services/currencyService';
import { WB_CALC_CONFIG } from '@/lib/services/wbConfig';

/**
 * Курс берётся из CurrencyService, где он кэшируется на CACHE_TTL_SECONDS (1 час).
 * Маршрут намеренно динамический, чтобы не «запекать» курс на этапе сборки.
 *
 * ?force=1 — принудительно перезапрашивает НБРБ, игнорируя серверный кэш
 * (иначе кнопка «Обновить курс» не могла изменить значение в течение часа).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('force') === '1';

  try {
    const rubToByn = await CurrencyService.getRubToBynRate(force);
    const retrievedAt = CurrencyService.getCurrentRetrievedAt();
    return NextResponse.json({
      rub_to_byn: rubToByn,
      source: CurrencyService.getCurrentSource(),
      /** Момент фактического получения курса, а не время ответа */
      retrieved_at: retrievedAt,
      age_seconds:
        retrievedAt === null ? null : Math.round((Date.now() - retrievedAt) / 1000),
      ttl_seconds: WB_CALC_CONFIG.CACHE_TTL_SECONDS,
      cached: !force,
      forced: force,
    });
  } catch {
    return NextResponse.json(
      { detail: 'Не удалось получить курс НБРБ', code: 'RATE_ERROR' },
      { status: 500 }
    );
  }
}