import type { Confidence } from "../global/types";

/* ---------------------------------------------------------------------------
 * §7.4 G4 scoring data provenance
 *
 * 任何会进入 G4 数值计算、最终影响 Fitness 的变量，只允许四种来源。
 * 把它做成类型：一个没有 geography / source 的裸数字无法构造成 ScoringDataPoint，
 * 因此也就进不了 §7.6–§7.10 的公式。
 *
 * 规格禁止：developer guessed score · AI-estimated data · global average for
 * missing local · subjective tier → score · neighbouring-country substitute ·
 * “未知给 50”。
 * ------------------------------------------------------------------------- */

export type SourceType = "USER" | "LOCAL_PUBLIC" | "DERIVED" | "TECH_OBJECTIVE_RULE";

/** 地理精度，由细到粗。§7.4 fallback：network/local → admin1 → country → NULL */
export type GeographyLevel = "network" | "local" | "admin1" | "country";

export const GEOGRAPHY_PRECEDENCE: GeographyLevel[] = ["network", "local", "admin1", "country"];

export interface Geography {
  level: GeographyLevel;
  /** admin1 用省/州代码，country 用 ISO3，network/local 用网络或城市标识 */
  code: string;
  /**
   * 该条目所属国家（ISO3）。admin1/local/network 级条目必须带：
   * 中国省份的 ISO 3166-2 后缀与美国州码有四对重码（NM 内蒙古/新墨西哥、
   * SD 山东/南达科他、SC 四川/南卡罗来纳、HI 海南/夏威夷），只按 code 匹配时
   * 数组顺序决定谁赢——两个地区里必有一个永远拿到对方的数据，不报错、只算错。
   * country 级条目的 code 本身就是 ISO3，不需要重复。
   * scoring-geography.test.js 对生产数据文件强制此字段。
   */
  country_iso3?: string;
}

export interface ScoringDataPoint<T = number> {
  value: T;
  /** 产品类性能建议给 P25 / P50 / P75，禁止手挑“典型机型” */
  low?: T;
  mid?: T;
  high?: T;
  geography: Geography;
  source_type: SourceType;
  source_name: string;
  source_url?: string;
  /** ISO date，标明数据抓取/发布时点 */
  retrieved_at?: string;
  confidence: Confidence;
  sample_count?: number;
  aggregation_method?: string;

  /**
   * 该数值的计价货币（ISO 4217，如 "USD" / "EUR" / "CNY"）。仅对货币量纲的数据集有意义
   * （价格、装机成本），排放因子等无量纲/物理量纲的数据集不填。
   *
   * 为什么必须显式带着：能源价格来自多个国家的官方口径，美国 EIA 给 USD、
   * 欧盟 Eurostat 给 EUR、中国给 CNY。不标货币的话，同一个 entries 数组里
   * 三种货币的数字长得一模一样，地理回退挑出哪条就按哪条算，而 §7.6.2 的
   * OperatingBurdenPct = AnnualRunCost / AnnualIncome 会把它直接除进结果里 ——
   * 不报错、不警告，只是每个 Affordability 分数都错。
   *
   * 注意：带上货币**不等于**解决了规格 §7.6.2 与 §8 之间那个币种不闭环的问题
   * （用户可从 150+ 种货币里任选收入，而 fx_rate 被标为 display-only）。
   * 那仍然是需要产品负责人裁定的事，见 docs/HANDOFF.md §3.2 第 1 条。
   * 这里只是让「这个数字是什么货币」不再是靠猜的。
   */
  currency?: string;
}

/**
 * 一份 LOCAL_PUBLIC 数据集。`entries` 按 subject 分组：
 *   - 能源价格 → subject = 燃料键（electricity / natural_gas / lpg / heating_oil …）
 *   - 技术性能、装机成本 → subject = tech_id
 *   - 排放因子 → subject = grid / 燃料键
 */
export interface ScoringDataset<T = number> {
  field_key: string;
  unit?: string;
  /** 给产品负责人看的说明：这份数据必须来自哪里、禁止用什么替代 */
  provenance_note?: string;
  entries: Record<string, ScoringDataPoint<T>[]>;
}

export interface GeoQuery {
  country_iso3?: string;
  admin1_code?: string;
  local_code?: string;
  network_code?: string;
}

function codeForLevel(query: GeoQuery, level: GeographyLevel): string | undefined {
  switch (level) {
    case "network":
      return query.network_code;
    case "local":
      return query.local_code;
    case "admin1":
      return query.admin1_code;
    case "country":
      return query.country_iso3;
    default:
      return undefined;
  }
}

/**
 * §7.4 地理 fallback：network/local → admin1 → country → NULL。
 *
 * **返回 null 是合法且常见的结果**，调用方必须走 §7.11 的 missing 分支，
 * 不得用全球均值、邻国数据或任何“合理默认值”填补。
 */
export function resolveScoringValue<T>(
  dataset: ScoringDataset<T> | null | undefined,
  subject: string,
  query: GeoQuery,
): ScoringDataPoint<T> | null {
  if (!dataset) return null;
  const candidates = dataset.entries?.[subject];
  if (!candidates || candidates.length === 0) return null;

  for (const level of GEOGRAPHY_PRECEDENCE) {
    const code = codeForLevel(query, level);
    if (!code) continue;
    const hit = candidates.find((entry) => {
      if (entry.geography.level !== level) return false;
      if (entry.geography.code.toUpperCase() !== code.toUpperCase()) return false;
      const entryCountry = entry.geography.country_iso3;
      if (entryCountry) {
        // 带国家标注的条目只发给同一国家的查询；查询缺国家时宁缺毋错。
        if (!query.country_iso3) return false;
        return entryCountry.toUpperCase() === query.country_iso3.toUpperCase();
      }
      // 无国家标注的旧条目维持原行为（合成测试夹具依赖此分支；
      // 生产数据文件由 scoring-geography.test.js 强制补齐国家标注）。
      return true;
    });
    if (hit) return hit;
  }
  return null;
}

/** 便捷取值：拿不到就是 null，绝不兜底成数字 */
export function valueOf<T>(point: ScoringDataPoint<T> | null | undefined): T | null {
  return point ? point.value : null;
}

/** 供 UI 的 “Data & methods” 用；G4 主表不展示 source URL（§7.12） */
export function describeSource<T>(point: ScoringDataPoint<T> | null | undefined): string | null {
  if (!point) return null;
  const parts = [point.source_name, point.geography.level, point.retrieved_at];
  return parts.filter(Boolean).join(" · ");
}
