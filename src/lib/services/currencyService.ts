import { WB_CALC_CONFIG } from './wbConfig';

export interface ExchangeRate {
  rubToByn: number;
  retrievedAt: number;
  source: 'nbrb' | 'fallback';
}

function isExpired(rate: ExchangeRate): boolean {
  return Date.now() - rate.retrievedAt > WB_CALC_CONFIG.CACHE_TTL_SECONDS * 1000;
}

function fallbackRate(): ExchangeRate {
  const rate =
    WB_CALC_CONFIG.FALLBACK_RUB_TO_BYN * (1 + WB_CALC_CONFIG.BUFFER_CONVERSION);
  return {
    rubToByn: rate,
    retrievedAt: Date.now(),
    source: 'fallback',
  };
}

let cachedRate: ExchangeRate | null = null;
let inFlight: Promise<ExchangeRate> | null = null;

async function fetchFromNbrb(): Promise<ExchangeRate> {
  const response = await fetch(WB_CALC_CONFIG.NBRB_API_URL, {
    next: { revalidate: WB_CALC_CONFIG.CACHE_TTL_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`NBRB API error: ${response.status}`);
  }
  const data: Record<string, unknown> = await response.json();
  const officialRate = data['Cur_OfficialRate'] as number;
  const scale = (data['Cur_Scale'] as number) ?? 100;
  const rawRate = officialRate / scale;
  const bufferedRate = rawRate * (1 + WB_CALC_CONFIG.BUFFER_CONVERSION);
  return {
    rubToByn: bufferedRate,
    retrievedAt: Date.now(),
    source: 'nbrb',
  };
}

export class CurrencyService {
  static async getRubToBynRate(forceRefresh = false): Promise<number> {
    if (inFlight) {
      return inFlight.then((r) => r.rubToByn);
    }
    if (
      !forceRefresh &&
      cachedRate !== null &&
      !isExpired(cachedRate)
    ) {
      return cachedRate.rubToByn;
    }
    inFlight = (async () => {
      try {
        cachedRate = await fetchFromNbrb();
      } catch (err) {
        console.warn(
          'NBRB API unavailable (%s). Using fallback rate.',
          err instanceof Error ? err.message : String(err)
        );
        cachedRate = fallbackRate();
      } finally {
        inFlight = null;
      }
      return cachedRate;
    })();
    const rate = await inFlight;
    return rate.rubToByn;
  }

  static getCurrentRate(): number | null {
    if (cachedRate !== null && !isExpired(cachedRate)) {
      return cachedRate.rubToByn;
    }
    return null;
  }

  static getCurrentSource(): 'nbrb' | 'fallback' | null {
    if (cachedRate !== null) {
      return cachedRate.source;
    }
    return null;
  }
}

export function convertRubToByn(rub: number, rate: number): number {
  return rub * rate;
}

export function convertBynToRub(byn: number, rate: number): number {
  return byn / rate;
}
