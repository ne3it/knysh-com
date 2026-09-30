import { WB_CALC_CONFIG } from './wbConfig';
import { CurrencyService, convertRubToByn, convertBynToRub } from './currencyService';

export interface CalculationRequest {
  cost_price: number;
  currency: 'BYN' | 'RUB';
  desired_profit_byn: number;
  commission_rate: number;
  buyout_rate: number;
  length: number;
  width: number;
  height: number;
  warehouse_coefficient?: number;
}

export interface CalculationResponse {
  recommended_price_rub: number;
  recommended_price_byn: number;
  cost_rub: number;
  cost_byn: number;
  desired_profit_rub: number;
  desired_profit_byn: number;
  volume_liters: number;
  single_delivery_rub: number;
  single_delivery_byn: number;
  back_delivery_rub: number;
  back_delivery_byn: number;
  total_delivery_rub: number;
  total_delivery_byn: number;
  transit_rub: number;
  transit_byn: number;
  commission_rub: number;
  commission_byn: number;
  tax_rub: number;
  tax_byn: number;
  roi_percent: number;
  warehouse_coefficient: number;
  exchange_rate_rub_to_byn: number;
}

export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorError';
  }
}

interface LogisticsInfo {
  volumeLiters: number;
  singleDeliveryRub: number;
  transitRub: number;
  backDeliveryRub: number;
  totalDeliveryRub: number;
}

interface PriceBreakdown {
  recommendedPriceRub: number;
  commissionRub: number;
  taxRub: number;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export class WbUnitCalculator {
  static calculateVolume(length: number, width: number, height: number): number {
    return (length * width * height) / 1000;
  }

  static calculateDelivery(
    volumeLiters: number,
    buyoutRate: number,
    warehouseCoefficient = 1
  ): LogisticsInfo {
    if (buyoutRate <= 0 || buyoutRate > 1) {
      throw new CalculatorError(
        `buyout_rate должен быть в диапазоне (0, 1], получено: ${buyoutRate}`
      );
    }

    if (warehouseCoefficient <= 0) {
      throw new CalculatorError(
        `Коэффициент логистики склада должен быть больше 0, получено: ${warehouseCoefficient}`
      );
    }

    const baseDeliveryRub =
      (WB_CALC_CONFIG.BASE_LOGISTICS_WB +
        Math.max(0, volumeLiters - 1) * WB_CALC_CONFIG.OVERVOLUME_LITER_PRICE) *
      warehouseCoefficient;
    const singleDeliveryRub = baseDeliveryRub + WB_CALC_CONFIG.TRANSIT_RB_RF;
    const backDeliveryRub =
      ((1 - buyoutRate) / buyoutRate) * WB_CALC_CONFIG.BACK_DELIVERY_RUB;
    const totalDeliveryRub = singleDeliveryRub + backDeliveryRub;

    return {
      volumeLiters: round(volumeLiters, 3),
      singleDeliveryRub: round(singleDeliveryRub, 2),
      transitRub: WB_CALC_CONFIG.TRANSIT_RB_RF,
      backDeliveryRub: round(backDeliveryRub, 2),
      totalDeliveryRub: round(totalDeliveryRub, 2),
    };
  }

  static calculatePrice(
    costRub: number,
    totalDeliveryRub: number,
    desiredProfitRub: number,
    commissionRate: number
  ): PriceBreakdown {
    const denominator = 1 - commissionRate - WB_CALC_CONFIG.TAX_RATE;
    if (denominator <= 0) {
      throw new CalculatorError(
        `Сумма комиссии (${commissionRate}) и налога (${WB_CALC_CONFIG.TAX_RATE}) ` +
          'должна быть меньше 1. Проверьте входные параметры.'
      );
    }

    const recommendedPriceRub =
      (costRub + totalDeliveryRub + desiredProfitRub) / denominator;
    const commissionRub = recommendedPriceRub * commissionRate;
    const taxRub = recommendedPriceRub * WB_CALC_CONFIG.TAX_RATE;

    return {
      recommendedPriceRub,
      commissionRub,
      taxRub,
    };
  }

  private static calculateRoi(
    desiredProfitByn: number,
    costByn: number
  ): number {
    if (costByn <= 0) {
      return 0.0;
    }
    return (desiredProfitByn / costByn) * 100;
  }

  static async calculate(
    request: CalculationRequest
  ): Promise<CalculationResponse> {
    const rate = await CurrencyService.getRubToBynRate();

    let costRub: number;
    let costByn: number;

    if (request.currency === 'BYN') {
      costRub = convertBynToRub(request.cost_price, rate);
      costByn = request.cost_price;
    } else {
      costRub = request.cost_price;
      costByn = convertRubToByn(costRub, rate);
    }

    const desiredProfitRub = convertBynToRub(
      request.desired_profit_byn,
      rate
    );

    const warehouseCoefficient =
      typeof request.warehouse_coefficient === 'number'
        ? request.warehouse_coefficient
        : 1;

    const volumeLiters = this.calculateVolume(
      request.length,
      request.width,
      request.height
    );
    const logistics = this.calculateDelivery(
      volumeLiters,
      request.buyout_rate,
      warehouseCoefficient
    );

    const price = this.calculatePrice(
      costRub,
      logistics.totalDeliveryRub,
      desiredProfitRub,
      request.commission_rate
    );

    const roiPercent = this.calculateRoi(request.desired_profit_byn, costByn);

    return {
      recommended_price_rub: round(price.recommendedPriceRub, 2),
      recommended_price_byn: round(
        convertRubToByn(price.recommendedPriceRub, rate),
        2
      ),
      cost_rub: round(costRub, 2),
      cost_byn: round(costByn, 2),
      desired_profit_rub: round(desiredProfitRub, 2),
      desired_profit_byn: request.desired_profit_byn,
      volume_liters: logistics.volumeLiters,
      single_delivery_rub: logistics.singleDeliveryRub,
      single_delivery_byn: round(
        convertRubToByn(logistics.singleDeliveryRub, rate),
        2
      ),
      back_delivery_rub: logistics.backDeliveryRub,
      back_delivery_byn: round(
        convertRubToByn(logistics.backDeliveryRub, rate),
        2
      ),
      total_delivery_rub: logistics.totalDeliveryRub,
      total_delivery_byn: round(
        convertRubToByn(logistics.totalDeliveryRub, rate),
        2
      ),
      transit_rub: logistics.transitRub,
      transit_byn: round(convertRubToByn(logistics.transitRub, rate), 2),
      commission_rub: round(price.commissionRub, 2),
      commission_byn: round(
        convertRubToByn(price.commissionRub, rate),
        2
      ),
      tax_rub: round(price.taxRub, 2),
      tax_byn: round(convertRubToByn(price.taxRub, rate), 2),
      roi_percent: round(roiPercent, 2),
      warehouse_coefficient: warehouseCoefficient,
      exchange_rate_rub_to_byn: round(rate, 6),
    };
  }
}
