import type { ClimateProfile, DataResolution, GeoResolution } from "../types";
import { findFeaturesAt, type BoundaryIndex } from "./boundaryIndex";
import { koppenCodeAt, mainGroupOf, type KoppenLegend, type PixelReader } from "./koppenGrid";

/* ---------------------------------------------------------------------------
 * §G1 Step 3 —— 点击地图后如何确定用户的地理与气候区
 *
 *   click(lat, lon)
 *     → spatial join Admin-0 → country_iso3
 *     if country_iso3 in {CHN, USA}:
 *         spatial join Admin-1 (仅中美) → admin1_code
 *     else:
 *         admin1_code = null
 *         query Köppen at (lat, lon) → koppen_code
 *
 * 与规格的一处实现差异：规格把 data_resolution 也写在这一步里，但它取决于
 * climate_profiles 里到底有没有对应记录 —— 那是气候**数据**的事，不是地理识别的事。
 * 这里只做识别，data_resolution 由 describeDataResolution() 依据真实取到的
 * ClimateProfile 计算。这样「数据文件是空的却声称用了省会气候」在结构上就不可能发生。
 * ------------------------------------------------------------------------- */

/** admin0-boundaries.geojson 的要素属性 */
export interface Admin0Properties {
  iso3: string;
  name_en?: string;
  name_zh?: string;
  type?: string;
  sov_a3?: string;
}

/** admin1-cn-us.geojson 的要素属性 */
export interface Admin1Properties {
  country_iso3: string;
  admin1_code: string;
  iso_3166_2?: string;
  name_en?: string;
  name_zh?: string;
  type_en?: string;
}

/** 国家显示名覆盖（country-label-overrides.json）。产品负责人维护，默认为空。 */
export interface CountryLabelOverrides {
  overrides?: Record<string, { name_en?: string; name_zh?: string }>;
}

export interface ResolveContext {
  admin0: BoundaryIndex<Admin0Properties>;
  /** 中美省/州界。规格 §G1 允许惰性加载 —— 未加载时为 null，此时 admin1 一律为 null。 */
  admin1: BoundaryIndex<Admin1Properties> | null;
  koppenLegend: KoppenLegend | null;
  readKoppenPixel: PixelReader | null;
  labelOverrides?: CountryLabelOverrides | null;
}

/** 规格 §G1：只有这两个国家识别到 Admin-1。 */
export const ADMIN1_COUNTRIES = ["CHN", "USA"] as const;

export function isAdmin1Country(iso3: string | null | undefined): boolean {
  return iso3 === "CHN" || iso3 === "USA";
}

export function resolveLocation(lat: number, lon: number, ctx: ResolveContext): GeoResolution {
  const empty: GeoResolution = {
    lat,
    lon,
    country_iso3: null,
    country_name_en: null,
    country_name_zh: null,
    admin1_code: null,
    admin1_name_en: null,
    admin1_name_zh: null,
    koppen_code: null,
    koppen_main_group: null,
    ambiguous_country: false,
    country_candidates: [],
  };

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return empty;
  if (lat > 90 || lat < -90) return empty;

  // 经度归一到 [-180, 180)，让 181° 与 -179° 等价（地图连续平移会跑出这个范围）
  let normLon = ((lon + 180) % 360 + 360) % 360 - 180;
  const result: GeoResolution = { ...empty, lat, lon: normLon };

  const countries = findFeaturesAt(ctx.admin0, normLon, lat);
  result.country_candidates = countries.map((c) => c.iso3).filter(Boolean);
  result.ambiguous_country = result.country_candidates.length > 1;

  if (countries.length > 0) {
    const country = countries[0];
    result.country_iso3 = country.iso3 ?? null;
    const override = ctx.labelOverrides?.overrides?.[country.iso3];
    result.country_name_en = override?.name_en ?? country.name_en ?? null;
    result.country_name_zh = override?.name_zh ?? country.name_zh ?? null;
  }

  if (isAdmin1Country(result.country_iso3) && ctx.admin1) {
    const admin1s = findFeaturesAt(ctx.admin1, normLon, lat).filter(
      (a) => a.country_iso3 === result.country_iso3,
    );
    if (admin1s.length > 0) {
      const a = admin1s[0];
      result.admin1_code = a.admin1_code ?? null;
      result.admin1_name_en = a.name_en ?? null;
      result.admin1_name_zh = a.name_zh ?? null;
    }
  }

  // Köppen 码对中美也一并查出：中美走省会气候，但气候区名称在卡片上仍要显示，
  // 而且省会数据缺失时它是唯一还能说明「这是什么气候」的信息。
  if (ctx.koppenLegend && ctx.readKoppenPixel) {
    result.koppen_code = koppenCodeAt(normLon, lat, ctx.koppenLegend, ctx.readKoppenPixel);
    result.koppen_main_group = mainGroupOf(result.koppen_code);
  }

  return result;
}

/**
 * 依据**实际取到的** ClimateProfile 判定 §G1 的 "Data source" 标签。
 *
 * climate 为 null（数据文件还是空骨架）时返回 "unresolved" —— 页面必须显示
 * 「暂无该地气候数据」，不能显示任何曲线，更不能声称用了省会气候。
 */
export function describeDataResolution(
  geo: GeoResolution | null | undefined,
  climate: ClimateProfile | null | undefined,
): DataResolution {
  if (!climate) return "unresolved";
  if (climate.source_kind === "admin1_capital") return "admin1_capital";
  if (climate.source_kind === "koppen_profile") {
    // resolveClimate 返回的是**命中**的那条 profile 的码。它与点击点的细分类
    // 不一致，说明是按主类回退匹配到的。
    if (geo?.koppen_code && climate.koppen_code && climate.koppen_code !== geo.koppen_code) {
      return "koppen_main_group_fallback";
    }
    return "koppen_standard_profile";
  }
  return "unresolved";
}

/** 该结果是否足以进入 G2。国家识别不出来（点在海上）就不能继续。 */
export function isUsableLocation(geo: GeoResolution | null | undefined): boolean {
  return !!geo && typeof geo.country_iso3 === "string" && geo.country_iso3.length > 0;
}

/** 传给 pipeline.js runScoring 的 geo 载荷。字段名与 resolveClimate 的期望一致。 */
export function toScoringGeo(geo: GeoResolution): {
  country_iso3?: string;
  admin1_code?: string;
  koppen_code?: string;
} {
  const out: { country_iso3?: string; admin1_code?: string; koppen_code?: string } = {};
  if (geo.country_iso3) out.country_iso3 = geo.country_iso3;
  if (geo.admin1_code) out.admin1_code = geo.admin1_code;
  if (geo.koppen_code) out.koppen_code = geo.koppen_code;
  return out;
}
