export type TechnologyRole = "primary" | "supporting" | "baseline";
export type EnergyService = "heating" | "cooling" | "heating_and_cooling";
export type CatalogStatus = "active" | "conditional" | "baseline_only" | "phase2";
export type RankingMode = "standalone" | "bundle_only" | "baseline_only" | "phase2";
export type InstallationLevel = "none" | "minor" | "moderate" | "major";
export type OutdoorSpaceLevel = "none" | "wall_or_balcony" | "small_yard_or_roof" | "large_private_land";

export type InfrastructureRequirement =
  | "electricity"
  | "piped_gas"
  | "delivered_fuel"
  | "solid_fuel_supply"
  | "district_heating_network"
  | "district_cooling_network"
  | "water_supply"
  | "ground_access"
  | "usable_heat_source";

export type ClimateRule =
  | "general"
  | "cold_performance_check"
  | "dry_climate_required"
  | "dry_climate_preferred"
  | "humidity_control_helpful"
  | "air_quality_check"
  | "diurnal_temperature_check"
  | "solar_resource_check"
  | "dew_point_control_required";

export type CapexTier = 1 | 2 | 3 | 4 | 5;
export type ComfortTier = 1 | 2 | 3 | 4 | 5;
export type SimplicityTier = 1 | 2 | 3 | 4 | 5;

export type OperatingCostModel =
  | "heat_pump_cop"
  | "grid_resistance"
  | "grid_cooling_efficiency"
  | "gas_fuel"
  | "delivered_liquid_fuel"
  | "solid_fuel"
  | "district_tariff"
  | "hybrid_dispatch"
  | "low_energy_support"
  | "passive_zero_direct_energy"
  | "local_quote";

export type CarbonModel =
  | "grid_electricity"
  | "gas_combustion"
  | "liquid_fuel_combustion"
  | "solid_fuel_combustion"
  | "biomass_context_dependent"
  | "district_energy_factor"
  | "hybrid_weighted"
  | "passive_operational_zero"
  | "local_factor_required";

export interface TechnologyCatalogEntry {
  tech_id: string;
  display_name_en: string;
  display_name_zh: string;
  visibility: "internal";
  role: TechnologyRole;
  services: EnergyService[];
  catalog_status: CatalogStatus;
  ranking_mode: RankingMode;
  screening: {
    installation_level: InstallationLevel;
    outdoor_space_required: OutdoorSpaceLevel;
    permanent_modification_required: boolean;
    onsite_combustion: boolean;
    infrastructure_required: InfrastructureRequirement[];
    climate_rules: ClimateRule[];
    supported_building_types?: string[];
    excluded_building_types?: string[];
    requires_region_confirmation?: boolean;
    requires_local_installer_confirmation?: boolean;
  };
  baseline_mapping: {
    heating_categories: string[];
    cooling_categories: string[];
  };
  g4_defaults: {
    capex_tier: CapexTier;
    operating_cost_model: OperatingCostModel;
    comfort_tier: ComfortTier;
    simplicity_tier: SimplicityTier;
    carbon_model: CarbonModel;
    expected_lifetime_years?: {
      low: number;
      mid: number;
      high: number;
    };
    maintenance_tier: "very_low" | "low" | "medium" | "high";
  };
  path_rules: {
    can_form_standalone_path: boolean;
    can_form_bundle: boolean;
    recommended_supporting_ids?: string[];
    incompatible_tech_ids?: string[];
    max_paths_per_primary?: number;
  };
  explanation: {
    summary_en: string;
    summary_zh: string;
    confirmation_en?: string;
    confirmation_zh?: string;
  };
  evidence: {
    source_names: string[];
    source_urls?: string[];
    last_reviewed: string;
    data_confidence: "high" | "medium" | "low";
  };
}

export interface RegionTechnologyOverride {
  tech_id: string;
  availability: "available" | "limited" | "unavailable" | "unknown";
  availability_confidence: "high" | "medium" | "low";
  legal_status?: "allowed" | "restricted" | "prohibited" | "unknown";
  legal_source_url?: string;
  legal_last_reviewed?: string;
  capex_local?: {
    low?: number;
    mid?: number;
    high?: number;
    currency: string;
    basis: "per_home" | "per_m2" | "per_kw";
  };
  operating_parameters?: {
    efficiency_mid?: number;
    cop_heating_mid?: number;
    cop_cooling_mid?: number;
    fuel_price_key?: string;
  };
  emissions?: {
    factor?: number;
    unit?: string;
  };
  notes_en?: string;
  notes_zh?: string;
}
