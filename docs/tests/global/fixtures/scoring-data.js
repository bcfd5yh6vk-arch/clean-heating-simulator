/**
 * ============================================================================
 *  合成测试夹具 —— 不是真实数据，禁止用于生产
 * ============================================================================
 *
 * 规格 §7.4 禁止用 developer guessed 数值参与真实打分。本文件存在的唯一目的，
 * 是让打分引擎的**公式与数据流**可以被确定性地测试：
 *
 *   - 没有数据时，引擎必须返回 insufficient_data（用 emptyBundle 测）
 *   - 有数据时，同一输入必须给出逐字节相同的结果（用 fixtureBundle 测）
 *
 * 每一条 ScoringDataPoint 的 source_name 都写死为 SYNTHETIC，
 * 一旦有人误接到生产代码，来源字段会立刻自证它不是真数据。
 *
 * 真实数据由产品负责人按 §7.12 提供，落到 docs/data/scoring/*.json。
 */

const SYNTHETIC = "SYNTHETIC TEST FIXTURE — not real data";

function point(value, level, code, extra) {
  return Object.assign(
    {
      value,
      geography: { level, code },
      source_type: "LOCAL_PUBLIC",
      source_name: SYNTHETIC,
      confidence: "medium",
    },
    extra || {},
  );
}

/** 测试用地理查询：美国伊利诺伊 */
const GEO = { country_iso3: "USA", admin1_code: "IL" };

/** 能源价格：单位价格（货币/能源单位）。数值是编的，只为让公式可跑。 */
const residential_energy_prices = {
  field_key: "residential_energy_prices",
  unit: "currency per energy unit",
  provenance_note: SYNTHETIC,
  entries: {
    electricity: [point(0.16, "admin1", "IL"), point(0.15, "country", "USA")],
    natural_gas: [point(0.05, "admin1", "IL"), point(0.055, "country", "USA")],
    heating_oil: [point(0.11, "country", "USA")],
    lpg: [point(0.13, "country", "USA")],
    solid_fuel: [point(0.04, "country", "USA")],
    district_heating: [point(0.07, "country", "USA")],
    district_cooling: [point(0.08, "country", "USA")],
    biomass: [point(0.06, "country", "USA")],
  },
};

/** 季节效率与运行温度区间。键格式：`${tech_id}|${metric}` */
const PERF_ROWS = [
  // 供暖季节效率（热泵为 SCOP，燃烧类为 <1 的季节效率）
  ["ashp_ductless|seasonal_heating_efficiency", 2.9],
  ["ashp_ducted|seasonal_heating_efficiency", 2.7],
  ["ashp_air_to_water|seasonal_heating_efficiency", 2.8],
  ["gshp|seasonal_heating_efficiency", 3.8],
  ["gas_boiler|seasonal_heating_efficiency", 0.9],
  ["gas_furnace|seasonal_heating_efficiency", 0.92],
  ["electric_boiler|seasonal_heating_efficiency", 0.99],
  ["electric_resistance|seasonal_heating_efficiency", 1.0],
  ["district_heating|seasonal_heating_efficiency", 0.95],
  ["oil_heating|seasonal_heating_efficiency", 0.85],
  ["lpg_propane_heating|seasonal_heating_efficiency", 0.88],
  ["biomass_pellet|seasonal_heating_efficiency", 0.78],
  ["wood_stove|seasonal_heating_efficiency", 0.65],
  ["hybrid_hp_boiler|seasonal_heating_efficiency", 2.2],

  // 制冷季节效率
  ["ashp_ductless|seasonal_cooling_efficiency", 4.2],
  ["ashp_ducted|seasonal_cooling_efficiency", 3.8],
  ["gshp|seasonal_cooling_efficiency", 4.6],
  ["window_ac|seasonal_cooling_efficiency", 2.9],
  ["portable_ac|seasonal_cooling_efficiency", 2.3],
  ["split_ac_cooling|seasonal_cooling_efficiency", 4.0],
  ["central_ac|seasonal_cooling_efficiency", 3.6],
  ["district_cooling|seasonal_cooling_efficiency", 4.0],

  // 公开运行温度区间
  ["ashp_ductless|minimum_operating_temp_c", -22],
  ["ashp_ducted|minimum_operating_temp_c", -18],
  ["gshp|minimum_operating_temp_c", -40],
  ["gas_boiler|minimum_operating_temp_c", -40],
  ["ashp_ductless|maximum_operating_temp_c", 46],
  ["split_ac_cooling|maximum_operating_temp_c", 46],
  ["window_ac|maximum_operating_temp_c", 43],
  ["central_ac|maximum_operating_temp_c", 45],

  // 当前设备基线效率（§7.5.3 账单反推用）
  ["baseline:electricity|seasonal_cooling_efficiency", 3.0],
  ["baseline:electricity|seasonal_heating_efficiency", 1.0],
  ["baseline:natural_gas|seasonal_heating_efficiency", 0.8],
  ["baseline:heating_oil|seasonal_heating_efficiency", 0.8],
  ["baseline:solid_fuel|seasonal_heating_efficiency", 0.45],
  ["baseline:district_heating|seasonal_heating_efficiency", 0.9],
];

const technology_performance = {
  field_key: "technology_performance",
  provenance_note: SYNTHETIC,
  entries: PERF_ROWS.reduce((acc, [key, value]) => {
    acc[key] = [point(value, "country", "USA", { confidence: "high" })];
    return acc;
  }, {}),
};

const INSTALLED_ROWS = [
  ["ashp_ductless", 6500],
  ["ashp_ducted", 12000],
  ["ashp_air_to_water", 14000],
  ["gshp", 26000],
  ["gas_boiler", 5200],
  ["gas_furnace", 4800],
  ["electric_boiler", 3600],
  ["electric_resistance", 1200],
  ["district_heating", 3000],
  ["window_ac", 400],
  ["portable_ac", 300],
  ["split_ac_cooling", 2600],
  ["central_ac", 7800],
];

const technology_installed_costs = {
  field_key: "technology_installed_costs",
  unit: "currency",
  provenance_note: SYNTHETIC,
  entries: INSTALLED_ROWS.reduce((acc, [key, value]) => {
    acc[key] = [point(value, "country", "USA")];
    return acc;
  }, {}),
};

const electricity_emission_factors = {
  field_key: "electricity_emission_factors",
  unit: "kgCO2e per kWh",
  provenance_note: SYNTHETIC,
  entries: { grid: [point(0.37, "admin1", "IL"), point(0.39, "country", "USA")] },
};

const fuel_emission_factors = {
  field_key: "fuel_emission_factors",
  unit: "kgCO2e per energy unit",
  provenance_note: SYNTHETIC,
  entries: {
    natural_gas: [point(0.18, "country", "USA")],
    heating_oil: [point(0.27, "country", "USA")],
    lpg: [point(0.23, "country", "USA")],
    solid_fuel: [point(0.34, "country", "USA")],
    district_heating: [point(0.2, "country", "USA")],
    district_cooling: [point(0.15, "country", "USA")],
  },
};

const infrastructure_availability = {
  field_key: "infrastructure_availability",
  provenance_note: SYNTHETIC,
  entries: {
    electricity: [point(true, "admin1", "IL")],
    piped_gas: [point(true, "admin1", "IL")],
    delivered_fuel: [point(true, "country", "USA")],
    district_heating_network: [point(false, "admin1", "IL")],
    district_cooling_network: [point(false, "admin1", "IL")],
    solid_fuel_supply: [point(true, "country", "USA")],
  },
};

/** 完整夹具：足以让四维都算出来 */
const fixtureBundle = {
  residential_energy_prices,
  technology_performance,
  technology_installed_costs,
  electricity_emission_factors,
  fuel_emission_factors,
  infrastructure_availability,
};

/** 空夹具：模拟当前仓库真实状态（9 个数据文件一个都不存在） */
const emptyBundle = {};

/** 伊利诺伊风格的月均温（合成），用于 HDD/CDD */
const climateWithMonthly = {
  temperature_c_monthly: [-4, -2, 4, 11, 17, 23, 25, 24, 20, 13, 5, -2],
  extreme_low_temp_proxy_c: -18,
  extreme_high_temp_proxy_c: 35,
  extreme_proxy_confidence: "high",
  design_temp_c: -18,
  design_temp_confidence: "high",
  humidity_level: "mixed",
  humidity_confidence: "medium",
  source_kind: "admin1_capital",
};

module.exports = {
  SYNTHETIC,
  GEO,
  fixtureBundle,
  emptyBundle,
  climateWithMonthly,
};
