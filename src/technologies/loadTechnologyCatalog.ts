import type { TechnologyProfile } from "../global/types";
import type { TechnologyCatalogEntry } from "./types";

export interface CatalogCounts {
  total: number;
  active: number;
  conditional: number;
  baseline_only: number;
  phase2: number;
}

function capexTierToLevel(tier: TechnologyCatalogEntry["g4_defaults"]["capex_tier"]): TechnologyProfile["capex_level"] {
  if (tier <= 2) return "low";
  if (tier === 3) return "medium";
  return "high";
}

function hasInfrastructure(entry: TechnologyCatalogEntry, requirement: string): boolean {
  return entry.screening.infrastructure_required.includes(requirement as never);
}

function climateConstraints(entry: TechnologyCatalogEntry): TechnologyProfile["climate_constraints"] {
  const rules = entry.screening.climate_rules;
  const constraints: TechnologyProfile["climate_constraints"] = {};
  if (rules.includes("cold_performance_check")) constraints.min_design_temp_c = -20;
  if (rules.includes("dry_climate_required") || rules.includes("dry_climate_preferred")) {
    constraints.requires_dry_climate = true;
  }
  if (rules.includes("humidity_control_helpful")) constraints.humidity_sensitive = true;
  return Object.keys(constraints).length ? constraints : undefined;
}

function screeningServices(entry: TechnologyCatalogEntry): TechnologyProfile["services"] {
  const services: TechnologyProfile["services"] = [...entry.services];
  if (entry.role === "supporting") services.push("supporting_measure");
  return [...new Set(services)].sort();
}

export function loadTechnologyCatalogFromJson(raw: unknown): TechnologyCatalogEntry[] {
  if (!Array.isArray(raw)) {
    throw new Error("Technology catalog must be an array.");
  }
  return raw as TechnologyCatalogEntry[];
}

export function getCatalogCounts(catalog: TechnologyCatalogEntry[]): CatalogCounts {
  return {
    total: catalog.length,
    active: catalog.filter((entry) => entry.catalog_status === "active").length,
    conditional: catalog.filter((entry) => entry.catalog_status === "conditional").length,
    baseline_only: catalog.filter((entry) => entry.catalog_status === "baseline_only").length,
    phase2: catalog.filter((entry) => entry.catalog_status === "phase2").length,
  };
}

export function getMvpScreeningCatalog(catalog: TechnologyCatalogEntry[]): TechnologyProfile[] {
  return catalog
    .filter((entry) => entry.catalog_status === "active" || entry.catalog_status === "conditional")
    .filter((entry) => entry.ranking_mode !== "baseline_only" && entry.ranking_mode !== "phase2")
    .map(catalogEntryToTechnologyProfile)
    .sort((a, b) => a.tech_id.localeCompare(b.tech_id));
}

export function getBaselineOnlyCatalog(catalog: TechnologyCatalogEntry[]): TechnologyCatalogEntry[] {
  return catalog
    .filter((entry) => entry.catalog_status === "baseline_only" || entry.ranking_mode === "baseline_only")
    .sort((a, b) => a.tech_id.localeCompare(b.tech_id));
}

export function catalogEntryToTechnologyProfile(entry: TechnologyCatalogEntry): TechnologyProfile {
  return {
    tech_id: entry.tech_id,
    display_name_en: entry.display_name_en,
    display_name_zh: entry.display_name_zh,
    role: entry.role,
    catalog_status: entry.catalog_status,
    ranking_mode: entry.ranking_mode,
    services: screeningServices(entry),
    installation_level: entry.screening.installation_level,
    outdoor_space_required: entry.screening.outdoor_space_required,
    permanent_modification_required: entry.screening.permanent_modification_required,
    supported_building_types: entry.screening.supported_building_types as TechnologyProfile["supported_building_types"],
    infrastructure_constraints: {
      requires_reliable_electricity: hasInfrastructure(entry, "electricity") || undefined,
      requires_gas_grid: hasInfrastructure(entry, "piped_gas") || undefined,
      requires_delivered_fuel_market: hasInfrastructure(entry, "delivered_fuel") || undefined,
      requires_district_network:
        hasInfrastructure(entry, "district_heating_network") ||
        hasInfrastructure(entry, "district_cooling_network") ||
        undefined,
    },
    climate_constraints: climateConstraints(entry),
    can_reuse_baseline_categories: [
      ...entry.baseline_mapping.heating_categories,
      ...entry.baseline_mapping.cooling_categories,
    ],
    replaces_baseline_categories: [
      ...entry.baseline_mapping.heating_categories,
      ...entry.baseline_mapping.cooling_categories,
    ],
    backup_option_supported: entry.screening.climate_rules.includes("cold_performance_check"),
    fallback_possible: entry.role === "supporting" || entry.path_rules.can_form_bundle,
    data_confidence: entry.evidence.data_confidence,
    capex_level: capexTierToLevel(entry.g4_defaults.capex_tier),
    comfort_tier: entry.g4_defaults.comfort_tier,
    simplicity_tier: entry.g4_defaults.simplicity_tier,
  };
}
