const MESSAGES = {
  en: {
    languageLabel: "Language",
    g2Step: "G2 context for this prototype",
    g2Title: "Household service needs",
    g2Hint: "In the full flow these values come from G2. They control which G3 questions appear.",
    needsHeating: "This home needs winter heating",
    needsCooling: "This home needs summer cooling",
    g3Step: "3 of 4 · About your home",
    g3Title: "A few practical questions about your home",
    g3Intro:
      "Answer what you know. “Not sure” is always fine. We will use your answers, your current heating and cooling setup, local climate data, and regional information to screen possible paths.",
    validationError: "Please answer each question. Choose “Not sure” whenever you do not know.",
    backButton: "Back",
    findPathsButton: "Find possible paths",
    g4Title: "Paths screened for your home",
    checkingText: "Checking possible paths for your home…",
    currentSetup: "Your current setup",
    g4Note:
      "Candidate paths are produced by deterministic screening from the full technology catalog. The G3 page does not show or whitelist future technologies.",
    skipped: "No heating or cooling service is needed, so G3 can be skipped.",
    heating: "Current heating",
    cooling: "Current cooling",
  },
  zh: {
    languageLabel: "语言",
    g2Step: "G2 原型上下文",
    g2Title: "家庭服务需求",
    g2Hint: "完整流程中这些值来自 G2，并决定 G3 显示哪些问题。",
    needsHeating: "这套住宅需要冬季取暖",
    needsCooling: "这套住宅需要夏季制冷",
    g3Step: "3 of 4 · About your home",
    g3Title: "几个关于住宅实际情况的问题",
    g3Intro:
      "请根据你了解的情况回答；不确定时可以直接选择“不确定”。系统会结合住宅当前的取暖和制冷方式、当地气候及地区数据，自动筛选可能适用的路径。",
    validationError: "请回答每个问题；不了解时可以选择“不确定”。",
    backButton: "返回",
    findPathsButton: "筛选可行路径",
    g4Title: "已为这套住宅筛选路径",
    checkingText: "正在筛选适合这套住宅的路径……",
    currentSetup: "当前配置",
    g4Note: "候选路径由完整后台技术目录经过确定性筛选生成。G3 页面不会展示或要求用户勾选未来候选技术。",
    skipped: "这套住宅不需要取暖或制冷，因此可以跳过 G3。",
    heating: "当前取暖",
    cooling: "当前制冷",
  },
};

const QUESTIONS = [
  {
    id: "housing_status",
    group: "Your home",
    type: "radio",
    label: { en: "What best describes your housing situation?", zh: "以下哪项最符合你的居住情况？" },
    options: [
      ["owner", "I own the home", "我拥有这套住宅"],
      ["renter_permission", "I rent and permanent changes are allowed", "我是租户，并且可以进行永久性改造"],
      ["renter_no_permission", "I rent and permanent changes are not allowed", "我是租户，并且不能进行永久性改造"],
      ["renter_not_sure", "I rent and I am not sure", "我是租户，但不确定是否允许改造"],
      ["other", "Other", "其他"],
    ],
  },
  {
    id: "building_type",
    group: "Your home",
    type: "radio",
    label: { en: "What type of home is this?", zh: "这是一套什么类型的住宅？" },
    options: [
      ["detached", "Detached house", "独栋住宅"],
      ["semi_detached_or_row", "Semi-detached or row house", "联排、排屋或半独立住宅"],
      ["apartment", "Apartment", "公寓"],
      ["mobile_or_temporary", "Mobile or temporary home", "移动式或临时住宅"],
      ["other", "Other", "其他"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
  {
    id: "renovation_tolerance",
    group: "Your home",
    type: "radio",
    label: { en: "How much installation work would you consider?", zh: "你可以接受多大程度的安装或改造？" },
    options: [
      ["none", "No permanent work", "不接受永久性施工"],
      ["minor", "Minor work, such as a small opening or mounted unit", "可以接受少量施工"],
      ["moderate", "Moderate work in part of the home", "可以接受住宅局部改造"],
      ["major", "Major renovation is possible", "可以接受较大规模改造"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
  {
    id: "outdoor_space",
    group: "Your home",
    type: "radio",
    label: { en: "What outdoor space is available around the home?", zh: "住宅周围有多少可使用的室外空间？" },
    options: [
      ["none", "No private outdoor space", "没有私人室外空间"],
      ["wall_or_balcony", "Exterior wall or balcony only", "只有外墙或阳台"],
      ["small_yard_or_roof", "Small yard or usable roof", "有小型庭院或可用屋顶"],
      ["large_private_land", "Large private land", "有较大的私人土地"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
  {
    id: "current_energy_services",
    group: "Current setup",
    type: "checkbox",
    label: { en: "Which energy services or bills does this home currently have?", zh: "这套住宅目前有哪些能源供应或能源账单？" },
    exclusive: ["none", "not_sure"],
    options: [
      ["electricity", "Electricity", "电力"],
      ["piped_gas", "Piped gas", "管道燃气"],
      ["delivered_fuel", "Delivered fuel, such as LPG or heating oil", "配送燃料，例如液化气或燃油"],
      ["solid_fuel", "Wood, coal, or other solid fuel", "木材、煤炭或其他固体燃料"],
      ["district_energy", "District or shared building energy", "区域能源或建筑集中能源"],
      ["none", "None", "没有"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
  {
    id: "current_heating_methods",
    group: "Current setup",
    type: "checkbox",
    when: "heating",
    label: { en: "How does this home currently stay warm?", zh: "这套住宅目前主要使用哪些方式取暖？" },
    help: {
      en: "Select everything the home currently uses. This describes your starting point and does not limit the paths we compare.",
      zh: "请选择这套住宅目前实际使用的所有取暖方式。这些信息只用于了解现状，不会限制后台比较的候选路径。",
    },
    exclusive: ["no_current_heating", "not_sure"],
    options: [
      ["heat_pump", "Heat pump", "热泵"],
      ["electric_heating", "Electric heater or electric heating system", "电暖器或其他电取暖系统"],
      ["piped_gas_heating", "Piped gas heating", "管道燃气取暖"],
      ["delivered_fuel_heating", "LPG, propane, or heating oil", "液化气、丙烷或燃油取暖"],
      ["solid_fuel_heating", "Wood, coal, pellets, or other solid fuel", "木材、煤炭、生物质颗粒或其他固体燃料"],
      ["district_or_shared_heating", "District or shared building heating", "区域供热或建筑集中供热"],
      ["passive_or_solar_heating", "Passive solar or solar heating support", "被动太阳能或太阳能辅助取暖"],
      ["no_current_heating", "No current heating system", "目前没有取暖系统"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
  {
    id: "current_cooling_methods",
    group: "Current setup",
    type: "checkbox",
    when: "cooling",
    label: { en: "How does this home currently stay cool?", zh: "这套住宅目前主要使用哪些方式降温？" },
    help: {
      en: "Select everything the home currently uses. This describes your starting point and does not limit the paths we compare.",
      zh: "请选择这套住宅目前实际使用的所有降温方式。这些信息只用于了解现状，不会限制后台比较的候选路径。",
    },
    exclusive: ["no_current_cooling", "not_sure"],
    options: [
      ["room_air_conditioning", "Room air conditioner", "房间空调，例如窗式、移动式或分体式空调"],
      ["central_air_conditioning", "Central air conditioning", "中央空调"],
      ["heat_pump_cooling", "Heat pump used for cooling", "使用热泵制冷"],
      ["evaporative_or_water_cooling", "Evaporative or water-based cooler", "蒸发式或水冷降温设备"],
      ["fans", "Ceiling or portable fans", "吊扇或移动风扇"],
      ["natural_or_passive_cooling", "Natural ventilation, shading, or other passive cooling", "自然通风、遮阳或其他被动降温"],
      ["district_or_shared_cooling", "District or shared building cooling", "区域供冷或建筑集中供冷"],
      ["no_current_cooling", "No current cooling system", "目前没有制冷系统"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
  {
    id: "upfront_cost_preference",
    group: "Practical preferences",
    type: "radio",
    label: { en: "How would you approach upfront cost?", zh: "你对前期投入的接受程度如何？" },
    options: [
      ["minimum_upfront", "Keep upfront cost as low as possible", "尽量降低前期投入"],
      ["moderate_investment", "A moderate investment is possible", "可以接受中等投入"],
      ["higher_if_saves_later", "I could invest more if long-term bills are lower", "如果长期账单更低，可以接受较高投入"],
      ["not_sure", "Not sure", "不确定"],
    ],
  },
];

const form = document.getElementById("feasibilityForm");
const localeSelect = document.getElementById("localeSelect");
const needsHeating = document.getElementById("needsHeating");
const needsCooling = document.getElementById("needsCooling");
const validationError = document.getElementById("validationError");
const g4Panel = document.getElementById("g4Panel");
const baselineSummary = document.getElementById("baselineSummary");

let locale = localStorage.getItem("locale") || (navigator.language.startsWith("zh") ? "zh" : "en");

function t(key) {
  return MESSAGES[locale][key] || MESSAGES.en[key] || key;
}

function visibleQuestions() {
  if (!needsHeating.checked && !needsCooling.checked) return [];
  return QUESTIONS.filter((question) => {
    if (question.when === "heating") return needsHeating.checked;
    if (question.when === "cooling") return needsCooling.checked;
    return true;
  });
}

function renderI18n() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  localeSelect.value = locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
}

function renderQuestion(question) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = question.label[locale];
  fieldset.appendChild(legend);
  if (question.help) {
    const help = document.createElement("p");
    help.className = "help";
    help.textContent = question.help[locale];
    fieldset.appendChild(help);
  }
  const cards = document.createElement("div");
  cards.className = "cards";
  question.options.forEach(([value, en, zh]) => {
    const label = document.createElement("label");
    label.className = "card-option";
    const input = document.createElement("input");
    input.type = question.type;
    input.name = question.id;
    input.value = value;
    if (question.type === "checkbox") {
      input.addEventListener("change", () => applyExclusion(question));
    }
    label.append(input, document.createTextNode(locale === "zh" ? zh : en));
    cards.appendChild(label);
  });
  fieldset.appendChild(cards);
  return fieldset;
}

function applyExclusion(question) {
  const exclusive = question.exclusive || [];
  const checked = [...form.querySelectorAll(`[name="${question.id}"]:checked`)];
  const exclusiveChecked = checked.find((item) => exclusive.includes(item.value));
  if (exclusiveChecked) {
    checked.forEach((item) => {
      if (item !== exclusiveChecked) item.checked = false;
    });
  }
}

function renderForm() {
  form.innerHTML = "";
  const questions = visibleQuestions();
  if (!questions.length) {
    const message = document.createElement("p");
    message.textContent = t("skipped");
    form.appendChild(message);
    return;
  }
  questions.forEach((question) => form.appendChild(renderQuestion(question)));
}

function collectValues(question) {
  const checked = [...form.querySelectorAll(`[name="${question.id}"]:checked`)].map((item) => item.value);
  return question.type === "radio" ? checked[0] : checked;
}

function validate() {
  const questions = visibleQuestions();
  return questions.every((question) => {
    const value = collectValues(question);
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

function summarizeBaseline() {
  const heatingQuestion = QUESTIONS.find((question) => question.id === "current_heating_methods");
  const coolingQuestion = QUESTIONS.find((question) => question.id === "current_cooling_methods");
  const labelFor = (question, value) => {
    const option = question.options.find(([optionValue]) => optionValue === value);
    return option ? option[locale === "zh" ? 2 : 1] : value;
  };
  const heating = needsHeating.checked
    ? [...form.querySelectorAll('[name="current_heating_methods"]:checked')].map((item) => labelFor(heatingQuestion, item.value))
    : [];
  const cooling = needsCooling.checked
    ? [...form.querySelectorAll('[name="current_cooling_methods"]:checked')].map((item) => labelFor(coolingQuestion, item.value))
    : [];
  baselineSummary.textContent = [
    needsHeating.checked ? `${t("heating")}: ${heating.join(" + ")}` : "",
    needsCooling.checked ? `${t("cooling")}: ${cooling.join(" + ")}` : "",
  ].filter(Boolean).join(" · ");
}

function submitG3() {
  if (!validate()) {
    validationError.classList.remove("hidden");
    return;
  }
  validationError.classList.add("hidden");
  g4Panel.classList.remove("hidden");
  summarizeBaseline();
  g4Panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function rerender() {
  renderI18n();
  renderForm();
  validationError.classList.add("hidden");
}

localeSelect.addEventListener("change", () => {
  locale = localeSelect.value;
  localStorage.setItem("locale", locale);
  const url = new URL(window.location.href);
  url.searchParams.set("lang", locale);
  history.replaceState(null, "", url);
  rerender();
});
needsHeating.addEventListener("change", rerender);
needsCooling.addEventListener("change", rerender);
document.getElementById("submitG3").addEventListener("click", submitG3);

const urlLocale = new URL(window.location.href).searchParams.get("lang");
if (urlLocale === "en" || urlLocale === "zh") locale = urlLocale;
rerender();
