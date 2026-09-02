/**
 * G4 真实打分管线。
 *
 * 取代原来的 buildDemoRankedPaths()：那个函数返回三条写死的路径
 * （83.3 / 74.1 / 71.8），同时页面上写着「所有分数均由你的回答、当地公开数据
 * 和确定性公式计算」。现在分数确实由 docs/src/scoring 的四维引擎算出。
 *
 * 数据现状（2026-08-18）：
 *   - `docs/data/climate/*.json` 已由 scripts/fetch_climate_data.py 抓取落地
 *     （NASA POWER 1991-2020，中美 82 个省州首府 + 30 个 Koppen 气候区）。
 *   - `docs/data/scoring/*.json` 仍是骨架（`_status: "AWAITING_DATA"`，entries 为空）。
 *
 * 因此本管线目前仍会对多数路径返回 insufficient_data —— 这是正确行为，不是 bug。
 * 规格 §7.4 明令禁止用「合理默认值」把空缺填上；缺哪几份数据由 missingDatasets()
 * 如实报给 G4 页面。
 */
(function () {
  "use strict";

  var CATALOG_URL = "/docs/data/technologies/technology_catalog.json";
  var SCORING_FILES = {
    residential_energy_prices: "/docs/data/scoring/residential_energy_prices.json",
    technology_performance: "/docs/data/scoring/technology_performance.json",
    technology_installed_costs: "/docs/data/scoring/technology_installed_costs.json",
    electricity_emission_factors: "/docs/data/scoring/electricity_emission_factors.json",
    fuel_emission_factors: "/docs/data/scoring/fuel_emission_factors.json",
    infrastructure_availability: "/docs/data/scoring/infrastructure_availability.json",
  };
  var CLIMATE_FILES = {
    cn_us: "/docs/data/climate/cn_us_admin1_capitals.json",
    koppen: "/docs/data/climate/climate_profiles.json",
  };

  var cache = { catalog: null, scoring: null, climate: null };

  /** 缺文件返回 null —— 引擎据此走 §7.11 missing 分支 */
  function fetchJsonOrNull(url) {
    return fetch(url, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  function loadCatalog() {
    if (cache.catalog) return Promise.resolve(cache.catalog);
    return fetchJsonOrNull(CATALOG_URL).then(function (json) {
      cache.catalog = json || [];
      return cache.catalog;
    });
  }

  function loadScoringData() {
    if (cache.scoring) return Promise.resolve(cache.scoring);
    var keys = Object.keys(SCORING_FILES);
    return Promise.all(keys.map(function (k) { return fetchJsonOrNull(SCORING_FILES[k]); }))
      .then(function (results) {
        var bundle = {};
        keys.forEach(function (k, i) { bundle[k] = results[i]; });
        cache.scoring = bundle;
        return bundle;
      });
  }

  function loadClimateSources() {
    if (cache.climate) return Promise.resolve(cache.climate);
    return Promise.all([fetchJsonOrNull(CLIMATE_FILES.cn_us), fetchJsonOrNull(CLIMATE_FILES.koppen)])
      .then(function (r) {
        cache.climate = { cn_us: r[0], koppen: r[1] };
        return cache.climate;
      });
  }

  /** 哪些 LOCAL_PUBLIC 数据集缺失，用于在 G4 上如实说明为什么算不出分 */
  function isEmptyDataset(ds) {
    if (!ds) return true;
    if (ds._status === "AWAITING_DATA") return true;
    var entries = ds.entries || ds.profiles;
    if (!entries) return true;
    return Array.isArray(entries) ? entries.length === 0 : Object.keys(entries).length === 0;
  }

  /** 文件存在但 entries 为空同样算缺失 —— 骨架文件不是数据 */
  function missingDatasets(scoring, climate) {
    var missing = [];
    Object.keys(SCORING_FILES).forEach(function (k) {
      if (isEmptyDataset(scoring[k])) missing.push(k);
    });
    if (isEmptyDataset(climate.cn_us) && isEmptyDataset(climate.koppen)) {
      missing.push("climate_profiles");
    }
    return missing;
  }

  /**
   * 由 G1 地图点击得到的 geo 查气候档案。
   * 中美走省/州首府气候，其余国家走 Köppen 标准 profile（规格 §G1 两档）。
   * 数据文件不存在或没有对应记录时返回 null，气候维随之不可算。
   */
  function resolveClimate(sources, geo) {
    if (!geo) return null;
    var iso3 = (geo.country_iso3 || "").toUpperCase();

    if ((iso3 === "CHN" || iso3 === "USA") && sources.cn_us && geo.admin1_code) {
      var row = (sources.cn_us.entries || []).find(function (e) {
        return e.country_iso3 === iso3 && e.admin1_code === geo.admin1_code;
      });
      if (row) {
        // capital_name 等字段在 row 上而不在 row.climate 里，但 G1 气候卡要显示
        // 「Capital used for climate」，所以在这里一并带出来。打分引擎只读 climate
        // 部分，多带几个显示字段不影响它。
        return Object.assign({}, row.climate, {
          source_kind: "admin1_capital",
          _vintage: sources.cn_us._vintage,
          capital_name: row.capital_name,
          capital_name_zh: row.capital_name_zh,
          admin1_name_en: row.admin1_name_en,
          admin1_name_zh: row.admin1_name_zh,
          koppen_code: row.koppen_code,
          source_name: row.source_name,
        });
      }
      return null;
    }

    if (sources.koppen && geo.koppen_code) {
      var profiles = sources.koppen.profiles || [];
      var profile = profiles.find(function (p) {
        return p.koppen_code === geo.koppen_code;
      });

      // 规格 §G1 Step 3：细分类查不到就回退到主类 A/B/C/D/E。
      // 返回的 koppen_code 始终是**命中的那条 profile 的**码，与请求码不同即说明
      // 走了回退 —— describeDataResolution() 靠这个差异区分两种 data_resolution，
      // 所以这里不要改成回填请求码。
      if (!profile) {
        var mainGroup = String(geo.koppen_code).charAt(0).toUpperCase();
        if ("ABCDE".indexOf(mainGroup) >= 0) {
          profile = profiles.find(function (p) {
            return p.koppen_code === mainGroup;
          });
        }
      }

      if (profile) {
        return Object.assign({}, profile.climate, {
          source_kind: "koppen_profile",
          _vintage: sources.koppen._vintage,
          koppen_code: profile.koppen_code,
          display_name_en: profile.display_name_en,
          display_name_zh: profile.display_name_zh,
          source_name: profile.source_name,
        });
      }
    }
    return null;
  }

  /**
   * 跑完整的 G3 → 硬筛选 → 候选路径 → 四维打分。
   * @returns {Promise<{ranked, unrankable, excluded, warnings, missing, climate}>}
   */
  function runScoring(input) {
    var E = window.GlobalEngine;
    if (!E) {
      return Promise.reject(new Error("GlobalEngine bundle is not loaded"));
    }

    return Promise.all([loadCatalog(), loadScoringData(), loadClimateSources()]).then(function (r) {
      var catalogRaw = r[0];
      var scoring = r[1];
      var climateSources = r[2];

      var climate = resolveClimate(climateSources, input.geo) || {};
      var catalogById = new Map(catalogRaw.map(function (t) { return [t.tech_id, t]; }));

      // 硬筛选用的精简技术档案（只取客观字段）
      var techProfiles = catalogRaw.map(function (t) {
        return {
          tech_id: t.tech_id,
          display_name_en: t.display_name_en,
          display_name_zh: t.display_name_zh,
          services: t.services,
          installation_level: t.screening.installation_level,
          outdoor_space_required: t.screening.outdoor_space_required,
          permanent_modification_required: t.screening.permanent_modification_required,
          data_confidence: "medium",
          role: t.role,
          catalog_status: t.catalog_status,
          ranking_mode: t.ranking_mode,
        };
      });

      var region = { region_id: input.geo.admin1_code || input.geo.country_iso3 || "unknown", label_en: "", infrastructure: {} };
      var baseline = E.buildBaselineProfile(input.household, input.feasibility, region);
      var screening = E.screenTechnologies(region, climate, input.household, input.feasibility, techProfiles);
      var paths = E.generateCandidatePaths(
        screening.passed, baseline, region, climate, input.household, techProfiles,
      );

      var out = E.scorePaths(paths, {
        household: input.household,
        feasibility: input.feasibility,
        climate: climate,
        geo: input.geo,
        data: scoring,
        catalog: catalogById,
      });

      return {
        ranked: out.ranked,
        unrankable: out.unrankable,
        excluded: screening.excluded,
        warnings: screening.warnings,
        missing: missingDatasets(scoring, climateSources),
        climate: climate,
        baseline: baseline,
      };
    });
  }

  /**
   * 供 AI 上下文用的 relevant_local_public_data：
   * 用与打分引擎**完全相同**的数据集与地理解析逻辑（resolveScoringValue 的
   * network/local → admin1 → country 回退），报告每个字段实际命中的值与层级。
   * 解析不到的字段直接不出现 —— 缺失不得说成 "available"（规格 §0.5/§7.11）。
   * 之前这里是半写死的（永远宣称 admin1 层级有电价），现在是真实命中结果。
   */
  var LOCAL_PUBLIC_FIELDS = [
    { dataset: "residential_energy_prices", subject: "electricity", field: "electricity_price_residential", unit: "/kWh" },
    { dataset: "residential_energy_prices", subject: "natural_gas", field: "natural_gas_price_residential", unit: "/kWh" },
    { dataset: "electricity_emission_factors", subject: "grid", field: "grid_emission_factor", unit: " kgCO2e/kWh" },
    { dataset: "fuel_emission_factors", subject: "natural_gas", field: "natural_gas_emission_factor", unit: " kgCO2e/kWh" },
    { dataset: "infrastructure_availability", subject: "district_heating_network", field: "district_heating_network_present", unit: "" },
    { dataset: "infrastructure_availability", subject: "piped_gas", field: "piped_gas_network_present", unit: "" },
  ];

  function collectLocalPublicData(geo) {
    var E = window.GlobalEngine;
    if (!cache.scoring || !E || !E.resolveScoringValue || !geo) return [];
    var query = {
      country_iso3: geo.country_iso3 || undefined,
      admin1_code: geo.admin1_code || undefined,
      local_code: geo.local_code || undefined,
      network_code: geo.network_code || undefined,
    };
    var out = [];
    LOCAL_PUBLIC_FIELDS.forEach(function (spec) {
      var point = E.resolveScoringValue(cache.scoring[spec.dataset], spec.subject, query);
      if (!point) return;
      var value = point.value;
      if (typeof value === "number") {
        value = String(value) + (point.currency ? " " + point.currency : "") + spec.unit;
      } else {
        value = String(value);
      }
      out.push({
        field: spec.field,
        value: value,
        geographic_level: point.geography && point.geography.level,
        source_name: point.source_name || null,
      });
    });
    return out;
  }

  /** tech_id → { en, zh }，供 UI 显示辅助措施名称 */
  function technologyNames() {
    var map = {};
    (cache.catalog || []).forEach(function (t) {
      map[t.tech_id] = { en: t.display_name_en, zh: t.display_name_zh };
    });
    return map;
  }

  /**
   * G1 气候卡专用：按地图点击结果查真实气候档案。
   *
   * G1 上的 "Data source" 标签**必须**基于这里的返回值，不能基于地图识别到的层级。
   * 地图能认出「河北省」不等于仓库里有河北的气候数据 —— 数据还没到位时这里返回
   * null，卡片就得显示空态。绕过它去自己声称精度，等于在页面上撒谎。
   */
  function lookupClimate(geo) {
    return loadClimateSources().then(function (sources) {
      return resolveClimate(sources, geo);
    });
  }

  window.G4Pipeline = {
    runScoring: runScoring,
    lookupClimate: lookupClimate,
    technologyNames: technologyNames,
    missingDatasets: missingDatasets,
    collectLocalPublicData: collectLocalPublicData,
    SCORING_FILES: SCORING_FILES,
  };
})();
