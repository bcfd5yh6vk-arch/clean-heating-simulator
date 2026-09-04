/* ---------------------------------------------------------------------------
 * 选点之后的自然教育课：气候特征 → 物候 → 为什么。
 *
 * 只使用已经查到的月均温 / 月降水 / Köppen 码。不点名当地物种。
 * 缺 12 个月气温就整课 insufficient_data，不编物候。
 * ------------------------------------------------------------------------- */

export type MonthBand = "ice" | "cold" | "cool" | "mild" | "warm" | "hot";
export type MonthWet = "dry" | "typical" | "wet";

export interface MonthMark {
  month: number;
  temp_c: number;
  precip_mm: number | null;
  band: MonthBand;
  wet: MonthWet;
}

export interface CopyRef {
  key: string;
  params: Record<string, string | number>;
}

export type NatureLessonStatus = "ok" | "insufficient_data";

export interface NatureLesson {
  status: NatureLessonStatus;
  koppen_code: string | null;
  family: string;
  phenology_key: string;
  climate: CopyRef;
  phenology: CopyRef;
  why: CopyRef[];
  home: CopyRef;
  months: MonthMark[];
  facts: {
    coldest_month: number;
    coldest_c: number;
    warmest_month: number;
    warmest_c: number;
    wettest_month: number | null;
    wettest_mm: number | null;
    driest_month: number | null;
    driest_mm: number | null;
    months_below_0: number;
    months_below_5: number;
    months_at_or_above_22: number;
  } | null;
}

export interface NatureClimateInput {
  temperature_c_monthly?: number[] | null;
  precipitation_mm_monthly?: number[] | null;
  koppen_code?: string | null;
}

const BAND_CUT = [
  { max: 0, band: "ice" as const },
  { max: 5, band: "cold" as const },
  { max: 12, band: "cool" as const },
  { max: 18, band: "mild" as const },
  { max: 24, band: "warm" as const },
];

export const MONTH_BAND_COLOR: Record<MonthBand, string> = {
  ice: "#7C99B4",
  cold: "#2F6E96",
  cool: "#3F7A56",
  mild: "#5A9A74",
  warm: "#A98235",
  hot: "#B4551F",
};

function isTwelve(values: unknown): values is number[] {
  return (
    Array.isArray(values) &&
    values.length === 12 &&
    values.every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function bandOf(temp: number): MonthBand {
  for (const cut of BAND_CUT) {
    if (temp < cut.max) return cut.band;
  }
  return "hot";
}

function oneDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function rainText(n: number): string {
  return n >= 10 ? String(Math.round(n)) : oneDecimal(n);
}

/** Köppen 细分类落到自然教育用的气候家族。未知码仍可凭气温讲物候。 */
export function koppenFamily(code: string | null | undefined): string {
  if (!code) return "unknown";
  const c = code.trim().toUpperCase();
  const g = c.charAt(0);
  const s = c.charAt(1);
  if (g === "A") {
    if (s === "F") return "tropical_rainforest";
    if (s === "M") return "tropical_monsoon";
    return "tropical_savanna";
  }
  if (g === "B") return s === "W" ? "arid_desert" : "arid_steppe";
  if (g === "C") {
    if (s === "S") return "temperate_dry_summer";
    if (s === "W") return "temperate_dry_winter";
    return "temperate_no_dry";
  }
  if (g === "D") {
    if (s === "S") return "continental_dry_summer";
    if (s === "W") return "continental_dry_winter";
    return "continental_no_dry";
  }
  if (g === "E") return s === "T" ? "polar_tundra" : "polar_frost";
  return "unknown";
}

function phenologyKey(family: string, temps: number[], wetRatio: number | null): string {
  const min = Math.min(...temps);
  const below0 = temps.filter((t) => t < 0).length;
  const below5 = temps.filter((t) => t < 5).length;
  if (temps.every((t) => t < 0)) return "ice_year";
  if (family === "polar_frost") return "ice_year";
  if (family === "polar_tundra" || (below0 >= 8 && min < -5)) return "short_thaw";
  if (family === "arid_desert" || family === "arid_steppe") return "wait_for_rain";
  if (
    (family === "tropical_savanna" || family === "tropical_monsoon") &&
    wetRatio != null &&
    wetRatio >= 3
  ) {
    return "rain_pulse";
  }
  if (min >= 18) return "evergreen";
  if (below5 >= 3) return "winter_rest";
  return "mild_season";
}

function homeKey(temps: number[]): string {
  const coldest = Math.min(...temps);
  const warmest = Math.max(...temps);
  const below5 = temps.filter((t) => t < 5).length;
  const hot = temps.filter((t) => t >= 22).length;
  const needHeat = below5 >= 2 || coldest < 5;
  const needCool = hot >= 2 || warmest >= 24;
  if (needHeat && needCool) return "need_both";
  if (needHeat) return "need_heat";
  if (needCool) return "need_cool";
  return "need_neither";
}

/**
 * 从气候档案生成一堂自然教育课。同一输入两次结果必须逐字段相同。
 */
export function explainNatureClimate(input: NatureClimateInput | null | undefined): NatureLesson {
  const empty: NatureLesson = {
    status: "insufficient_data",
    koppen_code: null,
    family: "unknown",
    phenology_key: "unknown",
    climate: { key: "unavailable", params: {} },
    phenology: { key: "unavailable", params: {} },
    why: [],
    home: { key: "unavailable", params: {} },
    months: [],
    facts: null,
  };
  if (!input || !isTwelve(input.temperature_c_monthly)) return empty;

  const temps = input.temperature_c_monthly;
  const precip = isTwelve(input.precipitation_mm_monthly) ? input.precipitation_mm_monthly : null;
  const code = input.koppen_code ? String(input.koppen_code) : null;
  const family = koppenFamily(code);

  let coldestMonth = 0;
  let warmestMonth = 0;
  for (let i = 1; i < 12; i += 1) {
    if (temps[i] < temps[coldestMonth]) coldestMonth = i;
    if (temps[i] > temps[warmestMonth]) warmestMonth = i;
  }

  let wettestMonth: number | null = null;
  let driestMonth: number | null = null;
  let meanPrecip = 0;
  if (precip) {
    wettestMonth = 0;
    driestMonth = 0;
    let sum = 0;
    for (let i = 0; i < 12; i += 1) {
      sum += precip[i];
      if (precip[i] > precip[wettestMonth]) wettestMonth = i;
      if (precip[i] < precip[driestMonth]) driestMonth = i;
    }
    meanPrecip = sum / 12;
  }

  const wetRatio =
    precip && driestMonth != null && precip[driestMonth] > 0
      ? precip[wettestMonth as number] / precip[driestMonth]
      : precip && driestMonth != null && precip[wettestMonth as number] > 0
        ? Infinity
        : null;

  const months: MonthMark[] = temps.map((temp, i) => {
    let wet: MonthWet = "typical";
    if (precip && meanPrecip > 0) {
      if (precip[i] < meanPrecip * 0.5) wet = "dry";
      else if (precip[i] > meanPrecip * 1.5) wet = "wet";
    }
    return {
      month: i,
      temp_c: temp,
      precip_mm: precip ? precip[i] : null,
      band: bandOf(temp),
      wet,
    };
  });

  const facts = {
    coldest_month: coldestMonth,
    coldest_c: temps[coldestMonth],
    warmest_month: warmestMonth,
    warmest_c: temps[warmestMonth],
    wettest_month: wettestMonth,
    wettest_mm: wettestMonth != null && precip ? precip[wettestMonth] : null,
    driest_month: driestMonth,
    driest_mm: driestMonth != null && precip ? precip[driestMonth] : null,
    months_below_0: temps.filter((t) => t < 0).length,
    months_below_5: temps.filter((t) => t < 5).length,
    months_at_or_above_22: temps.filter((t) => t >= 22).length,
  };

  const baseParams = {
    temp: oneDecimal(facts.coldest_c),
    hot: oneDecimal(facts.warmest_c),
    coldestMonth,
    warmestMonth,
    rain: facts.wettest_mm == null ? "" : rainText(facts.wettest_mm),
    wettestMonth: facts.wettest_month == null ? 0 : facts.wettest_month,
    dryRain: facts.driest_mm == null ? "" : rainText(facts.driest_mm),
    driestMonth: facts.driest_month == null ? 0 : facts.driest_month,
    code: code || "",
  };

  const why: CopyRef[] = [
    { key: "coldest", params: { ...baseParams } },
  ];
  if (precip && facts.wettest_month != null) {
    why.push({ key: "rain", params: { ...baseParams } });
  }

  const pheno = phenologyKey(family, temps, wetRatio == null || !Number.isFinite(wetRatio) ? null : wetRatio);

  return {
    status: "ok",
    koppen_code: code,
    family,
    phenology_key: pheno,
    climate: { key: family, params: { ...baseParams } },
    phenology: { key: pheno, params: { ...baseParams } },
    why,
    home: { key: homeKey(temps), params: { ...baseParams } },
    months,
    facts,
  };
}

/** 把课文化成可渲染字符串。月份名由调用方按语言传入。 */
export function fillNatureCopy(
  template: string,
  params: Record<string, string | number>,
  monthNames: string[],
): string {
  return String(template).replace(/\{(\w+)\}/g, (_m, name: string) => {
    if (
      name === "coldestMonth" ||
      name === "warmestMonth" ||
      name === "wettestMonth" ||
      name === "driestMonth"
    ) {
      const idx = Number(params[name]);
      return Number.isInteger(idx) && monthNames[idx] ? monthNames[idx] : "";
    }
    const value = params[name];
    return value == null ? "" : String(value);
  });
}
