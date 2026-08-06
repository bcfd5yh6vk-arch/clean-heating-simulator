import type {
  BaselineProfile,
  CandidatePath,
  ClimateProfile,
  Confidence,
  CurrentCoolingMethod,
  CurrentEnergyService,
  CurrentHeatingMethod,
  HomeFeasibilityProfile,
  HouseholdProfile,
  InstallationLevel,
  OutdoorSpace,
  OutdoorSpaceLevel,
  RankedPath,
  RegionProfile,
  ScreenedTechnology,
  ScreeningResult,
  ScreeningWarning,
  ServiceType,
  TechnologyProfile,
} from "./types";

const INSTALLATION_RANK: Record<InstallationLevel, number> = {
  none: 0,
  minor: 1,
  moderate: 2,
  major: 3,
};

const OUTDOOR_SPACE_RANK: Record<OutdoorSpaceLevel, number> = {
  none: 0,
  wall_or_balcony: 1,
  small_yard_or_roof: 2,
  large_private_land: 3,
};

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const EXCLUDE_TEXT: Record<string, { en: string; zh: string }> = {
  NO_GAS_GRID: { en: "No gas grid in high-confidence region data.", zh: "高置信度地区数据表明当地无管道燃气。" },
  NO_DISTRICT_NETWORK: { en: "No district energy network in high-confidence region data.", zh: "高置信度地区数据表明当地无区域能源网络。" },
  NO_DELIVERED_FUEL_MARKET: { en: "No delivered fuel market in high-confidence region data.", zh: "高置信度地区数据表明当地无配送燃料市场。" },
  UNRELIABLE_ELECTRICITY: { en: "Reliable electricity is not available in high-confidence region data.", zh: "高置信度地区数据表明当地电力供应不可靠。" },
  PERMANENT_WORK_NOT_ALLOWED: { en: "Permanent work is not allowed for this home.", zh: "该住宅不允许永久性施工。" },
  INSTALLATION_SCOPE_TOO_LARGE: { en: "Required installation work is beyond the selected tolerance.", zh: "所需安装或改造规模超过用户可接受范围。" },
  INSUFFICIENT_OUTDOOR_SPACE: { en: "Required outdoor space is larger than the selected available space.", zh: "所需室外空间超过用户可用空间。" },
  UNSAFE_CLIMATE_FIT: { en: "High-confidence climate data indicates this technology cannot provide basic safe service here.", zh: "高置信度气候数据表明该技术在当地无法提供基本安全服务。" },
  UNSUPPORTED_BUILDING_TYPE: { en: "This technology is not supported for the selected building type.", zh: "该技术不支持所选住宅类型。" },
};

const WARNING_TEXT: Record<string, { en: string; zh: string }> = {
  NEEDS_LOCAL_CONFIRMATION: { en: "Needs local confirmation", zh: "需要当地确认" },
  PRELIMINARY_RESULT: { en: "Preliminary result", zh: "初步结果" },
  DATA_UNCERTAIN: { en: "Data uncertain", zh: "数据不确定" },
  PERMISSION_UNCERTAIN: { en: "Renovation permission must be confirmed", zh: "需要确认是否允许改造" },
  INSTALLATION_UNCERTAIN: { en: "Moderate or major installation may need confirmation", zh: "中等或较大规模安装需要确认" },
  OUTDOOR_SPACE_UNCERTAIN: { en: "Outdoor space must be confirmed", zh: "需要确认室外空间条件" },
  GAS_CONNECTION_CONFIRMATION: { en: "Gas connection must be confirmed", zh: "需要确认是否可接入燃气" },
  DISTRICT_NETWORK_CONFIRMATION: { en: "District energy access must be confirmed", zh: "需要确认是否可接入区域能源" },
  DELIVERED_FUEL_CONFIRMATION: { en: "Delivered fuel availability must be confirmed", zh: "需要确认配送燃料是否可获得" },
  ELECTRICITY_CONFIRMATION: { en: "Reliable electricity must be confirmed", zh: "需要确认电力供应可靠性" },
  BACKUP_HEATING_MAY_BE_REQUIRED: { en: "Backup heating may be required", zh: "可能需要备用取暖" },
  EXTREME_COLD_PERFORMANCE: { en: "Performance may fall during extreme cold", zh: "极端寒冷时性能可能下降" },
  HUMIDITY_CONTROL_MAY_BE_NEEDED: { en: "Humidity control may be needed", zh: "可能需要湿度控制" },
  DRY_CLIMATE_CONFIRMATION: { en: "This option is usually more effective in dry climates", zh: "该选项通常在干燥气候中更有效" },
  PRODUCT_SPECS_CONFIRMATION: { en: "Local product specifications must be confirmed", zh: "需要确认当地产品规格" },
};

function minConfidence(values: Confidence[]): Confidence {
  return values.reduce<Confidence>((lowest, value) =>
    CONFIDENCE_RANK[value] < CONFIDENCE_RANK[lowest] ? value : lowest, "high");
}

function lowerConfidence(confidence: Confidence): Confidence {
  if (confidence === "high") return "medium";
  return "low";
}

function warning(tech_id: string, code: string, source: ScreeningWarning["source"]): ScreeningWarning {
  const text = WARNING_TEXT[code] ?? WARNING_TEXT.NEEDS_LOCAL_CONFIRMATION;
  return {
    tech_id,
    code,
    message_en: text.en,
    message_zh: text.zh,
    source,
  };
}

function exclude(tech_id: string, reason_code: string, evidence_source: "user_answer" | "region_data" | "climate_data") {
  const text = EXCLUDE_TEXT[reason_code];
  return {
    tech_id,
    reason_code,
    reason_en: text.en,
    reason_zh: text.zh,
    evidence_source,
  };
}

function serviceMatches(tech: TechnologyProfile, household: HouseholdProfile): boolean {
  const hasService = (service: ServiceType) => tech.services.includes(service);
  const heatingMatch = household.needs_heating && (hasService("heating") || hasService("heating_and_cooling"));
  const coolingMatch = household.needs_cooling && (hasService("cooling") || hasService("heating_and_cooling"));
  return heatingMatch || coolingMatch || (hasService("supporting_measure") && (household.needs_heating || household.needs_cooling));
}

function hasCurrentEnergy(services: CurrentEnergyService[], service: CurrentEnergyService): boolean {
  return services.includes(service);
}

export function buildBaselineProfile(
  household: HouseholdProfile,
  feasibility: HomeFeasibilityProfile,
  _region: RegionProfile,
): BaselineProfile {
  const heating = household.needs_heating ? feasibility.current_heating_methods : [];
  const cooling = household.needs_cooling ? feasibility.current_cooling_methods : [];

  const heatingNotSure = heating.includes("not_sure");
  const coolingNotSure = cooling.includes("not_sure");
  const noHeating = !household.needs_heating || heating.includes("no_current_heating");
  const noCooling = !household.needs_cooling || cooling.includes("no_current_cooling");

  const mechanicalCoolingMethods: CurrentCoolingMethod[] = [
    "room_air_conditioning",
    "central_air_conditioning",
    "heat_pump_cooling",
    "evaporative_or_water_cooling",
    "district_or_shared_cooling",
  ];

  return {
    heating_categories: heating.filter((method) => method !== "not_sure" && method !== "no_current_heating"),
    cooling_categories: cooling.filter((method) => method !== "not_sure" && method !== "no_current_cooling"),
    heating_data_confidence: heatingNotSure ? "low" : noHeating ? "medium" : "high",
    cooling_data_confidence: coolingNotSure ? "low" : noCooling ? "medium" : "high",
    has_mechanical_heating: !noHeating && !heatingNotSure,
    has_mechanical_cooling: !noCooling && cooling.some((method) => mechanicalCoolingMethods.includes(method)),
    current_energy_sources: feasibility.current_energy_services.filter(
      (service) => service !== "none" && service !== "not_sure",
    ),
  };
}

export function screenTechnologies(
  region: RegionProfile,
  climate: ClimateProfile,
  household: HouseholdProfile,
  feasibility: HomeFeasibilityProfile,
  technologies: TechnologyProfile[],
): ScreeningResult {
  const passed: ScreenedTechnology[] = [];
  const excluded = [];
  const warnings: ScreeningWarning[] = [];

  const candidates = technologies
    .filter((tech) => serviceMatches(tech, household))
    .sort((a, b) => a.tech_id.localeCompare(b.tech_id));

  for (const tech of candidates) {
    const techWarnings: ScreeningWarning[] = [];
    const confidenceParts: Confidence[] = [tech.data_confidence];
    let excludedReason: ReturnType<typeof exclude> | null = null;

    const constraints = tech.infrastructure_constraints ?? {};
    if (
      constraints.requires_gas_grid &&
      region.infrastructure.gas_grid === false &&
      region.infrastructure.gas_grid_confidence === "high"
    ) {
      excludedReason = exclude(tech.tech_id, "NO_GAS_GRID", "region_data");
    }
    if (
      !excludedReason &&
      constraints.requires_district_network &&
      region.infrastructure.district_energy === false &&
      region.infrastructure.district_energy_confidence === "high"
    ) {
      excludedReason = exclude(tech.tech_id, "NO_DISTRICT_NETWORK", "region_data");
    }
    if (
      !excludedReason &&
      constraints.requires_delivered_fuel_market &&
      region.infrastructure.delivered_fuel_market === false &&
      region.infrastructure.delivered_fuel_market_confidence === "high"
    ) {
      excludedReason = exclude(tech.tech_id, "NO_DELIVERED_FUEL_MARKET", "region_data");
    }
    if (
      !excludedReason &&
      constraints.requires_reliable_electricity &&
      region.infrastructure.reliable_electricity === false &&
      region.infrastructure.reliable_electricity_confidence === "high"
    ) {
      excludedReason = exclude(tech.tech_id, "UNRELIABLE_ELECTRICITY", "region_data");
    }

    if (
      !excludedReason &&
      feasibility.housing_status === "renter_no_permission" &&
      tech.permanent_modification_required
    ) {
      excludedReason = exclude(tech.tech_id, "PERMANENT_WORK_NOT_ALLOWED", "user_answer");
    }

    if (
      !excludedReason &&
      feasibility.renovation_tolerance !== "not_sure" &&
      INSTALLATION_RANK[tech.installation_level] > INSTALLATION_RANK[feasibility.renovation_tolerance]
    ) {
      excludedReason = exclude(tech.tech_id, "INSTALLATION_SCOPE_TOO_LARGE", "user_answer");
    }

    if (
      !excludedReason &&
      feasibility.outdoor_space !== "not_sure" &&
      OUTDOOR_SPACE_RANK[tech.outdoor_space_required] > OUTDOOR_SPACE_RANK[feasibility.outdoor_space as OutdoorSpaceLevel]
    ) {
      excludedReason = exclude(tech.tech_id, "INSUFFICIENT_OUTDOOR_SPACE", "user_answer");
    }

    if (
      !excludedReason &&
      feasibility.building_type !== "not_sure" &&
      tech.supported_building_types &&
      !tech.supported_building_types.includes(feasibility.building_type)
    ) {
      excludedReason = exclude(tech.tech_id, "UNSUPPORTED_BUILDING_TYPE", "user_answer");
    }

    const climateConstraints = tech.climate_constraints ?? {};
    if (
      !excludedReason &&
      climateConstraints.min_design_temp_c !== undefined &&
      climate.design_temp_c !== undefined &&
      climate.design_temp_confidence === "high" &&
      climate.design_temp_c < climateConstraints.min_design_temp_c
    ) {
      if (!tech.backup_option_supported && !tech.fallback_possible) {
        excludedReason = exclude(tech.tech_id, "UNSAFE_CLIMATE_FIT", "climate_data");
      } else {
        techWarnings.push(warning(tech.tech_id, "BACKUP_HEATING_MAY_BE_REQUIRED", "climate_data"));
        techWarnings.push(warning(tech.tech_id, "EXTREME_COLD_PERFORMANCE", "climate_data"));
        confidenceParts.push("medium");
      }
    }

    if (excludedReason) {
      excluded.push(excludedReason);
      continue;
    }

    if (constraints.requires_gas_grid && !hasCurrentEnergy(feasibility.current_energy_services, "piped_gas")) {
      techWarnings.push(warning(tech.tech_id, "GAS_CONNECTION_CONFIRMATION", "user_answer"));
    }
    if (constraints.requires_district_network && !hasCurrentEnergy(feasibility.current_energy_services, "district_energy")) {
      techWarnings.push(warning(tech.tech_id, "DISTRICT_NETWORK_CONFIRMATION", "user_answer"));
    }
    if (constraints.requires_delivered_fuel_market && !hasCurrentEnergy(feasibility.current_energy_services, "delivered_fuel")) {
      techWarnings.push(warning(tech.tech_id, "DELIVERED_FUEL_CONFIRMATION", "user_answer"));
    }
    if (constraints.requires_reliable_electricity && !hasCurrentEnergy(feasibility.current_energy_services, "electricity")) {
      techWarnings.push(warning(tech.tech_id, "ELECTRICITY_CONFIRMATION", "user_answer"));
    }

    if (feasibility.housing_status === "renter_not_sure") {
      techWarnings.push(warning(tech.tech_id, "PERMISSION_UNCERTAIN", "user_answer"));
      confidenceParts.push("medium");
    }
    if (feasibility.renovation_tolerance === "not_sure" && (tech.installation_level === "moderate" || tech.installation_level === "major")) {
      techWarnings.push(warning(tech.tech_id, "INSTALLATION_UNCERTAIN", "user_answer"));
      confidenceParts.push("low");
    }
    if (feasibility.outdoor_space === "not_sure" && tech.outdoor_space_required !== "none") {
      techWarnings.push(warning(tech.tech_id, "OUTDOOR_SPACE_UNCERTAIN", "user_answer"));
      confidenceParts.push("low");
    }
    if (feasibility.building_type === "not_sure" || feasibility.current_energy_services.includes("not_sure")) {
      techWarnings.push(warning(tech.tech_id, "DATA_UNCERTAIN", "user_answer"));
      confidenceParts.push("low");
    }

    if (constraints.requires_gas_grid && region.infrastructure.gas_grid_confidence !== "high") {
      techWarnings.push(warning(tech.tech_id, "NEEDS_LOCAL_CONFIRMATION", "region_data"));
      confidenceParts.push("medium");
    }
    if (constraints.requires_district_network && region.infrastructure.district_energy_confidence !== "high") {
      techWarnings.push(warning(tech.tech_id, "NEEDS_LOCAL_CONFIRMATION", "region_data"));
      confidenceParts.push("medium");
    }
    if (climateConstraints.requires_dry_climate && climate.humidity_level !== "dry") {
      techWarnings.push(warning(tech.tech_id, "DRY_CLIMATE_CONFIRMATION", "climate_data"));
      confidenceParts.push(climate.humidity_confidence === "high" ? "medium" : "low");
    }
    if (climateConstraints.humidity_sensitive && climate.humidity_level === "humid") {
      techWarnings.push(warning(tech.tech_id, "HUMIDITY_CONTROL_MAY_BE_NEEDED", "climate_data"));
      confidenceParts.push("medium");
    }

    const confidence = techWarnings.length ? minConfidence(confidenceParts) : tech.data_confidence;
    warnings.push(...techWarnings);
    passed.push({
      tech_id: tech.tech_id,
      screening_status: techWarnings.length ? "eligible_with_warning" : "eligible",
      warnings: techWarnings.map((item) => item.message_en),
      confidence,
    });
  }

  return {
    passed,
    excluded: excluded.sort((a, b) => a.tech_id.localeCompare(b.tech_id)),
    warnings: warnings.sort((a, b) => `${a.tech_id}:${a.code}`.localeCompare(`${b.tech_id}:${b.code}`)),
  };
}

function serviceListForTechnology(tech: TechnologyProfile): ("heating" | "cooling")[] {
  const services = new Set<"heating" | "cooling">();
  if (tech.services.includes("heating") || tech.services.includes("heating_and_cooling")) services.add("heating");
  if (tech.services.includes("cooling") || tech.services.includes("heating_and_cooling")) services.add("cooling");
  return [...services].sort();
}

function transitionComplexity(tech: TechnologyProfile): "low" | "medium" | "high" | "unknown" {
  if (tech.installation_level === "none" || tech.installation_level === "minor") return "low";
  if (tech.installation_level === "moderate") return "medium";
  if (tech.installation_level === "major") return "high";
  return "unknown";
}

export function generateCandidatePaths(
  screenedTechnologies: ScreenedTechnology[],
  baseline: BaselineProfile,
  _region: RegionProfile,
  _climate: ClimateProfile,
  household: HouseholdProfile,
  technologies: TechnologyProfile[],
): CandidatePath[] {
  const screenedById = new Map(screenedTechnologies.map((tech) => [tech.tech_id, tech]));
  const technologyById = new Map(technologies.map((tech) => [tech.tech_id, tech]));
  const passedTechs = screenedTechnologies
    .map((screened) => technologyById.get(screened.tech_id))
    .filter((tech): tech is TechnologyProfile => Boolean(tech))
    .sort((a, b) => a.tech_id.localeCompare(b.tech_id));

  const primary = passedTechs.filter((tech) => !tech.services.includes("supporting_measure"));
  const supporting = passedTechs.filter((tech) => tech.services.includes("supporting_measure"));
  const paths: CandidatePath[] = [];

  for (const tech of primary) {
    const screened = screenedById.get(tech.tech_id);
    if (!screened) continue;
    const services = serviceListForTechnology(tech).filter(
      (service) => (service === "heating" && household.needs_heating) || (service === "cooling" && household.needs_cooling),
    );
    if (!services.length) continue;

    const fromCategories = [
      ...(services.includes("heating") ? baseline.heating_categories : []),
      ...(services.includes("cooling") ? baseline.cooling_categories : []),
    ];

    paths.push({
      path_id: tech.tech_id,
      primary_tech_ids: [tech.tech_id],
      supporting_measure_ids: [],
      services,
      baseline_transition: {
        from_categories: fromCategories,
        reuse_existing_infrastructure: Boolean(
          tech.can_reuse_baseline_categories?.some((category) => fromCategories.includes(category)),
        ),
        replacement_complexity: transitionComplexity(tech),
      },
      screening_warnings: screened.warnings,
      screening_confidence: screened.confidence,
    });

    const support = supporting.find((item) => {
      const supportServices = serviceListForTechnology(item);
      return supportServices.length === 0 || supportServices.some((service) => services.includes(service));
    });
    if (support && paths.length < 12) {
      const supportScreened = screenedById.get(support.tech_id);
      paths.push({
        path_id: `${tech.tech_id}_plus_${support.tech_id}`,
        primary_tech_ids: [tech.tech_id],
        supporting_measure_ids: [support.tech_id],
        services,
        baseline_transition: {
          from_categories: fromCategories,
          reuse_existing_infrastructure: true,
          replacement_complexity: transitionComplexity(tech),
        },
        screening_warnings: [...screened.warnings, ...(supportScreened?.warnings ?? [])],
        screening_confidence: minConfidence([screened.confidence, supportScreened?.confidence ?? "medium"]),
      });
    }
    if (paths.length >= 12) break;
  }

  return paths
    .sort((a, b) => a.path_id.localeCompare(b.path_id))
    .slice(0, 12);
}

function scoreFromTier(tier: number | undefined): number {
  return Math.max(0, Math.min(100, (tier ?? 3) * 20));
}

function capexPenalty(capex: TechnologyProfile["capex_level"], preference: HomeFeasibilityProfile["upfront_cost_preference"]): number {
  const base = capex === "high" ? 24 : capex === "medium" ? 12 : 4;
  if (preference === "minimum_upfront") return base * 1.4;
  if (preference === "higher_if_saves_later") return base * 0.55;
  if (preference === "not_sure") return base;
  return base;
}

export function scoreAndSort(
  candidatePaths: CandidatePath[],
  baseline: BaselineProfile,
  household: HouseholdProfile,
  _region: RegionProfile,
  _climate: ClimateProfile,
  feasibility: HomeFeasibilityProfile,
  technologies: TechnologyProfile[],
): RankedPath[] {
  const technologyById = new Map(technologies.map((tech) => [tech.tech_id, tech]));

  return candidatePaths
    .map((path) => {
      const primary = technologyById.get(path.primary_tech_ids[0]);
      const support = path.supporting_measure_ids.map((id) => technologyById.get(id)).filter(Boolean) as TechnologyProfile[];
      const capex = primary?.capex_level ?? "medium";
      const warningPenalty = path.screening_warnings.length * 4;
      const confidencePenalty = path.screening_confidence === "low" ? 12 : path.screening_confidence === "medium" ? 6 : 0;
      const cost = Math.round(Math.max(0, 90 - capexPenalty(capex, feasibility.upfront_cost_preference) - warningPenalty));
      const carbon = Math.round(Math.min(100, 55 + support.length * 8 + (primary?.services.includes("supporting_measure") ? 6 : 18)));
      const comfort = Math.round(Math.max(0, scoreFromTier(primary?.comfort_tier) - confidencePenalty));
      const climate = Math.round(Math.max(0, 82 - warningPenalty - confidencePenalty));
      const simple = Math.round(Math.max(0, scoreFromTier(primary?.simplicity_tier) - (path.baseline_transition?.replacement_complexity === "high" ? 15 : 0)));
      const defaultWeights = { cost: 35, carbon: 20, comfort: 20, climate: 15, simple: 10 };
      const fitness =
        (cost * defaultWeights.cost +
          carbon * defaultWeights.carbon +
          comfort * defaultWeights.comfort +
          climate * defaultWeights.climate +
          simple * defaultWeights.simple) /
        100;

      return {
        ...path,
        fitness: Number(fitness.toFixed(1)),
        dimensions: { cost, carbon, comfort, climate, simple },
      };
    })
    .sort((a, b) => {
      if (b.fitness !== a.fitness) return b.fitness - a.fitness;
      return a.path_id.localeCompare(b.path_id);
    })
    .map((path) => ({
      ...path,
      baseline_transition: {
        ...path.baseline_transition,
        from_categories: path.baseline_transition?.from_categories ?? [
          ...(household.needs_heating ? baseline.heating_categories : []),
          ...(household.needs_cooling ? baseline.cooling_categories : []),
        ],
        reuse_existing_infrastructure: path.baseline_transition?.reuse_existing_infrastructure ?? false,
        replacement_complexity: path.baseline_transition?.replacement_complexity ?? "unknown",
      },
    }));
}
