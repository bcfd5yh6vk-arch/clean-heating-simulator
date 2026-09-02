export type Locale = "en" | "zh";
export type Confidence = "high" | "medium" | "low";

export type HousingStatus =
  | "owner"
  | "renter_permission"
  | "renter_no_permission"
  | "renter_not_sure"
  | "other";

export type BuildingType =
  | "detached"
  | "semi_detached_or_row"
  | "apartment"
  | "mobile_or_temporary"
  | "other"
  | "not_sure";

export type RenovationTolerance = "none" | "minor" | "moderate" | "major" | "not_sure";
export type InstallationLevel = "none" | "minor" | "moderate" | "major";

export type OutdoorSpace =
  | "none"
  | "wall_or_balcony"
  | "small_yard_or_roof"
  | "large_private_land"
  | "not_sure";

export type OutdoorSpaceLevel =
  | "none"
  | "wall_or_balcony"
  | "small_yard_or_roof"
  | "large_private_land";

export type CurrentEnergyService =
  | "electricity"
  | "piped_gas"
  | "delivered_fuel"
  | "solid_fuel"
  | "district_energy"
  | "none"
  | "not_sure";

export type CurrentHeatingMethod =
  | "heat_pump"
  | "electric_heating"
  | "piped_gas_heating"
  | "delivered_fuel_heating"
  | "solid_fuel_heating"
  | "district_or_shared_heating"
  | "passive_or_solar_heating"
  | "no_current_heating"
  | "not_sure";

export type CurrentCoolingMethod =
  | "room_air_conditioning"
  | "central_air_conditioning"
  | "heat_pump_cooling"
  | "evaporative_or_water_cooling"
  | "fans"
  | "natural_or_passive_cooling"
  | "district_or_shared_cooling"
  | "no_current_cooling"
  | "not_sure";

export type UpfrontCostPreference =
  | "minimum_upfront"
  | "moderate_investment"
  | "higher_if_saves_later"
  | "not_sure";

export interface HomeFeasibilityProfile {
  housing_status: HousingStatus;
  building_type: BuildingType;
  renovation_tolerance: RenovationTolerance;
  outdoor_space: OutdoorSpace;
  current_energy_services: CurrentEnergyService[];
  current_heating_methods: CurrentHeatingMethod[];
  current_cooling_methods: CurrentCoolingMethod[];
  upfront_cost_preference: UpfrontCostPreference;
  /**
   * G3 追问（CS-DECISIONS D15，规格 §3.3 缺口）：current_heating_methods 含
   * delivered_fuel_heating 时问「哪种配送燃料」。缺席或 not_sure 时，
   * 账单反推按原行为不猜（载体 null → §7.11）。
   */
  delivered_fuel_kind?: "lpg" | "heating_oil" | "not_sure";
}

export interface HouseholdProfile {
  household_size: number;
  currency: string;
  annual_income: number;
  floor_area_m2: number;
  building_age?: string;
  insulation_level?: "Poor" | "Average" | "Good";
  needs_heating: boolean;
  heating_spend_annual?: number;
  needs_cooling: boolean;
  cooling_spend_annual?: number;
}

export interface RegionProfile {
  region_id: string;
  label_en: string;
  label_zh?: string;
  infrastructure: {
    gas_grid?: boolean;
    gas_grid_confidence?: Confidence;
    district_energy?: boolean;
    district_energy_confidence?: Confidence;
    delivered_fuel_market?: boolean;
    delivered_fuel_market_confidence?: Confidence;
    reliable_electricity?: boolean;
    reliable_electricity_confidence?: Confidence;
  };
}

export interface ClimateProfile {
  design_temp_c?: number;
  design_temp_confidence?: Confidence;
  humidity_level?: "dry" | "mixed" | "humid";
  humidity_confidence?: Confidence;

  /**
   * 12 个月的月平均气温（℃），index 0 = 1 月。§7.5.1/§7.5.2 的 HDD18 / CDD24 由它推出。
   * 缺失时 climate 维只能走 seasonal 分支，且 wH/wC 无法用 degree-day fallback。
   */
  temperature_c_monthly?: number[];

  /** 极端低温 proxy（℃），如长期日最低 P01。§7.7.3。不是 ASHRAE design temperature。 */
  extreme_low_temp_proxy_c?: number;
  /** 极端高温 proxy（℃），如长期日最高 P99。§7.7.3。 */
  extreme_high_temp_proxy_c?: number;
  extreme_proxy_confidence?: Confidence;

  /** 数据来源标记，供 UI 的 "Data resolution" 标签使用（§G1）。 */
  source_kind?: "admin1_capital" | "koppen_profile";
  koppen_code?: string;

  /**
   * 月降水（mm），index 0 = 1 月。仅供 §G1 气候卡的柱状图使用，
   * 不参与 §7 的任何打分公式。
   */
  precipitation_mm_monthly?: number[];
}

/* ---------------------------------------------------------------------------
 * §G1 地图选点的结果
 * ------------------------------------------------------------------------- */

/**
 * §G1 Step 3 的 "Data source" 标签。
 *
 * 这个值描述的是**实际取到了哪一层气候数据**，不是「地图识别到了哪一层」。
 * 两者必须分开：地图能识别出「河北省」，不等于仓库里存在河北的气候数据。
 * 因此它只能由 describeDataResolution() 依据真实的 ClimateProfile 计算，
 * 不允许由 GeoResolution 自行声明 —— 否则数据文件还是空的时候，
 * 页面会声称「已使用省会气候」。
 */
export type DataResolution =
  | "admin1_capital"
  | "koppen_standard_profile"
  | "koppen_main_group_fallback"
  | "unresolved";

/** 地图点击后识别出的地理信息。纯识别结果，不含任何气候数值。 */
export interface GeoResolution {
  lat: number;
  lon: number;

  country_iso3: string | null;
  country_name_en: string | null;
  country_name_zh: string | null;

  /** 仅中国、美国；其余国家恒为 null（规格 §G1 明令不识别省/州）。 */
  admin1_code: string | null;
  admin1_name_en: string | null;
  admin1_name_zh: string | null;

  /** Köppen 细分类，如 "Dwa"。海洋或栅格无数据时为 null。 */
  koppen_code: string | null;
  /** Köppen 主类 A/B/C/D/E，供细分类查不到 profile 时回退。 */
  koppen_main_group: string | null;

  /** 该点被多于一个 admin0 要素覆盖（争议地区）。UI 应当如实告知，不要静默取第一个。 */
  ambiguous_country: boolean;
  /** 全部命中的国家码，按边界文件顺序。ambiguous_country 为 false 时长度 ≤ 1。 */
  country_candidates: string[];
}

export type ServiceType =
  | "heating"
  | "cooling"
  | "heating_and_cooling"
  | "supporting_measure";

export interface TechnologyScreeningMeta {
  tech_id: string;
  services: ServiceType[];
  installation_level: InstallationLevel;
  outdoor_space_required: OutdoorSpaceLevel;
  permanent_modification_required: boolean;
  supported_building_types?: BuildingType[];
  infrastructure_constraints?: {
    requires_gas_grid?: boolean;
    requires_district_network?: boolean;
    requires_delivered_fuel_market?: boolean;
    requires_reliable_electricity?: boolean;
  };
  climate_constraints?: {
    min_design_temp_c?: number;
    requires_dry_climate?: boolean;
    humidity_sensitive?: boolean;
  };
  can_reuse_baseline_categories?: string[];
  replaces_baseline_categories?: string[];
  backup_option_supported?: boolean;
  fallback_possible?: boolean;
  data_confidence: Confidence;
}

export interface TechnologyProfile extends TechnologyScreeningMeta {
  display_name_en: string;
  display_name_zh: string;
  role?: "primary" | "supporting" | "baseline";
  catalog_status?: "active" | "conditional" | "baseline_only" | "phase2";
  ranking_mode?: "standalone" | "bundle_only" | "baseline_only" | "phase2";
  capex_level?: "low" | "medium" | "high";
  comfort_tier?: 1 | 2 | 3 | 4 | 5;
  simplicity_tier?: 1 | 2 | 3 | 4 | 5;
}

export interface ScreeningWarning {
  tech_id: string;
  code: string;
  message_en: string;
  message_zh: string;
  source: "user_answer" | "region_data" | "climate_data";
}

export interface ScreenedTechnology {
  tech_id: string;
  screening_status: "eligible" | "eligible_with_warning";
  warnings: string[];
  confidence: Confidence;
}

export interface ExcludedTechnology {
  tech_id: string;
  reason_code: string;
  reason_en: string;
  reason_zh: string;
  evidence_source: "user_answer" | "region_data" | "climate_data";
}

export interface ScreeningResult {
  passed: ScreenedTechnology[];
  excluded: ExcludedTechnology[];
  warnings: ScreeningWarning[];
}

export interface BaselineProfile {
  heating_categories: string[];
  cooling_categories: string[];
  heating_data_confidence: Confidence;
  cooling_data_confidence: Confidence;
  has_mechanical_heating: boolean;
  has_mechanical_cooling: boolean;
  current_energy_sources: string[];
}

export interface CandidatePath {
  path_id: string;
  primary_tech_ids: string[];
  supporting_measure_ids: string[];
  services: ("heating" | "cooling")[];
  baseline_transition?: {
    from_categories: string[];
    reuse_existing_infrastructure: boolean;
    replacement_complexity: "low" | "medium" | "high" | "unknown";
  };
  screening_warnings: string[];
  screening_confidence: Confidence;
}

/* ------------------------------------------------------------------------- *
 * §7.10 Canonical RankedPath contract
 *
 * 这是 G4 表格、G6 摘要卡与 G5 AI context 三方共用的 shared contract。
 * 旧的五维 { cost, carbon, comfort, climate, simple } 已按 spec §7.10 废弃，
 * 不得再实现。
 * ------------------------------------------------------------------------- */

export type PathScoreStatus =
  /** 完整或 preliminary Fitness，进排序表 */
  | "ranked"
  /** Fitness 可给，但 score_coverage < 1 */
  | "preliminary"
  /** 达不到 §7.10 最低要求；注意它不是 excluded */
  | "insufficient_data";

export interface ScoringWarning {
  code: string;
  message_en: string;
  message_zh: string;
  source: "user_answer" | "region_data" | "climate_data" | "scoring_data";
}

export interface DataNote {
  field_key: string;
  note_en: string;
  note_zh: string;
}

export interface AffordabilityDetail {
  annual_run_cost?: number | null;
  operating_burden_pct?: number | null;
  operating_burden_score?: number | null;
  installed_cost?: number | null;
  upfront_ratio?: number | null;
  upfront_score?: number | null;
  complete: boolean;
}

export interface ClimateResilienceDetail {
  hdd18?: number | null;
  cdd24?: number | null;
  heating_weight?: number | null;
  cooling_weight?: number | null;
  seasonal_heating_score?: number | null;
  seasonal_cooling_score?: number | null;
  extreme_heating_score?: number | null;
  extreme_cooling_score?: number | null;
  complete: boolean;
}

export interface EnvironmentDetail {
  path_emissions_kgco2e?: number | null;
  reference_emissions_kgco2e?: number | null;
  reduction_pct?: number | null;
  reference_type?: "household_baseline" | "regional_equivalent_service";
  complete: boolean;
}

export interface PracticalityDetail {
  renovation_score?: number | null;
  outdoor_space_score?: number | null;
  infrastructure_score?: number | null;
  permission_score?: number | null;
  complete: boolean;
}

export interface RankedPath extends CandidatePath {
  display_name_en: string;
  display_name_zh: string;

  /** null when status === "insufficient_data" */
  rank: number | null;

  status: PathScoreStatus;

  /** null when status === "insufficient_data"；缺数据一律 null，绝不给 50 */
  fitness: number | null;

  dimensions: {
    affordability: number | null;
    climate_resilience: number | null;
    environment: number | null;
    practicality: number | null;
  };

  dimension_details: {
    affordability: AffordabilityDetail;
    climate_resilience: ClimateResilienceDetail;
    environment: EnvironmentDetail;
    practicality: PracticalityDetail;
  };

  /** ALWAYS 0–1 internally. UI may show percent. */
  score_coverage: number;

  estimates: {
    currency?: string;
    upfront_cost?: number | null;
    annual_run_cost?: number | null;
    operating_burden_pct?: number | null;
    annual_emissions_kgco2e?: number | null;
  };

  warnings: ScoringWarning[];
  data_notes?: DataNote[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
