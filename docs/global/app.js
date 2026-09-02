/**
 * 文案全部走 i18n/en.json + i18n/zh.json（规格 §5），由 i18n.js 运行时统一加载；
 * 这里原先的 ~110 键内联 MESSAGES 双语字典已整体迁入字典文件。
 * G3 问卷的题目/选项文案同在字典里（g3.q.<id>.label / .help / .opt.<value>），
 * QUESTIONS 只保留结构（id/type/when/exclusive/选项值）。
 */

const QUESTIONS = [
  { id: "housing_status", type: "radio", options: ["owner", "renter_permission", "renter_no_permission", "renter_not_sure", "other"] },
  { id: "building_type", type: "radio", options: ["detached", "semi_detached_or_row", "apartment", "mobile_or_temporary", "other", "not_sure"] },
  { id: "renovation_tolerance", type: "radio", options: ["none", "minor", "moderate", "major", "not_sure"] },
  { id: "outdoor_space", type: "radio", options: ["none", "wall_or_balcony", "small_yard_or_roof", "large_private_land", "not_sure"] },
  { id: "current_energy_services", type: "checkbox", exclusive: ["none", "not_sure"], options: ["electricity", "piped_gas", "delivered_fuel", "solid_fuel", "district_energy", "none", "not_sure"] },
  { id: "current_heating_methods", type: "checkbox", when: "heating", exclusive: ["no_current_heating", "not_sure"], hasHelp: true, options: ["heat_pump", "electric_heating", "piped_gas_heating", "delivered_fuel_heating", "solid_fuel_heating", "district_or_shared_heating", "passive_or_solar_heating", "no_current_heating", "not_sure"] },
  // D15（规格 §3.3 缺口的追问）：液化气与燃油单价差数倍，不区分就无法从账单反推需求
  { id: "delivered_fuel_kind", type: "radio", when: "heating", requiresOption: ["current_heating_methods", "delivered_fuel_heating"], options: ["lpg", "heating_oil", "not_sure"] },
  { id: "current_cooling_methods", type: "checkbox", when: "cooling", exclusive: ["no_current_cooling", "not_sure"], hasHelp: true, options: ["room_air_conditioning", "central_air_conditioning", "heat_pump_cooling", "evaporative_or_water_cooling", "fans", "natural_or_passive_cooling", "district_or_shared_cooling", "no_current_cooling", "not_sure"] },
  { id: "upfront_cost_preference", type: "radio", options: ["minimum_upfront", "moderate_investment", "higher_if_saves_later", "not_sure"] },
];

const form = document.getElementById("feasibilityForm");
const localeSelect = document.getElementById("localeSelect");
const needsHeating = document.getElementById("needsHeating");
const needsCooling = document.getElementById("needsCooling");
const validationError = document.getElementById("validationError");
const g4Panel = document.getElementById("g4Panel");
const baselineSummary = document.getElementById("baselineSummary");
const rankedPathsList = document.getElementById("rankedPathsList");
const selectedPathDetail = document.getElementById("selectedPathDetail");
const excludedList = document.getElementById("excludedList");
const explainButton = document.getElementById("explainSelectedPath");
const reportButton = document.getElementById("getAnalysisReport");
const aiPanel = document.getElementById("aiPanel");
const aiHeading = document.getElementById("aiHeading");
const aiTargetPath = document.getElementById("aiTargetPath");
const aiSubheading = document.getElementById("aiSubheading");
const aiStaleHint = document.getElementById("aiStaleHint");
const aiStatus = document.getElementById("aiStatus");
const aiContent = document.getElementById("aiContent");
const aiDisclaimer = document.getElementById("aiDisclaimer");
const continueToG7 = document.getElementById("continueToG7");
const g7Panel = document.getElementById("g7Panel");
const understandingChoices = document.getElementById("understandingChoices");
const aiHelpfulnessChoices = document.getElementById("aiHelpfulnessChoices");
const improvementText = document.getElementById("improvementText");
const feedbackHint = document.getElementById("feedbackHint");
const feedbackStatus = document.getElementById("feedbackStatus");
const feedbackThanks = document.getElementById("feedbackThanks");
const submitFeedbackButton = document.getElementById("submitFeedback");
const skipFeedbackButton = document.getElementById("skipFeedback");
const backToResultsButton = document.getElementById("backToResults");
const finishGlobalButton = document.getElementById("finishGlobal");
const saveSummaryButton = document.getElementById("saveSummaryButton");
const g6Panel = document.getElementById("g6Panel");
const g6CardHolder = document.getElementById("g6CardHolder");
const g6DownloadButton = document.getElementById("g6Download");
const g6BackButton = document.getElementById("g6Back");
const g6Status = document.getElementById("g6Status");

// 语言归 i18n.js 管（URL ?lang > localStorage > 浏览器语言）；它在本脚本之前同步初始化
let locale = (window.GlobalI18n && window.GlobalI18n.current) || "en";
let rankedPaths = [];
let excludedPaths = [];
/** 上一次打分时确实缺失的 LOCAL_PUBLIC 数据集，供 AI 上下文如实上报 */
let lastScoringMissing = [];
let selectedPathId = null;
let lastBaselineSummary = {};
let lastHomeFeasibilitySummary = {};
let scoringInputHash = null;
let aiAnalysis = window.G4AI.createIdleAiAnalysisState();
let feedbackState = "idle";
let aiUsedThisFlow = false;

function t(key) {
  // 字典由 i18n.js 加载；缺键时 GlobalI18n.t 返回键名本身，与旧 MESSAGES 行为一致
  return window.GlobalI18n ? window.GlobalI18n.t(key) : key;
}

function visibleQuestions() {
  if (!needsHeating.checked && !needsCooling.checked) return [];
  return QUESTIONS.filter((question) => {
    if (question.when === "heating" && !needsHeating.checked) return false;
    if (question.when === "cooling" && !needsCooling.checked) return false;
    return true;
  });
}

/** 追问是否处于激活态：requiresOption 指向的选项被勾选才算 */
function conditionActive(question) {
  if (!question.requiresOption) return true;
  const [name, value] = question.requiresOption;
  const trigger = form.querySelector(`[name="${name}"][value="${value}"]`);
  return Boolean(trigger && trigger.checked);
}

/** 勾选变化时切换追问的可见性；答案保留在 DOM，但收集/校验只认激活态的 */
function updateConditionalQuestions() {
  QUESTIONS.filter((q) => q.requiresOption).forEach((q) => {
    const fieldset = form.querySelector(`fieldset[data-question-id="${q.id}"]`);
    if (fieldset) fieldset.classList.toggle("hidden", !conditionActive(q));
  });
}

function renderI18n() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  localeSelect.value = locale;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
  renderFeedbackChoices();
  renderLocationEcho();
}

/** G2 里那行「地图选定的位置」回显。地区不再由表单录入，只从 G1 读。 */
function renderLocationEcho() {
  const echo = document.getElementById("g2LocationEcho");
  if (!echo || !window.G1Location) return;
  const geo = window.G1Location.getResolution();
  if (!window.G1Location.hasLocation()) {
    echo.textContent = t("g2.locationNone");
    return;
  }
  const country = (locale === "zh" ? geo.country_name_zh : geo.country_name_en) || geo.country_iso3;
  const admin1 = locale === "zh" ? geo.admin1_name_zh : geo.admin1_name_en;
  echo.textContent = admin1 ? `${country} · ${admin1}` : country;
}

function renderQuestion(question) {
  const fieldset = document.createElement("fieldset");
  fieldset.dataset.questionId = question.id;
  if (question.requiresOption && !conditionActive(question)) fieldset.classList.add("hidden");
  const legend = document.createElement("legend");
  legend.textContent = t(`g3.q.${question.id}.label`);
  fieldset.appendChild(legend);
  if (question.hasHelp) {
    const help = document.createElement("p");
    help.className = "help";
    help.textContent = t(`g3.q.${question.id}.help`);
    fieldset.appendChild(help);
  }
  const cards = document.createElement("div");
  cards.className = "cards";
  question.options.forEach((value) => {
    const label = document.createElement("label");
    label.className = "card-option";
    const input = document.createElement("input");
    input.type = question.type;
    input.name = question.id;
    input.value = value;
    if (question.type === "checkbox") {
      input.addEventListener("change", () => {
        applyExclusion(question);
        updateConditionalQuestions();
      });
    }
    label.append(input, document.createTextNode(t(`g3.q.${question.id}.opt.${value}`)));
    cards.appendChild(label);
  });
  fieldset.appendChild(cards);
  return fieldset;
}

function applyExclusion(question) {
  const exclusive = question.exclusive || [];
  const checked = [...form.querySelectorAll(`[name="${question.id}"]:checked`)];
  const exclusiveChecked = checked.find((item) => exclusive.includes(item.value));
  if (exclusiveChecked) checked.forEach((item) => { if (item !== exclusiveChecked) item.checked = false; });
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
  return visibleQuestions().filter(conditionActive).every((question) => {
    const value = collectValues(question);
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

function labelFor(question, value) {
  return question.options.includes(value) ? t(`g3.q.${question.id}.opt.${value}`) : value;
}

function summarizeBaseline() {
  const heatingQuestion = QUESTIONS.find((question) => question.id === "current_heating_methods");
  const coolingQuestion = QUESTIONS.find((question) => question.id === "current_cooling_methods");
  const heating = needsHeating.checked
    ? [...form.querySelectorAll('[name="current_heating_methods"]:checked')].map((item) => labelFor(heatingQuestion, item.value))
    : [];
  const cooling = needsCooling.checked
    ? [...form.querySelectorAll('[name="current_cooling_methods"]:checked')].map((item) => labelFor(coolingQuestion, item.value))
    : [];
  lastBaselineSummary = { heating, cooling };
  baselineSummary.textContent = [
    needsHeating.checked ? `${t("heating")}: ${heating.join(" + ")}` : "",
    needsCooling.checked ? `${t("cooling")}: ${cooling.join(" + ")}` : "",
  ].filter(Boolean).join(" · ");
}

function collectHomeFeasibilitySummary() {
  const result = {};
  visibleQuestions().filter(conditionActive).forEach((question) => {
    result[question.id] = collectValues(question);
  });
  return result;
}

/* ---------------------------------------------------------------------------
 * 已移除：makeRankedPath / buildDemoRankedPaths / buildExcludedPaths
 *
 * 它们返回三条写死的路径（fitness 83.3 / 74.1 / 71.8、年运行费 $1,240、
 * hdd18 3400），而页面上同时写着「所有分数均由你的回答、当地公开数据和
 * 确定性公式计算」。现在改由 docs/global/pipeline.js 调用真实的四维引擎。
 * ------------------------------------------------------------------------- */

/** 按当前语言取技术显示名（canonical contract 是 display_name_en / _zh） */
function pathName(path) {
  if (!path) return "";
  const primary = (locale === "zh" ? path.display_name_zh : path.display_name_en) || path.path_id;
  // 同一主技术可组成多条路径（搭配不同辅助措施），只显示主技术名会重名
  const support = path.supporting_measure_ids || [];
  if (!support.length) return primary;
  const names = window.G4Pipeline ? window.G4Pipeline.technologyNames() : {};
  const labels = support.map((id) => {
    const entry = names[id];
    return entry ? (locale === "zh" ? entry.zh : entry.en) : id;
  });
  return `${primary} + ${labels.join(" + ")}`;
}

/** fitness 可能为 null（insufficient_data）；不要显示成 0 */
function fitnessText(value) {
  return value == null ? "—" : String(value);
}

function warningText(warning) {
  if (typeof warning === "string") return warning;
  return (locale === "zh" ? warning.message_zh : warning.message_en) || warning.code || "";
}

function scoreLine(label, score) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const display = Math.round(safeScore); // 维度分显示取整；条宽保留原值
  return `<div class="score-line"><strong>${label}</strong><div class="bar"><span style="width:${safeScore}%"></span></div><span>${display}/100</span></div>`;
}

function money(value, currency) {
  // 货币跟随价格条目（estimates.currency），不再写死美元符号；金额取整显示
  if (value == null) return t("unavailable");
  const num = Math.round(Number(value)).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
  return currency ? `${num} ${currency}` : num;
}

function renderRankedPaths() {
  rankedPathsList.innerHTML = "";
  // D14：只差辅助措施且完全同分的路径合并为一行（详见 g4-ai-state.js 注释）
  window.G4AI.groupRankedPathsForDisplay(rankedPaths).forEach((group) => {
    const path = group.representative;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "path-row";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(path.path_id === selectedPathId));
    button.dataset.pathId = path.path_id;
    let label = escapeHtml(pathName(path));
    if (group.variants.length) {
      label += `<small class="variants">${escapeHtml(t("mergedVariants"))}${escapeHtml(group.variants.map(pathName).join(" / "))}</small>`;
    }
    button.innerHTML = `<span class="rank">#${path.rank}</span><span>${label}</span><span class="fitness">${fitnessText(path.fitness)}</span>`;
    button.addEventListener("click", () => {
      selectedPathId = window.G4AI.selectRankedPath(rankedPaths, path.path_id);
      renderG4();
    });
    rankedPathsList.appendChild(button);
  });
}

function renderSelectedPath() {
  const selected = window.G4AI.getSelectedPath(rankedPaths, selectedPathId);
  if (!selected) {
    selectedPathDetail.innerHTML = "";
    return;
  }
  selectedPathDetail.innerHTML = `
    <h3>${t("selectedPath")}</h3>
    <h2>${escapeHtml(pathName(selected))} <span class="fitness">${fitnessText(selected.fitness)}</span></h2>
    <p><strong>${t("overallFitness")}:</strong> ${fitnessText(selected.fitness)}/100</p>
    <div class="score-bars">
      ${scoreLine(t("affordability"), selected.dimensions.affordability)}
      ${scoreLine(t("climateResilience"), selected.dimensions.climate_resilience)}
      ${scoreLine(t("environmentalImpact"), selected.dimensions.environment)}
      ${scoreLine(t("practicality"), selected.dimensions.practicality)}
    </div>
    <h3>${t("keyEstimates")}</h3>
    <div class="detail-grid">
      <div class="detail-card"><strong>${t("annualRunCost")}</strong>${money(selected.estimates.annual_run_cost, selected.estimates.currency)} / yr</div>
      <div class="detail-card"><strong>${t("operatingBurden")}</strong>${selected.estimates.operating_burden_pct == null ? "—" : selected.estimates.operating_burden_pct.toFixed(1) + "%"}</div>
      <div class="detail-card"><strong>${t("upfrontCost")}</strong>${money(selected.estimates.upfront_cost, selected.estimates.currency)}</div>
      <div class="detail-card"><strong>${t("annualEmissions")}</strong>${selected.estimates.annual_emissions_kgco2e == null ? "—" : Math.round(selected.estimates.annual_emissions_kgco2e).toLocaleString() + " kg CO₂e"}</div>
      <div class="detail-card"><strong>${t("dataCoverage")}</strong>${Math.round((selected.score_coverage || 0) * 100)}%</div>
    </div>
    <h3>${t("warnings")}</h3>
    <ul>${(selected.warnings || []).map((warning) => `<li>${escapeHtml(warningText(warning))}</li>`).join("")}</ul>
  `;
}

function renderExcluded() {
  excludedList.innerHTML = excludedPaths
    .map((item) => {
      const name = escapeHtml(item.path_name || item.tech_id || "");
      const reason = escapeHtml(item.reason || (locale === "zh" ? item.reason_zh : item.reason_en) || "");
      return `<li><strong>${name}:</strong> ${reason}</li>`;
    })
    .join("");
}

function renderAiPanel() {
  const busy = aiAnalysis.status === "loading" || aiAnalysis.status === "streaming";
  const hasSelected = Boolean(window.G4AI.getSelectedPath(rankedPaths, selectedPathId));
  explainButton.disabled = !hasSelected || busy;
  reportButton.disabled = rankedPaths.length === 0 || busy;

  if (aiAnalysis.status === "idle" || !aiAnalysis.mode) {
    aiHeading.textContent = t("aiIdleHeading");
    aiSubheading.textContent = t("aiIdleHelper");
    aiTargetPath.classList.add("hidden");
    aiTargetPath.textContent = "";
    aiStaleHint.classList.add("hidden");
    aiStaleHint.textContent = "";
    aiStatus.textContent = "";
    aiStatus.className = "help";
    aiContent.innerHTML = "";
    aiDisclaimer.textContent = t("aiIdleDisclaimer");
    return;
  }

  if (aiAnalysis.mode === window.G4AI.MODES.selectedPath) {
    aiHeading.textContent = t("selectedHeading");
    aiSubheading.textContent = t("selectedSubheading");
    if (aiAnalysis.targetPathName) {
      aiTargetPath.classList.remove("hidden");
      aiTargetPath.textContent = aiAnalysis.targetPathName;
    } else {
      aiTargetPath.classList.add("hidden");
    }
  } else {
    aiHeading.textContent = t("reportHeading");
    aiSubheading.textContent = t("reportSubheading");
    aiTargetPath.classList.add("hidden");
    aiTargetPath.textContent = "";
  }

  if (window.G4AI.shouldShowPathMismatchHint(aiAnalysis, selectedPathId)) {
    aiStaleHint.classList.remove("hidden");
    aiStaleHint.textContent = t("stalePathHint");
  } else {
    aiStaleHint.classList.add("hidden");
    aiStaleHint.textContent = "";
  }

  if (aiAnalysis.status === "loading" || aiAnalysis.status === "streaming") {
    aiStatus.className = "warning";
    aiStatus.textContent = aiAnalysis.mode === window.G4AI.MODES.selectedPath ? t("selectedLoading") : t("reportLoading");
    aiDisclaimer.textContent = t("loadingDisclaimer");
  } else if (aiAnalysis.status === "error") {
    aiStatus.className = "error";
    aiStatus.textContent = t("aiError");
    aiDisclaimer.textContent = t("errorDisclaimer");
  } else {
    aiStatus.className = "help";
    aiStatus.textContent = "";
    aiDisclaimer.textContent = t("successDisclaimer");
  }

  if (aiAnalysis.content) {
    aiContent.innerHTML = renderMarkdown(aiAnalysis.content);
  } else if (aiAnalysis.status === "error" && aiAnalysis.error) {
    aiContent.textContent = aiAnalysis.error;
  } else {
    aiContent.innerHTML = "";
  }
}

function renderG4() {
  renderRankedPaths();
  renderSelectedPath();
  renderExcluded();
  renderAiPanel();
}

/**
 * 送给 AI 的上下文。
 *
 * 这里以前是一整块写死的值（United States / Illinois / Dfa / HDD 3400 /
 * 年收入 56000），无论用户实际在哪、填了什么都照发 —— 与 G4 那个已被删掉的
 * buildDemoRankedPaths() 是同一类问题，只是藏在提示词里更不容易被发现。
 * 现在全部取自 G1 的地图点击与 G2 的表单；取不到就送 null。
 * 规格核心原则：AI 只解释算出来的东西，不能被喂进编造的前提。
 */
function buildSharedAiInput() {
  const geo = window.G1Location ? window.G1Location.getResolution() : null;
  const climate = window.G1Location ? window.G1Location.getClimate() : null;
  const degreeDays = climate
    ? window.GlobalEngine.computeDegreeDays(climate)
    : { hdd18: null, cdd24: null };
  const g2 = collectHouseholdFromG2();

  return {
    locale,
    rankedPaths,
    selectedPathId,
    excludedPaths,
    regionSummary: {
      country: geo ? (locale === "zh" ? geo.country_name_zh : geo.country_name_en) || geo.country_iso3 : null,
      country_iso3: geo ? geo.country_iso3 : null,
      admin1: geo ? (locale === "zh" ? geo.admin1_name_zh : geo.admin1_name_en) : null,
      climate_zone: geo ? geo.koppen_code : null,
    },
    climateSummary: {
      hdd18: degreeDays.hdd18,
      cdd24: degreeDays.cdd24,
      data_resolution: window.GlobalEngine.describeDataResolution(geo, climate),
    },
    householdSummary: g2.household,
    homeFeasibilitySummary: lastHomeFeasibilitySummary,
    baselineSummary: lastBaselineSummary,
    // 由打分时实际加载的数据集 + 与引擎相同的地理解析生成（pipeline.js），
    // 每个字段带真实命中的值与层级；解析不到的字段不出现——缺失不得说成 "available"。
    relevantLocalPublicData: window.G4Pipeline.collectLocalPublicData(geo),
    missingLocalPublicData: lastScoringMissing,
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function renderMarkdown(markdown) {
  const escaped = escapeHtml(markdown);
  return escaped
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.*)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

function resetAiAnalysisState() {
  aiAnalysis = window.G4AI.resetAIAnalysis({ scoringInputHash });
}

async function requestAi(mode) {
  // Keep users on G4: no navigate(), no route change, no separate G5 page.
  const request = mode === window.G4AI.MODES.selectedPath
    ? window.G4AI.buildSelectedPathExplanationRequest(buildSharedAiInput())
    : window.G4AI.buildHouseholdAnalysisReportRequest(buildSharedAiInput());
  if (!request) return;
  if (aiAnalysis.status === "loading" || aiAnalysis.status === "streaming") return;

  // Behavioral flag: intentional AI trigger counts as used, even if the request fails.
  aiUsedThisFlow = true;
  window.G7Feedback.markAiUsed();

  const selected = window.G4AI.getSelectedPath(rankedPaths, selectedPathId);
  aiAnalysis = {
    mode,
    status: "loading",
    content: "",
    error: "",
    targetPathId: mode === window.G4AI.MODES.selectedPath ? (selected?.path_id || null) : null,
    targetPathName: mode === window.G4AI.MODES.selectedPath ? (selected?.path_name || "") : "",
    scoringInputHash,
  };
  renderG4();
  aiPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "AI request failed.");
    aiAnalysis = {
      ...aiAnalysis,
      status: "success",
      content: data.analysis || "",
      error: "",
    };
  } catch (error) {
    aiAnalysis = {
      ...aiAnalysis,
      status: "error",
      content: "",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    renderG4();
  }
}


/** 读取 G2 家庭与地区输入。空值一律给 null / undefined，不填默认数字。 */
function collectHouseholdFromG2() {
  const num = (id) => {
    const el = document.getElementById(id);
    if (!el || el.value === "") return undefined;
    const v = Number(el.value);
    return Number.isFinite(v) ? v : undefined;
  };
  const str = (id) => {
    const el = document.getElementById(id);
    return el && el.value ? el.value.trim() : "";
  };
  return {
    household: {
      household_size: num("g2HouseholdSize") ?? 1,
      currency: str("g2Currency") || "USD",
      annual_income: num("g2Income"),
      floor_area_m2: num("g2FloorArea"),
      needs_heating: needsHeating.checked,
      heating_spend_annual: num("g2HeatingSpend"),
      needs_cooling: needsCooling.checked,
      cooling_spend_annual: num("g2CoolingSpend"),
    },
    // 地区不再由表单录入。country_iso3 / admin1_code / koppen_code 全部来自
    // G1 的地图点击（docs/global/g1.js），未选点时为 null，submitG3 会先拦下。
    geo: window.G1Location ? window.G1Location.getScoringGeo() : null,
  };
}

function renderDataGapNotice(missing) {
  const el = document.getElementById("dataGapNotice");
  if (!el) return;
  if (!missing || missing.length === 0) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML =
    `${escapeHtml(t("missingDataIntro"))} <code>${missing.map(escapeHtml).join("</code>, <code>")}</code>. ` +
    escapeHtml(t("missingDataOutro"));
}

function renderUnrankable(list) {
  const block = document.getElementById("unrankableBlock");
  const ul = document.getElementById("unrankableList");
  if (!block || !ul) return;
  if (!list || list.length === 0) {
    block.classList.add("hidden");
    ul.innerHTML = "";
    return;
  }
  block.classList.remove("hidden");
  ul.innerHTML = list
    .map((path) => {
      const notes = (path.data_notes || [])
        .map((n) => (locale === "zh" ? n.note_zh : n.note_en))
        .filter(Boolean);
      return `<li><strong>${escapeHtml(pathName(path))}</strong>${
        notes.length ? `: ${escapeHtml(notes[0])}` : ""
      }</li>`;
    })
    .join("");
}

function submitG3() {
  // G1 是主流程的第一步：没有地点就没有气候，Affordability 与 Climate 两维直接不可算。
  // 与其让用户走到 G4 再看到一片 insufficient_data，不如在这里就说清楚。
  // 改 data-i18n 而不是直接写 textContent：renderI18n 按这个 key 翻译，
  // 于是切换语言时错误提示会跟着变，而不是退回成那句通用文案。
  if (!window.G1Location || !window.G1Location.hasLocation()) {
    validationError.dataset.i18n = "g1Required";
    validationError.textContent = t("g1Required");
    validationError.classList.remove("hidden");
    document.getElementById("g1Canvas")?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!validate()) {
    validationError.dataset.i18n = "validationError";
    validationError.textContent = t("validationError");
    validationError.classList.remove("hidden");
    return;
  }
  validationError.classList.add("hidden");
  summarizeBaseline();
  lastHomeFeasibilitySummary = collectHomeFeasibilitySummary();
  const nextHash = window.G4AI.buildScoringInputHash({
    needsHeating: needsHeating.checked,
    needsCooling: needsCooling.checked,
    homeFeasibility: lastHomeFeasibilitySummary,
    baseline: lastBaselineSummary,
  });
  scoringInputHash = nextHash;
  resetAiAnalysisState();
  aiUsedThisFlow = false;
  window.G7Feedback.clearAiUsedForNewFlow();
  const g2 = collectHouseholdFromG2();
  g4Panel.classList.remove("hidden");
  g7Panel.classList.add("hidden");
  g6Panel.classList.add("hidden");
  g6CardHolder.innerHTML = ""; // Adjust inputs 后必须用新的 rankedPaths[0]，不复用旧卡
  saveSummaryButton.classList.add("hidden");
  feedbackState = "idle";
  feedbackThanks.classList.add("hidden");
  finishGlobalButton.classList.add("hidden");
  rankedPathsList.innerHTML = `<p>${escapeHtml(t("computing"))}</p>`;
  g4Panel.scrollIntoView({ behavior: "smooth", block: "start" });

  window.G4Pipeline.runScoring({
    household: g2.household,
    feasibility: lastHomeFeasibilitySummary,
    geo: g2.geo,
  })
    .then((result) => {
      rankedPaths = result.ranked;
      excludedPaths = result.excluded;
      lastScoringMissing = result.missing || [];
      selectedPathId = window.G4AI.getInitialSelectedPathId(rankedPaths);
      saveSummaryButton.classList.toggle("hidden", !rankedPaths.length || rankedPaths[0].fitness === null);
      renderDataGapNotice(result.missing);
      renderUnrankable(result.unrankable);
      renderG4();
      if (rankedPaths.length === 0) {
        rankedPathsList.innerHTML = `<p>${escapeHtml(t("scoringUnavailable"))}</p>`;
      }
    })
    .catch((error) => {
      console.error("[G4] scoring failed", error);
      rankedPaths = [];
      excludedPaths = [];
      renderG4();
      rankedPathsList.innerHTML = `<p class="error">${escapeHtml(String(error && error.message ? error.message : error))}</p>`;
    });
}

function renderFeedbackChoices() {
  const understandingSelected = formValue("helped_understand_score");
  understandingChoices.innerHTML = "";
  [
    ["1", "feedbackUnderstanding1"],
    ["2", "feedbackUnderstanding2"],
    ["3", "feedbackUnderstanding3"],
    ["4", "feedbackUnderstanding4"],
    ["5", "feedbackUnderstanding5"],
  ].forEach(([value, key]) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "helped_understand_score";
    input.value = value;
    if (understandingSelected === value) input.checked = true;
    label.append(input, document.createTextNode(t(key)));
    understandingChoices.appendChild(label);
  });

  const aiSelected =
    formValue("ai_helpfulness") ||
    (aiUsedThisFlow || window.G7Feedback.readAiUsed()
      ? ""
      : window.G7Feedback.suggestedAiHelpfulness(false));
  aiHelpfulnessChoices.innerHTML = "";
  [
    ["1", "feedbackAi1"],
    ["2", "feedbackAi2"],
    ["3", "feedbackAi3"],
    ["4", "feedbackAi4"],
    ["5", "feedbackAi5"],
    ["not_used", "feedbackAiNotUsed"],
  ].forEach(([value, key]) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "ai_helpfulness";
    input.value = value;
    if (aiSelected === value) input.checked = true;
    label.append(input, document.createTextNode(t(key)));
    aiHelpfulnessChoices.appendChild(label);
  });
}

function formValue(name) {
  return g7Panel.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function collectFeedbackAnswers() {
  // 这两个字段以前写死成 USA / Illinois，也就是说入库的每一条反馈都标着同一个地点。
  // 反馈是要拿来当研究证据的，地点必须是用户真实点选的那个，没有就送 null。
  const geo = window.G1Location ? window.G1Location.getResolution() : null;
  return window.G7Feedback.buildFeedbackPayload({
    locale,
    country_iso3: geo && geo.country_iso3 ? geo.country_iso3 : undefined,
    admin1_name: geo ? geo.admin1_name_en : null,
    helped_understand_score: formValue("helped_understand_score"),
    ai_helpfulness: formValue("ai_helpfulness"),
    improvement_text: improvementText.value,
    ai_used: aiUsedThisFlow || window.G7Feedback.readAiUsed(),
  });
}

function setFeedbackBusy(busy) {
  submitFeedbackButton.disabled = busy;
  skipFeedbackButton.disabled = busy;
  continueToG7.disabled = busy;
}

function showThanksState(message) {
  feedbackState = "success";
  feedbackStatus.textContent = "";
  feedbackHint.classList.add("hidden");
  feedbackThanks.classList.remove("hidden");
  feedbackThanks.textContent = message || t("feedbackSuccess");
  finishGlobalButton.classList.remove("hidden");
  setFeedbackBusy(false);
  submitFeedbackButton.disabled = true;
}

function finishWithoutFeedback() {
  showThanksState(
    locale === "zh"
      ? "已跳过反馈。你的结果与 AI 分析不受影响。"
      : "Feedback skipped. Your results and AI analysis are unchanged.",
  );
}

function openG7() {
  g7Panel.classList.remove("hidden");
  feedbackState = "idle";
  feedbackHint.classList.add("hidden");
  feedbackStatus.textContent = "";
  feedbackThanks.classList.add("hidden");
  finishGlobalButton.classList.add("hidden");
  submitFeedbackButton.disabled = false;
  skipFeedbackButton.disabled = false;
  renderFeedbackChoices();
  g7Panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitFeedback() {
  if (feedbackState === "submitting") return;
  const payload = collectFeedbackAnswers();
  if (window.G7Feedback.isEmptyFeedback(payload)) {
    feedbackHint.classList.remove("hidden");
    feedbackHint.textContent = t("feedbackEmptyHint");
    return;
  }

  feedbackState = "submitting";
  feedbackHint.classList.add("hidden");
  feedbackStatus.className = "help";
  feedbackStatus.textContent = t("feedbackSubmitting");
  setFeedbackBusy(true);

  try {
    const response = await fetch("/api/global-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Feedback request failed.");
    showThanksState(t("feedbackSuccess"));
  } catch (_error) {
    feedbackState = "error";
    feedbackStatus.className = "error";
    feedbackStatus.textContent = t("feedbackError");
    setFeedbackBusy(false);
    // Skip remains available after error.
    skipFeedbackButton.disabled = false;
  }
}

/* ---------------- G6 · Action Summary（规格 §G6） ----------------
 * 只读 rankedPaths[0]（算法 Best-fit，绝不用 selectedPathId），不重算任何分数，
 * 不经过 AI。卡片 HTML 自包含（内联样式），导出 PNG 与所见一致。
 * 隐私（CS-DECISIONS D12，规格 §1935/§1990 矛盾的自裁）：
 *   - 不显示收入/账单原始值；
 *   - 年运行费按规格精确显示；
 *   - 负担率只显示档位（<3% / 3–6% / 6–10% / >10%，档界取燃料贫困研究惯用线），
 *     由卡片只能反推出约 2 倍宽的收入区间，无法精确还原。
 */

function g6BurdenBandKey(pct) {
  if (pct < 3) return "g6card.burdenBand.low";
  if (pct < 6) return "g6card.burdenBand.moderate";
  if (pct <= 10) return "g6card.burdenBand.high";
  return "g6card.burdenBand.veryHigh";
}

function g6RegionLabel() {
  const geo = window.G1Location ? window.G1Location.getResolution() : null;
  if (!geo) return null;
  const country = (locale === "zh" ? geo.country_name_zh : geo.country_name_en) || geo.country_iso3;
  const admin1 = locale === "zh" ? geo.admin1_name_zh : geo.admin1_name_en;
  const iso3 = (geo.country_iso3 || "").toUpperCase();
  // 规格：中美精确到省/州，其余只到国家；绝不显示坐标。
  if ((iso3 === "CHN" || iso3 === "USA") && admin1) {
    return locale === "zh" ? `${country} · ${admin1}` : `${admin1}, ${country}`;
  }
  return country;
}

function g6FormatMoney(value, currency) {
  const rounded = Math.round(value);
  const num = rounded.toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
  return currency ? `${num} ${currency}` : num;
}

function g6FormatEmissions(kg) {
  if (kg >= 1000) {
    const t = (kg / 1000).toFixed(1);
    return locale === "zh" ? `${t} 吨 CO2e` : `${t} t CO2e`;
  }
  return `${Math.round(kg).toLocaleString()} kg CO2e`;
}

/** 规格 §G6 Main strengths：加权贡献排序取前 2 个非 null 维度（不经 AI） */
function g6MainStrengths(path) {
  const weights = { affordability: 0.35, climate_resilience: 0.3, environment: 0.2, practicality: 0.15 };
  const labels = {
    affordability: "affordability",
    climate_resilience: "climateResilience",
    environment: "environmentalImpact",
    practicality: "practicality",
  };
  return Object.keys(weights)
    .filter((k) => path.dimensions[k] !== null && path.dimensions[k] !== undefined)
    .map((k) => ({ k, contribution: weights[k] * path.dimensions[k] }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2)
    .map((item) => t(labels[item.k]));
}

function renderG6Card() {
  const path = rankedPaths[0];
  if (!path) return;
  const name = locale === "zh" ? path.display_name_zh : path.display_name_en;
  const est = path.estimates || {};
  const region = g6RegionLabel();
  const dims = [
    ["affordability", path.dimensions.affordability],
    ["climateResilience", path.dimensions.climate_resilience],
    ["environmentalImpact", path.dimensions.environment],
    ["practicality", path.dimensions.practicality],
  ];

  const estimates = [];
  if (est.annual_run_cost !== null && est.annual_run_cost !== undefined) {
    estimates.push(`${t("g6card.runCost")} · ${g6FormatMoney(est.annual_run_cost, est.currency)} ${t("g6card.perYear")}`);
  } else {
    estimates.push(t("g6card.runCostUnavailable"));
  }
  if (est.upfront_cost !== null && est.upfront_cost !== undefined) {
    estimates.push(`${t("g6card.upfront")} · ${g6FormatMoney(est.upfront_cost, est.currency)}`);
  } else {
    estimates.push(t("g6card.upfrontUnavailable"));
  }
  // D12：负担率只给档位。null 时整行隐藏（规格允许隐藏无意义行，不显示假值）。
  if (est.operating_burden_pct !== null && est.operating_burden_pct !== undefined) {
    estimates.push(`${t("g6card.burden")} · ${t(g6BurdenBandKey(est.operating_burden_pct))}`);
  }
  if (est.annual_emissions_kgco2e !== null && est.annual_emissions_kgco2e !== undefined) {
    estimates.push(`${t("g6card.emissions")} · ${g6FormatEmissions(est.annual_emissions_kgco2e)} ${t("g6card.perYear")}`);
  } else {
    estimates.push(t("g6card.emissionsUnavailable"));
  }

  const strengths = g6MainStrengths(path);
  const warnings = (path.warnings || []).slice(0, 3)
    .map((w) => (locale === "zh" ? w.message_zh : w.message_en))
    .filter(Boolean);
  const coverage = Math.round((path.score_coverage || 0) * 100);

  const S = {
    card: "width:560px;max-width:100%;background:#fff;color:#1c2733;border:1px solid #cfd8e3;padding:28px 30px;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;line-height:1.45;",
    title: "margin:0 0 14px;font-size:15px;letter-spacing:0.14em;color:#20507a;",
    row: "display:flex;justify-content:space-between;gap:12px;margin:3px 0;font-size:14px;",
    sec: "margin:16px 0 6px;font-size:11px;letter-spacing:0.12em;color:#5a6b7d;",
    big: "font-size:19px;font-weight:600;margin:2px 0 10px;",
    small: "font-size:11px;color:#5a6b7d;margin-top:14px;",
    li: "font-size:13px;margin:3px 0 3px 16px;",
  };
  const esc = escapeHtml;
  const parts = [];
  parts.push(`<div id="g6CardNode" style="${S.card}">`);
  parts.push(`<div style="${S.title}">${esc(t("g6card.title"))}</div>`);
  if (region) parts.push(`<div style="${S.row}"><span>${esc(t("g6card.region"))}</span><strong>${esc(region)}</strong></div>`);
  parts.push(`<div style="${S.sec}">${esc(t("g6card.bestFit"))}</div>`);
  parts.push(`<div style="${S.big}">${esc(name)}</div>`);
  parts.push(`<div style="${S.row}"><span>${esc(t("g6card.fitness"))}</span><strong>${esc(path.fitness.toFixed(1))} / 100</strong></div>`);
  dims.forEach(([key, value]) => {
    if (value === null || value === undefined) return; // §7.11：null 维度不显示假值
    parts.push(`<div style="${S.row}"><span>${esc(t(key))}</span><span>${esc(String(Math.round(value)))}</span></div>`);
  });
  parts.push(`<div style="${S.sec}">${esc(t("g6card.keyEstimates"))}</div>`);
  estimates.forEach((line) => parts.push(`<div style="${S.row.replace("space-between", "flex-start")}">${esc(line)}</div>`));
  if (strengths.length) {
    parts.push(`<div style="${S.sec}">${esc(t("g6card.strengths"))}</div>`);
    parts.push(`<div style="font-size:14px;">${esc(strengths.join(" · "))}</div>`);
  }
  parts.push(`<div style="${S.sec}">${esc(t("g6card.confirmNext"))}</div>`);
  if (warnings.length) {
    warnings.forEach((w) => parts.push(`<div style="${S.li}">• ${esc(w)}</div>`));
  } else {
    parts.push(`<div style="font-size:13px;">${esc(t("g6card.noWarnings"))}</div>`);
  }
  parts.push(`<div style="${S.row};margin-top:14px;"><span>${esc(t("g6card.coverage"))}</span><span>${coverage}%</span></div>`);
  if (coverage < 100) parts.push(`<div style="font-size:12px;color:#8a5a1f;">${esc(t("g6card.preliminary"))}</div>`);
  parts.push(`<div style="${S.small}">${esc(t("g6card.disclaimer"))}</div>`);
  parts.push(`<div style="${S.small}">${esc(t("g6card.footer"))}</div>`);
  parts.push("</div>");
  g6CardHolder.innerHTML = parts.join("");
}

function openG6() {
  // 规格：G6 永远只总结算法 #1；不可评分时按钮本就不显示，这里再守一道。
  if (!rankedPaths.length || rankedPaths[0].fitness === null) return;
  renderG6Card();
  g6Status.textContent = "";
  g6Panel.classList.remove("hidden");
  g6Panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** HTML 卡片 → SVG foreignObject → canvas → PNG。全自包含，无外部库/资源。 */
function downloadG6Png() {
  const node = document.getElementById("g6CardNode");
  if (!node) return;
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const xhtml = new XMLSerializer().serializeToString(node);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${xhtml}</div></foreignObject></svg>`;
  // data: URL 而不是 blob URL——Chromium 对 blob 源的 foreignObject SVG 会把画布
  // 判成 tainted，toBlob 抛 SecurityError；data: URL 走安全静态图路径，可导出。
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const img = new Image();
  img.onload = () => {
    try {
      const scale = 2; // 2x 导出，分享时文字清晰
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx2d = canvas.getContext("2d");
      ctx2d.scale(scale, scale);
      ctx2d.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          g6Status.textContent = t("g6SaveFailed");
          return;
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "home-energy-summary.png";
        a.click();
        URL.revokeObjectURL(a.href);
        g6Status.textContent = t("g6Saved");
      }, "image/png");
    } catch (error) {
      console.error("[G6] PNG export failed", error);
      g6Status.textContent = t("g6SaveFailed");
    }
  };
  img.onerror = () => {
    g6Status.textContent = t("g6SaveFailed");
  };
  img.src = url;
}

function rerender() {
  renderI18n();
  renderForm();
  validationError.classList.add("hidden");
  if (!g4Panel.classList.contains("hidden")) {
    summarizeBaseline();
    renderG4();
  }
  if (!g7Panel.classList.contains("hidden") && feedbackState !== "success") {
    renderFeedbackChoices();
  }
  if (!g6Panel.classList.contains("hidden")) {
    renderG6Card();
  }
}

// 语言切换统一由 i18n.js 处理（存储、URL 同步、data-i18n 静态节点替换），
// 它随后广播 localechange —— 这里只负责动态渲染部分跟着切换。
window.addEventListener("localechange", (event) => {
  locale = event.detail.locale;
  if (window.G1Location) window.G1Location.setLocale(locale);
  rerender();
});

needsHeating.addEventListener("change", rerender);
needsCooling.addEventListener("change", rerender);
document.getElementById("submitG3").addEventListener("click", submitG3);
explainButton.addEventListener("click", () => requestAi(window.G4AI.MODES.selectedPath));
reportButton.addEventListener("click", () => requestAi(window.G4AI.MODES.householdReport));
continueToG7.addEventListener("click", openG7);
saveSummaryButton.addEventListener("click", openG6);
g6DownloadButton.addEventListener("click", downloadG6Png);
g6BackButton.addEventListener("click", () => {
  g4Panel.scrollIntoView({ behavior: "smooth", block: "start" });
});
submitFeedbackButton.addEventListener("click", submitFeedback);
skipFeedbackButton.addEventListener("click", finishWithoutFeedback);
backToResultsButton.addEventListener("click", () => {
  g4Panel.scrollIntoView({ behavior: "smooth", block: "start" });
});
finishGlobalButton.addEventListener("click", () => {
  g7Panel.scrollIntoView({ behavior: "smooth", block: "start" });
});

// 首次渲染等 i18n.js 的字典就绪（它会广播 localechange → rerender），
// 避免闪现未翻译的键名；字典加载失败（离线等）时兜底渲染一次，键名总比白屏好。
window.setTimeout(() => {
  if (document.body.getAttribute("data-i18n-state") !== "ready") rerender();
}, 1500);

/* G1 地图。地区从这里进入主流程，G2 只回显。 */
if (window.G1Location) {
  window.G1Location.onChange(renderLocationEcho);
  window.G1Location.init({ locale }).then((ok) => {
    if (!ok) console.error("[G1] 地图初始化失败，地区将无法选择");
  });
}
