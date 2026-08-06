import type {
  HomeFeasibilityProfile,
  ValidationResult,
} from "./types";

export type FeasibilityQuestionId =
  | "housing_status"
  | "building_type"
  | "renovation_tolerance"
  | "outdoor_space"
  | "current_energy_services"
  | "current_heating_methods"
  | "current_cooling_methods"
  | "upfront_cost_preference";

export interface FeasibilityQuestion {
  id: FeasibilityQuestionId;
  group: "your_home" | "current_setup" | "practical_preferences";
  input: "radio_cards" | "checkbox_cards";
  label_en: string;
  label_zh: string;
  help_en?: string;
  help_zh?: string;
  options: Array<{
    value: string;
    label_en: string;
    label_zh: string;
    exclusive?: boolean;
  }>;
}

export const HOME_FEASIBILITY_QUESTIONS: FeasibilityQuestion[] = [
  {
    id: "housing_status",
    group: "your_home",
    input: "radio_cards",
    label_en: "What best describes your housing situation?",
    label_zh: "以下哪项最符合你的居住情况？",
    options: [
      { value: "owner", label_en: "I own the home", label_zh: "我拥有这套住宅" },
      {
        value: "renter_permission",
        label_en: "I rent and permanent changes are allowed",
        label_zh: "我是租户，并且可以进行永久性改造",
      },
      {
        value: "renter_no_permission",
        label_en: "I rent and permanent changes are not allowed",
        label_zh: "我是租户，并且不能进行永久性改造",
      },
      {
        value: "renter_not_sure",
        label_en: "I rent and I am not sure",
        label_zh: "我是租户，但不确定是否允许改造",
      },
      { value: "other", label_en: "Other", label_zh: "其他" },
    ],
  },
  {
    id: "building_type",
    group: "your_home",
    input: "radio_cards",
    label_en: "What type of home is this?",
    label_zh: "这是一套什么类型的住宅？",
    options: [
      { value: "detached", label_en: "Detached house", label_zh: "独栋住宅" },
      {
        value: "semi_detached_or_row",
        label_en: "Semi-detached or row house",
        label_zh: "联排、排屋或半独立住宅",
      },
      { value: "apartment", label_en: "Apartment", label_zh: "公寓" },
      {
        value: "mobile_or_temporary",
        label_en: "Mobile or temporary home",
        label_zh: "移动式或临时住宅",
      },
      { value: "other", label_en: "Other", label_zh: "其他" },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定" },
    ],
  },
  {
    id: "renovation_tolerance",
    group: "your_home",
    input: "radio_cards",
    label_en: "How much installation work would you consider?",
    label_zh: "你可以接受多大程度的安装或改造？",
    options: [
      { value: "none", label_en: "No permanent work", label_zh: "不接受永久性施工" },
      {
        value: "minor",
        label_en: "Minor work, such as a small opening or mounted unit",
        label_zh: "可以接受少量施工",
      },
      {
        value: "moderate",
        label_en: "Moderate work in part of the home",
        label_zh: "可以接受住宅局部改造",
      },
      { value: "major", label_en: "Major renovation is possible", label_zh: "可以接受较大规模改造" },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定" },
    ],
  },
  {
    id: "outdoor_space",
    group: "your_home",
    input: "radio_cards",
    label_en: "What outdoor space is available around the home?",
    label_zh: "住宅周围有多少可使用的室外空间？",
    options: [
      { value: "none", label_en: "No private outdoor space", label_zh: "没有私人室外空间" },
      { value: "wall_or_balcony", label_en: "Exterior wall or balcony only", label_zh: "只有外墙或阳台" },
      { value: "small_yard_or_roof", label_en: "Small yard or usable roof", label_zh: "有小型庭院或可用屋顶" },
      { value: "large_private_land", label_en: "Large private land", label_zh: "有较大的私人土地" },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定" },
    ],
  },
  {
    id: "current_energy_services",
    group: "current_setup",
    input: "checkbox_cards",
    label_en: "Which energy services or bills does this home currently have?",
    label_zh: "这套住宅目前有哪些能源供应或能源账单？",
    options: [
      { value: "electricity", label_en: "Electricity", label_zh: "电力" },
      { value: "piped_gas", label_en: "Piped gas", label_zh: "管道燃气" },
      {
        value: "delivered_fuel",
        label_en: "Delivered fuel, such as LPG or heating oil",
        label_zh: "配送燃料，例如液化气或燃油",
      },
      { value: "solid_fuel", label_en: "Wood, coal, or other solid fuel", label_zh: "木材、煤炭或其他固体燃料" },
      {
        value: "district_energy",
        label_en: "District or shared building energy",
        label_zh: "区域能源或建筑集中能源",
      },
      { value: "none", label_en: "None", label_zh: "没有", exclusive: true },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定", exclusive: true },
    ],
  },
  {
    id: "current_heating_methods",
    group: "current_setup",
    input: "checkbox_cards",
    label_en: "How does this home currently stay warm?",
    label_zh: "这套住宅目前主要使用哪些方式取暖？",
    help_en: "Select everything the home currently uses. This describes your starting point and does not limit the paths we compare.",
    help_zh: "请选择这套住宅目前实际使用的所有取暖方式。这些信息只用于了解现状，不会限制后台比较的候选路径。",
    options: [
      { value: "heat_pump", label_en: "Heat pump", label_zh: "热泵" },
      { value: "electric_heating", label_en: "Electric heater or electric heating system", label_zh: "电暖器或其他电取暖系统" },
      { value: "piped_gas_heating", label_en: "Piped gas heating", label_zh: "管道燃气取暖" },
      { value: "delivered_fuel_heating", label_en: "LPG, propane, or heating oil", label_zh: "液化气、丙烷或燃油取暖" },
      {
        value: "solid_fuel_heating",
        label_en: "Wood, coal, pellets, or other solid fuel",
        label_zh: "木材、煤炭、生物质颗粒或其他固体燃料",
      },
      {
        value: "district_or_shared_heating",
        label_en: "District or shared building heating",
        label_zh: "区域供热或建筑集中供热",
      },
      {
        value: "passive_or_solar_heating",
        label_en: "Passive solar or solar heating support",
        label_zh: "被动太阳能或太阳能辅助取暖",
      },
      { value: "no_current_heating", label_en: "No current heating system", label_zh: "目前没有取暖系统", exclusive: true },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定", exclusive: true },
    ],
  },
  {
    id: "current_cooling_methods",
    group: "current_setup",
    input: "checkbox_cards",
    label_en: "How does this home currently stay cool?",
    label_zh: "这套住宅目前主要使用哪些方式降温？",
    help_en: "Select everything the home currently uses. This describes your starting point and does not limit the paths we compare.",
    help_zh: "请选择这套住宅目前实际使用的所有降温方式。这些信息只用于了解现状，不会限制后台比较的候选路径。",
    options: [
      { value: "room_air_conditioning", label_en: "Room air conditioner", label_zh: "房间空调，例如窗式、移动式或分体式空调" },
      { value: "central_air_conditioning", label_en: "Central air conditioning", label_zh: "中央空调" },
      { value: "heat_pump_cooling", label_en: "Heat pump used for cooling", label_zh: "使用热泵制冷" },
      {
        value: "evaporative_or_water_cooling",
        label_en: "Evaporative or water-based cooler",
        label_zh: "蒸发式或水冷降温设备",
      },
      { value: "fans", label_en: "Ceiling or portable fans", label_zh: "吊扇或移动风扇" },
      {
        value: "natural_or_passive_cooling",
        label_en: "Natural ventilation, shading, or other passive cooling",
        label_zh: "自然通风、遮阳或其他被动降温",
      },
      {
        value: "district_or_shared_cooling",
        label_en: "District or shared building cooling",
        label_zh: "区域供冷或建筑集中供冷",
      },
      { value: "no_current_cooling", label_en: "No current cooling system", label_zh: "目前没有制冷系统", exclusive: true },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定", exclusive: true },
    ],
  },
  {
    id: "upfront_cost_preference",
    group: "practical_preferences",
    input: "radio_cards",
    label_en: "How would you approach upfront cost?",
    label_zh: "你对前期投入的接受程度如何？",
    options: [
      { value: "minimum_upfront", label_en: "Keep upfront cost as low as possible", label_zh: "尽量降低前期投入" },
      { value: "moderate_investment", label_en: "A moderate investment is possible", label_zh: "可以接受中等投入" },
      {
        value: "higher_if_saves_later",
        label_en: "I could invest more if long-term bills are lower",
        label_zh: "如果长期账单更低，可以接受较高投入",
      },
      { value: "not_sure", label_en: "Not sure", label_zh: "不确定" },
    ],
  },
];

export function getHomeFeasibilityQuestions(needsHeating: boolean, needsCooling: boolean): FeasibilityQuestion[] {
  if (!needsHeating && !needsCooling) return [];

  return HOME_FEASIBILITY_QUESTIONS.filter((question) => {
    if (question.id === "current_heating_methods") return needsHeating;
    if (question.id === "current_cooling_methods") return needsCooling;
    return true;
  });
}

export function applyExclusiveSelection(current: string[], nextValue: string, exclusiveValues: string[]): string[] {
  if (exclusiveValues.includes(nextValue)) return [nextValue];
  return [...current.filter((value) => !exclusiveValues.includes(value)), nextValue]
    .filter((value, index, array) => array.indexOf(value) === index);
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

function hasSelection(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function containsMutuallyExclusive(values: string[], exclusiveValues: string[]): boolean {
  return values.some((value) => exclusiveValues.includes(value)) && values.length > 1;
}

export function validateHomeFeasibility(
  profile: Partial<HomeFeasibilityProfile>,
  needsHeating: boolean,
  needsCooling: boolean,
): ValidationResult {
  const errors: string[] = [];
  const requiredScalars: Array<keyof HomeFeasibilityProfile> = [
    "housing_status",
    "building_type",
    "renovation_tolerance",
    "outdoor_space",
    "upfront_cost_preference",
  ];

  requiredScalars.forEach((key) => {
    if (!hasValue(profile[key])) errors.push(String(key));
  });

  if (!hasSelection(profile.current_energy_services)) errors.push("current_energy_services");
  if (needsHeating && !hasSelection(profile.current_heating_methods)) errors.push("current_heating_methods");
  if (needsCooling && !hasSelection(profile.current_cooling_methods)) errors.push("current_cooling_methods");

  if (containsMutuallyExclusive(profile.current_energy_services ?? [], ["none", "not_sure"])) {
    errors.push("current_energy_services_mutual_exclusion");
  }
  if (containsMutuallyExclusive(profile.current_heating_methods ?? [], ["no_current_heating", "not_sure"])) {
    errors.push("current_heating_methods_mutual_exclusion");
  }
  if (containsMutuallyExclusive(profile.current_cooling_methods ?? [], ["no_current_cooling", "not_sure"])) {
    errors.push("current_cooling_methods_mutual_exclusion");
  }

  return { valid: errors.length === 0, errors };
}
