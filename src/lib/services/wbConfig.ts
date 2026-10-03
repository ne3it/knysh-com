export const WB_CALC_CONFIG = {
  TRANSIT_RB_RF: 120.0,
  BASE_LOGISTICS_WB: 50.0,
  OVERVOLUME_LITER_PRICE: 7.0,
  BACK_DELIVERY_RUB: 50.0,
  TAX_RATE: 0.06,
  BUFFER_CONVERSION: 0.02,
  NBRB_API_URL: 'https://nbrb.by/api/exrates/rates/100RUB',
  CACHE_TTL_SECONDS: 3600,
  /** Таймаут запроса курса НБРБ, мс (защита от «зависшего» обновления) */
  NBRB_TIMEOUT_MS: 5000,
  FALLBACK_RUB_TO_BYN: 0.03,
} as const;

export const RUB_TO_BYN_WITH_BUFFER =
  WB_CALC_CONFIG.FALLBACK_RUB_TO_BYN * (1 + WB_CALC_CONFIG.BUFFER_CONVERSION);
