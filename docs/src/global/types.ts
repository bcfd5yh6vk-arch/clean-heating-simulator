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

export interface RankedPath extends CandidatePath {
  fitness: number;
  dimensions: {
    cost: number;
    carbon: number;
    comfort: number;
    climate: number;
    simple: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
