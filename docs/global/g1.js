/* ---------------------------------------------------------------------------
 * G1 · 气候地图选点 —— 接线层
 *
 * 地图（map.js）负责画和交互，识别逻辑（GlobalEngine 里的 resolveLocation）
 * 负责判定，本文件把两者接起来，并渲染右侧的气候卡。
 *
 * 一条不能违反的规则：气候卡上的「Data source」标签必须来自
 * G4Pipeline.lookupClimate() 的**实际**返回值，不能来自地图识别到的层级。
 * 地图认出「河北省」不等于仓库里有河北的气候数据 —— 数据没到位时卡片必须
 * 显示空态。这一点由 describeDataResolution() 在结构上保证：它只接受
 * 真实的 ClimateProfile，拿不到就返回 "unresolved"。
 * ------------------------------------------------------------------------- */

(function () {
  "use strict";

  var MAPS = {
    admin0: "/docs/data/maps/admin0-boundaries.geojson",
    admin1: "/docs/data/maps/admin1-cn-us.geojson",
    places: "/docs/data/maps/populated-places.geojson",
    koppenLegend: "/docs/data/maps/koppen-legend.json",
    koppenPng: "/docs/data/maps/koppen-1991-2020.png",
    labelOverrides: "/docs/data/maps/country-label-overrides.json"
  };

  /* 与 dataviz 规则一致：一个面板一条序列，两个面板各自独立 y 轴。
     绝不把降水和气温叠在同一张图上做双 y 轴 —— 两个刻度的对齐是任意的，
     会凭空造出一个数据里没有的相关性。 */
  var SERIES = {
    precipitation: "#2a78d6",
    temperature: "#c2521f"
  };

  // 文案在 i18n/*.json 的 g1map.* 命名空间（原内联 TEXT 字典已迁走，规格 §5）。
  // G1 的语言仍由 state.locale 驱动（app.js 在 localechange 时调 setLocale），
  // 字典本身与主页面共用一份。

  var state = {
    locale: "en",
    map: null,
    ctx: { admin0: null, admin1: null, koppenLegend: null, readKoppenPixel: null, labelOverrides: null },
    admin1Loading: null,
    geo: null,
    climate: null,
    notice: null,
    tableOpen: false
  };

  var listeners = [];
  var el = {};

  function t(key) {
    if (!window.GlobalI18n) return key;
    var v = window.GlobalI18n.t("g1map." + key);
    return v === "g1map." + key ? key : v;
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(url + " → HTTP " + r.status);
      return r.json();
    });
  }

  /* ---- Köppen 栅格 ----------------------------------------------------- */

  /**
   * 把 PNG 解成一份只含分类索引的 Uint8Array。
   *
   * 用 createImageBitmap(..., colorSpaceConversion: "none") 是关键：默认情况下
   * 浏览器可能对图像做色彩管理转换，像素值会被悄悄改掉，canvas 不会报任何错，
   * 用户只会看到一个错的气候区。加载完还要跑 legend 里的自检探针，
   * 不通过就整块禁用气候区功能 —— 宁可说「不可用」，也不给看似正常的错答案。
   */
  function loadKoppenGrid(legend) {
    var grid = legend.grid;
    return fetch(MAPS.koppenPng, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("koppen png → HTTP " + r.status);
        return r.blob();
      })
      .then(function (blob) {
        if (typeof window.createImageBitmap === "function") {
          return window
            .createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" })
            .catch(function () {
              return window.createImageBitmap(blob);
            });
        }
        return new Promise(function (resolve, reject) {
          var img = new Image();
          img.onload = function () { resolve(img); };
          img.onerror = function () { reject(new Error("koppen png decode failed")); };
          img.src = URL.createObjectURL(blob);
        });
      })
      .then(function (source) {
        var canvas = document.createElement("canvas");
        canvas.width = grid.width;
        canvas.height = grid.height;
        var c = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
        c.drawImage(source, 0, 0);
        if (source.close) source.close();

        // 分条读取。整张 3600×1800 的 RGBA 是 26 MB，一次性分配在低端手机上可能失败。
        var out = new Uint8Array(grid.width * grid.height);
        var STRIP = 200;
        for (var y = 0; y < grid.height; y += STRIP) {
          var h = Math.min(STRIP, grid.height - y);
          var rgba = c.getImageData(0, y, grid.width, h).data;
          for (var i = 0, n = grid.width * h; i < n; i += 1) {
            out[y * grid.width + i] = rgba[i * 4]; // R 通道即分类索引
          }
        }
        return out;
      });
  }

  /* ---- 加载与初始化 ---------------------------------------------------- */

  function init(options) {
    var opts = options || {};
    state.locale = opts.locale || "en";
    el.canvas = document.getElementById("g1Canvas");
    el.card = document.getElementById("g1Card");
    el.notice = document.getElementById("g1Notice");
    el.charts = document.getElementById("g1Charts");
    el.nature = document.getElementById("g1Nature");
    el.status = document.getElementById("g1Status");
    if (!el.canvas || !el.card) return Promise.resolve(false);

    el.canvas.setAttribute("aria-label", t("mapLabel"));
    setNotice(t("loading"), "info");

    state.map = window.ClimateMap.create(el.canvas, {
      onSelect: handleSelect,
      onViewChange: handleViewChange
    });

    var zoomIn = document.getElementById("g1ZoomIn");
    var zoomOut = document.getElementById("g1ZoomOut");
    if (zoomIn) zoomIn.addEventListener("click", function () { state.map.zoomBy(1.4); });
    if (zoomOut) zoomOut.addEventListener("click", function () { state.map.zoomBy(1 / 1.4); });

    return Promise.all([
      fetchJson(MAPS.admin0),
      fetchJson(MAPS.places),
      fetchJson(MAPS.koppenLegend),
      fetchJson(MAPS.labelOverrides).catch(function () { return { overrides: {} }; })
    ])
      .then(function (r) {
        var admin0 = r[0], places = r[1], legend = r[2], overrides = r[3];
        var E = window.GlobalEngine;
        state.ctx.admin0 = E.buildBoundaryIndex(admin0);
        state.ctx.koppenLegend = legend;
        state.ctx.labelOverrides = overrides;
        if (state.ctx.admin0.warnings.length) {
          console.warn("[G1] 边界数据告警", state.ctx.admin0.warnings);
        }
        state.map.setAdmin0(admin0);
        state.map.setPlaces(places);
        state.map.setLocale(state.locale);

        return loadKoppenGrid(legend).then(
          function (data) {
            var reader = function (x, y) {
              if (x < 0 || y < 0 || x >= legend.grid.width || y >= legend.grid.height) return null;
              return data[y * legend.grid.width + x];
            };
            var check = E.runSelfCheck(legend, reader);
            if (!check.ok) {
              // 像素被改写过。识别位置仍然可用，但气候区一律不出，避免给错答案。
              console.error("[G1] Köppen 栅格自检失败", check.failures);
              state.ctx.readKoppenPixel = null;
              setNotice(t("koppenFailed"), "warn");
              return;
            }
            state.ctx.readKoppenPixel = reader;
            setNotice(null);
          },
          function (error) {
            console.error("[G1] Köppen 栅格加载失败", error);
            state.ctx.readKoppenPixel = null;
            setNotice(t("koppenFailed"), "warn");
          }
        );
      })
      .then(function () {
        renderCard();
        return true;
      })
      .catch(function (error) {
        console.error("[G1] 地图数据加载失败", error);
        setNotice(t("loadFailed"), "error");
        return false;
      });
  }

  /** 中美省/州界体积不小（约 1.8 MB），只在真的需要时才拉 */
  function ensureAdmin1() {
    if (state.ctx.admin1) return Promise.resolve(state.ctx.admin1);
    if (state.admin1Loading) return state.admin1Loading;
    state.admin1Loading = fetchJson(MAPS.admin1)
      .then(function (fc) {
        state.ctx.admin1 = window.GlobalEngine.buildBoundaryIndex(fc);
        state.map.setAdmin1(fc);
        return state.ctx.admin1;
      })
      .catch(function (error) {
        console.error("[G1] 省/州界加载失败", error);
        state.admin1Loading = null;
        return null;
      });
    return state.admin1Loading;
  }

  function handleViewChange(view) {
    if (view.scale >= window.ClimateMap.ADMIN1_MIN_SCALE) ensureAdmin1();
  }

  function handleSelect(point) {
    var E = window.GlobalEngine;
    var geo = E.resolveLocation(point.lat, point.lon, state.ctx);

    // 点进中美但省/州界还没加载：先拉再重算，否则会漏掉省份
    if (E.isAdmin1Country(geo.country_iso3) && !state.ctx.admin1) {
      ensureAdmin1().then(function () {
        applyResolution(E.resolveLocation(point.lat, point.lon, state.ctx));
      });
      return;
    }
    applyResolution(geo);
  }

  function applyResolution(geo) {
    state.geo = geo;
    state.climate = null;
    state.map.setMarker(geo.lon, geo.lat);
    state.map.setHighlight({ iso3: geo.country_iso3, admin1Code: geo.admin1_code });

    if (!window.GlobalEngine.isUsableLocation(geo)) {
      setNotice(t("seaClick"), "warn");
      renderCard();
      notify();
      return;
    }
    setNotice(
      geo.ambiguous_country ? t("ambiguous") + geo.country_candidates.join(", ") : null,
      geo.ambiguous_country ? "warn" : "info"
    );
    renderCard();
    notify();

    window.G4Pipeline.lookupClimate(window.GlobalEngine.toScoringGeo(geo)).then(function (climate) {
      // 期间用户可能又点了别处
      if (state.geo !== geo) return;
      state.climate = climate;
      renderCard();
      notify();
    });
  }

  function setNotice(message, kind) {
    state.notice = message ? { message: message, kind: kind || "info" } : null;
    if (!el.notice) return;
    if (!state.notice) {
      el.notice.className = "hidden";
      el.notice.textContent = "";
      return;
    }
    el.notice.className = kind === "error" ? "error" : kind === "warn" ? "warning" : "help";
    el.notice.textContent = state.notice.message;
  }

  /* ---- 气候卡 ---------------------------------------------------------- */

  function resolutionLabel(resolution) {
    if (resolution === "admin1_capital") return t("resAdmin1");
    if (resolution === "koppen_standard_profile") return t("resKoppen");
    if (resolution === "koppen_main_group_fallback") return t("resMainGroup");
    return t("resNone");
  }

  function zoneText(geo, climate) {
    if (!geo || !geo.koppen_code) return t("notIdentified");
    var legend = state.ctx.koppenLegend;
    var cls = legend ? window.GlobalEngine.classFromCode(geo.koppen_code, legend.classes) : null;
    var name =
      state.locale === "zh" && climate && climate.display_name_zh
        ? climate.display_name_zh
        : (climate && climate.display_name_en) || (cls && cls.description_en) || "";
    return name ? geo.koppen_code + " · " + name : geo.koppen_code;
  }

  function row(label, value) {
    return (
      '<div class="g1-row"><dt>' + escapeHtml(label) + "</dt><dd>" + escapeHtml(value) + "</dd></div>"
    );
  }

  function renderCard() {
    if (!el.card) return;
    var geo = state.geo;
    if (!geo || !window.GlobalEngine.isUsableLocation(geo)) {
      el.card.innerHTML = '<p class="help">' + escapeHtml(t("pickPrompt")) + "</p>";
      if (el.charts) el.charts.innerHTML = "";
      renderNature(null);
      if (el.status) el.status.textContent = t("pickPrompt");
      return;
    }

    var climate = state.climate;
    // 关键：标签取自真实的气候查询结果，不是地图识别层级
    var resolution = window.GlobalEngine.describeDataResolution(geo, climate);
    var isAdmin1 = window.GlobalEngine.isAdmin1Country(geo.country_iso3);

    var countryName =
      (state.locale === "zh" ? geo.country_name_zh : geo.country_name_en) ||
      geo.country_name_en ||
      geo.country_iso3;

    var html = "<dl class='g1-facts'>";
    html += row(t("country"), countryName + " (" + geo.country_iso3 + ")");

    // 规格 §G1：Province / State 与 Capital 仅中国、美国显示
    if (isAdmin1) {
      var admin1Name =
        (state.locale === "zh" ? geo.admin1_name_zh : geo.admin1_name_en) ||
        geo.admin1_name_en ||
        t("notIdentified");
      html += row(t("admin1"), geo.admin1_code ? admin1Name + " (" + geo.admin1_code + ")" : t("notIdentified"));
      var capital =
        climate && climate.source_kind === "admin1_capital"
          ? (state.locale === "zh" ? climate.capital_name_zh : climate.capital_name) || climate.capital_name
          : null;
      html += row(t("capital"), capital || t("resNone"));
    }

    html += row(t("zone"), zoneText(geo, climate));
    html += row(t("dataSource"), resolutionLabel(resolution));

    // 数据年份对用户可见。只在测试里挡住过期是不够的 ——
    // 真正拿这些数字做决定的人有权知道它们是哪一年的。
    var vintage = climate && climate._vintage;
    if (vintage) {
      var stale = !!vintage.stale_after && vintage.stale_after < new Date().toISOString().slice(0, 10);
      html += row(t("vintage"), vintage.source_period + " · " + vintage.retrieved_at + (stale ? " ⚠" : ""));
      if (stale) {
        html += '<p class="warning" style="font-size:0.84rem;margin:4px 0 0;">' + escapeHtml(t("vintageStale")) + "</p>";
      }
    }
    html += "</dl>";
    el.card.innerHTML = html;

    if (el.status) {
      el.status.textContent =
        countryName +
        (isAdmin1 && geo.admin1_code ? " · " + geo.admin1_code : "") +
        " · " +
        resolutionLabel(resolution);
    }
    renderCharts(climate);
    renderNature(climate);
  }

  /* ---- 图表 ------------------------------------------------------------ */

  function isTwelve(values) {
    return Array.isArray(values) && values.length === 12 && values.every(function (v) {
      return typeof v === "number" && Number.isFinite(v);
    });
  }

  function niceStep(span, target) {
    var raw = span / Math.max(1, target);
    var mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var candidates = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i] * mag >= raw) return candidates[i] * mag;
    }
    return 10 * mag;
  }

  var VB_W = 360;
  var PLOT_L = 34;
  var PLOT_R = 8;
  /* 顶部留白：直标的峰值文字和最高的那根柱子都要放得下，否则会被 viewBox 裁掉 */
  var PLOT_TOP = 13;
  var AXIS_BAND = 14;

  function axisTicks(min, max, count) {
    var step = niceStep(max - min || 1, count);
    var start = Math.ceil(min / step) * step;
    var ticks = [];
    for (var v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  function fmt(value) {
    return Math.abs(value) >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  }

  /** 月降水柱状图。数据端 2px 圆角、锚在基线上，柱间留表面间隙。 */
  function precipitationPanel(values, height) {
    var months = t("months");
    var short = t("monthsShort");
    var max = Math.max.apply(null, values);
    var top = max > 0 ? max : 1;
    var baseY = height - AXIS_BAND;
    var plotH = baseY - PLOT_TOP;
    var gap = 2;
    var band = (VB_W - PLOT_L - PLOT_R) / 12;
    var barW = Math.max(4, band - gap * 2);
    var toY = function (v) { return baseY - (v / top) * plotH; };
    var maxIndex = values.indexOf(max);

    var svg = "";
    axisTicks(0, top, 3).forEach(function (v) {
      var y = toY(v);
      svg += '<line class="g1-grid" x1="' + PLOT_L + '" y1="' + y.toFixed(1) + '" x2="' + (VB_W - PLOT_R) + '" y2="' + y.toFixed(1) + '"/>';
      svg += '<text class="g1-tick" x="' + (PLOT_L - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>";
    });
    values.forEach(function (v, i) {
      var y = toY(v);
      var x = PLOT_L + band * i + (band - barW) / 2;
      svg +=
        '<rect class="g1-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) +
        '" height="' + Math.max(0, baseY - y).toFixed(1) + '" rx="2"><title>' +
        escapeHtml(months[i] + " · " + fmt(v) + " " + t("precipUnit")) + "</title></rect>";
    });
    // 只直标峰值 —— 每根柱子都标数字是噪声。标在柱顶之上的留白里，不压住柱体。
    if (maxIndex >= 0 && max > 0) {
      var lx = PLOT_L + band * maxIndex + band / 2;
      svg += '<text class="g1-peak" x="' + lx.toFixed(1) + '" y="' + (toY(max) - 3).toFixed(1) + '" text-anchor="middle">' + fmt(max) + "</text>";
    }
    svg += '<line class="g1-axis" x1="' + PLOT_L + '" y1="' + baseY + '" x2="' + (VB_W - PLOT_R) + '" y2="' + baseY + '"/>';
    short.forEach(function (m, i) {
      var x = PLOT_L + band * i + band / 2;
      svg += '<text class="g1-tick" x="' + x.toFixed(1) + '" y="' + (baseY + 10) + '" text-anchor="middle">' + escapeHtml(m) + "</text>";
    });
    return svg;
  }

  /** 月均温折线图。2px 线、大命中区、只直标最高与最低月。 */
  function temperaturePanel(values, height) {
    var months = t("months");
    var short = t("monthsShort");
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var pad = Math.max(1, (max - min) * 0.15);
    var lo = min - pad;
    var hi = max + pad;
    var baseY = height - AXIS_BAND;
    var plotH = baseY - PLOT_TOP;
    var band = (VB_W - PLOT_L - PLOT_R) / 12;
    var toY = function (v) { return baseY - ((v - lo) / (hi - lo)) * plotH; };
    var toX = function (i) { return PLOT_L + band * i + band / 2; };

    var svg = "";
    axisTicks(lo, hi, 3).forEach(function (v) {
      var y = toY(v);
      svg += '<line class="g1-grid" x1="' + PLOT_L + '" y1="' + y.toFixed(1) + '" x2="' + (VB_W - PLOT_R) + '" y2="' + y.toFixed(1) + '"/>';
      svg += '<text class="g1-tick" x="' + (PLOT_L - 5) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>";
    });
    // 0℃ 线：冷热的物理分界，值得比普通网格线重一点
    if (lo < 0 && hi > 0) {
      svg += '<line class="g1-zero" x1="' + PLOT_L + '" y1="' + toY(0).toFixed(1) + '" x2="' + (VB_W - PLOT_R) + '" y2="' + toY(0).toFixed(1) + '"/>';
    }

    var d = values.map(function (v, i) { return (i ? "L" : "M") + toX(i).toFixed(1) + " " + toY(v).toFixed(1); }).join(" ");
    svg += '<path class="g1-line" d="' + d + '"/>';
    values.forEach(function (v, i) {
      svg += '<circle class="g1-dot" cx="' + toX(i).toFixed(1) + '" cy="' + toY(v).toFixed(1) + '" r="2.4"/>';
      // 命中区比可见点大，指针不必精确落在圆点上
      svg += '<circle class="g1-hit" cx="' + toX(i).toFixed(1) + '" cy="' + toY(v).toFixed(1) + '" r="9"><title>' +
        escapeHtml(months[i] + " · " + fmt(v) + " " + t("tempUnit")) + "</title></circle>";
    });
    // 最高月标在点上方、最低月标在点下方；两处都夹在绘图区内，不越出 viewBox
    [
      { index: values.indexOf(max), dy: -5 },
      { index: values.indexOf(min), dy: 10 }
    ].forEach(function (label) {
      if (label.index < 0) return;
      var y = Math.min(baseY - 1, Math.max(9, toY(values[label.index]) + label.dy));
      svg += '<text class="g1-peak" x="' + toX(label.index).toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle">' +
        fmt(values[label.index]) + "</text>";
    });
    svg += '<line class="g1-axis" x1="' + PLOT_L + '" y1="' + baseY + '" x2="' + (VB_W - PLOT_R) + '" y2="' + baseY + '"/>';
    short.forEach(function (m, i) {
      svg += '<text class="g1-tick" x="' + toX(i).toFixed(1) + '" y="' + (baseY + 10) + '" text-anchor="middle">' + escapeHtml(m) + "</text>";
    });
    return svg;
  }

  function tableHtml(temps, precip) {
    var months = t("months");
    var rows = "";
    for (var i = 0; i < 12; i += 1) {
      rows +=
        "<tr><th scope='row'>" + escapeHtml(months[i]) + "</th><td>" +
        (temps ? fmt(temps[i]) : "—") + "</td><td>" + (precip ? fmt(precip[i]) : "—") + "</td></tr>";
    }
    return (
      "<table class='g1-table'><caption class='visually-hidden'>" + escapeHtml(t("temperature")) + " / " + escapeHtml(t("precipitation")) +
      "</caption><thead><tr><th scope='col'>" + escapeHtml(t("month")) + "</th><th scope='col'>" +
      escapeHtml(t("tempUnit")) + "</th><th scope='col'>" + escapeHtml(t("precipUnit")) +
      "</th></tr></thead><tbody>" + rows + "</tbody></table>"
    );
  }

  function renderCharts(climate) {
    if (!el.charts) return;
    var temps = climate && climate.temperature_c_monthly;
    var precip = climate && climate.precipitation_mm_monthly;
    var hasTemp = isTwelve(temps);
    var hasPrecip = isTwelve(precip);

    if (!hasTemp && !hasPrecip) {
      // 数据不在就明说，不画任何近似曲线 —— 这条与 G4 的 insufficient_data 是同一条规矩
      el.charts.innerHTML =
        '<div class="g1-empty"><p class="warning">' + escapeHtml(t("noClimate")) + "</p>" +
        '<p class="help">' + escapeHtml(t("noClimateWhy")) + "</p>" +
        '<p class="help"><code>docs/data/climate/</code></p></div>';
      return;
    }

    var html = "";
    if (hasTemp) {
      html +=
        '<figure class="g1-figure"><figcaption>' + escapeHtml(t("temperature")) + " (" + escapeHtml(t("tempUnit")) + ")</figcaption>" +
        '<svg viewBox="0 0 ' + VB_W + ' 96" role="img" aria-label="' + escapeHtml(t("temperature")) + '">' +
        temperaturePanel(temps, 96) + "</svg></figure>";
    }
    if (hasPrecip) {
      html +=
        '<figure class="g1-figure"><figcaption>' + escapeHtml(t("precipitation")) + " (" + escapeHtml(t("precipUnit")) + ")</figcaption>" +
        '<svg viewBox="0 0 ' + VB_W + ' 96" role="img" aria-label="' + escapeHtml(t("precipitation")) + '">' +
        precipitationPanel(precip, 96) + "</svg></figure>";
    }
    // 表格镜像：数值不能只能靠 tooltip 才读得到
    html +=
      '<button type="button" class="secondary g1-table-toggle">' +
      escapeHtml(state.tableOpen ? t("hideTable") : t("showTable")) + "</button>" +
      '<div class="g1-table-wrap' + (state.tableOpen ? "" : " hidden") + '">' +
      tableHtml(hasTemp ? temps : null, hasPrecip ? precip : null) + "</div>";

    el.charts.innerHTML = html;
    var toggle = el.charts.querySelector(".g1-table-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        state.tableOpen = !state.tableOpen;
        renderCharts(climate);
      });
    }
  }

  function nt(key) {
    if (!window.GlobalI18n) return key;
    var v = window.GlobalI18n.t("g1nature." + key);
    return v === "g1nature." + key ? key : v;
  }

  function natureLine(kind, copyRef) {
    var template = nt(kind + "." + copyRef.key);
    var months = t("months");
    if (window.GlobalEngine && window.GlobalEngine.fillNatureCopy) {
      return window.GlobalEngine.fillNatureCopy(template, copyRef.params || {}, months);
    }
    return template;
  }

  function yearStripSvg(months) {
    var colors = (window.GlobalEngine && window.GlobalEngine.MONTH_BAND_COLOR) || {
      ice: "#7C99B4", cold: "#2F6E96", cool: "#3F7A56", mild: "#5A9A74", warm: "#A98235", hot: "#B4551F"
    };
    var short = t("monthsShort");
    var w = 360;
    var gap = 3;
    var cell = (w - gap * 13) / 12;
    var svg = '<svg class="g1-year" viewBox="0 0 ' + w + ' 86" role="img" aria-label="' + escapeHtml(nt("yearCaption")) + '">';
    months.forEach(function (m, i) {
      var x = gap + i * (cell + gap);
      var fill = colors[m.band] || "#888";
      svg += '<rect x="' + x.toFixed(1) + '" y="8" width="' + cell.toFixed(1) + '" height="44" rx="6" fill="' + fill + '"/>';
      if (typeof m.precip_mm === "number") {
        var dots = m.wet === "wet" ? 5 : m.wet === "dry" ? 1 : 3;
        for (var d = 0; d < dots; d += 1) {
          var cx = x + cell * (0.25 + (d % 3) * 0.25);
          var cy = 18 + Math.floor(d / 3) * 12;
          svg += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy + '" r="2.2" fill="#fff" opacity="0.85"/>';
        }
      }
      svg += '<text class="g1-tick" x="' + (x + cell / 2).toFixed(1) + '" y="68" text-anchor="middle">' + escapeHtml(short[i] || "") + "</text>";
    });
    svg += "</svg>";
    return svg;
  }

  function natureIcon(kind, lesson) {
    var accent = "#1E5F8E";
    var ember = "#B4551F";
    var leaf = "#3F7A56";
    if (kind === "climate") {
      if (lesson.family.indexOf("polar") === 0 || lesson.family.indexOf("continental") === 0) {
        return '<svg viewBox="0 0 160 72" aria-hidden="true"><circle cx="118" cy="22" r="14" fill="' + ember + '" opacity="0.85"/><rect x="18" y="40" width="124" height="18" rx="9" fill="' + accent + '"/><rect x="36" y="28" width="18" height="22" fill="#dfe8ef"/><rect x="70" y="22" width="18" height="28" fill="#dfe8ef"/><rect x="104" y="30" width="18" height="20" fill="#dfe8ef"/></svg>';
      }
      if (lesson.family.indexOf("arid") === 0) {
        return '<svg viewBox="0 0 160 72" aria-hidden="true"><circle cx="124" cy="20" r="16" fill="' + ember + '"/><path d="M8 58 Q40 28 80 58 T152 58" fill="none" stroke="#A98235" stroke-width="8" stroke-linecap="round"/></svg>';
      }
      return '<svg viewBox="0 0 160 72" aria-hidden="true"><circle cx="36" cy="22" r="14" fill="' + ember + '"/><ellipse cx="108" cy="28" rx="32" ry="16" fill="' + accent + '" opacity="0.75"/><rect x="20" y="48" width="120" height="10" rx="5" fill="' + leaf + '"/></svg>';
    }
    if (kind === "phenology") {
      if (lesson.phenology_key === "evergreen" || lesson.phenology_key === "rain_pulse") {
        return '<svg viewBox="0 0 160 72" aria-hidden="true"><rect x="74" y="36" width="12" height="28" fill="#6b4a2b"/><circle cx="80" cy="28" r="22" fill="' + leaf + '"/><circle cx="62" cy="34" r="12" fill="#5A9A74"/></svg>';
      }
      if (lesson.phenology_key === "wait_for_rain") {
        return '<svg viewBox="0 0 160 72" aria-hidden="true"><rect x="74" y="40" width="10" height="22" fill="#6b4a2b"/><path d="M80 18 L104 48 L56 48 Z" fill="#A98235"/><circle cx="28" cy="20" r="4" fill="' + accent + '"/><circle cx="40" cy="12" r="3" fill="' + accent + '"/></svg>';
      }
      if (lesson.phenology_key === "ice_year" || lesson.phenology_key === "short_thaw") {
        return '<svg viewBox="0 0 160 72" aria-hidden="true"><circle cx="80" cy="36" r="20" fill="#dfe8ef" stroke="' + accent + '" stroke-width="3"/><path d="M80 16 V56 M60 36 H100 M66 22 L94 50 M94 22 L66 50" stroke="' + accent + '" stroke-width="3"/></svg>';
      }
      return '<svg viewBox="0 0 160 72" aria-hidden="true"><rect x="76" y="34" width="10" height="28" fill="#6b4a2b"/><path d="M50 38 Q80 6 110 38" fill="none" stroke="#A98235" stroke-width="6"/><circle cx="58" cy="44" r="5" fill="#B4551F"/><circle cx="102" cy="46" r="5" fill="#B4551F"/></svg>';
    }
    return '<svg viewBox="0 0 160 72" aria-hidden="true"><rect x="70" y="12" width="18" height="48" rx="9" fill="#dfe8ef" stroke="' + ember + '" stroke-width="3"/><rect x="74" y="36" width="10" height="20" rx="4" fill="' + ember + '"/><circle cx="32" cy="28" r="8" fill="' + accent + '" opacity="0.8"/></svg>';
  }

  function renderNature(climate) {
    if (!el.nature) return;
    var E = window.GlobalEngine;
    var geo = state.geo;
    if (!geo || !E || !E.isUsableLocation(geo) || !E.explainNatureClimate) {
      el.nature.innerHTML = "";
      el.nature.className = "g1-nature hidden";
      return;
    }
    if (!climate) {
      el.nature.innerHTML = "";
      el.nature.className = "g1-nature hidden";
      return;
    }

    var lesson = E.explainNatureClimate({
      temperature_c_monthly: climate.temperature_c_monthly,
      precipitation_mm_monthly: climate.precipitation_mm_monthly,
      koppen_code: climate.koppen_code || geo.koppen_code
    });

    if (lesson.status !== "ok") {
      el.nature.className = "g1-nature";
      el.nature.innerHTML =
        "<p class='g1-nature-kicker'>" + escapeHtml(nt("step")) + "</p>" +
        "<h3>" + escapeHtml(nt("title")) + "</h3>" +
        "<p class='warning'>" + escapeHtml(nt("unavailable")) + "</p>" +
        "<p class='g1-nature-note'>" + escapeHtml(nt("disclaimer")) + "</p>";
      return;
    }

    var whyHtml = lesson.why.map(function (item) {
      return "<p>" + escapeHtml(natureLine("why", item)) + "</p>";
    }).join("");

    el.nature.className = "g1-nature";
    el.nature.innerHTML =
      "<p class='g1-nature-kicker'>" + escapeHtml(nt("step")) + "</p>" +
      "<h3>" + escapeHtml(nt("title")) + "</h3>" +
      yearStripSvg(lesson.months) +
      "<p class='g1-year-caption'>" + escapeHtml(nt("yearCaption")) + "</p>" +
      "<div class='g1-nature-cards'>" +
        "<article class='g1-nature-card'>" + natureIcon("climate", lesson) +
          "<h4>" + escapeHtml(nt("climateLabel")) + "</h4>" +
          "<p>" + escapeHtml(natureLine("climate", lesson.climate)) + "</p>" +
        "</article>" +
        "<article class='g1-nature-card'>" + natureIcon("phenology", lesson) +
          "<h4>" + escapeHtml(nt("phenoLabel")) + "</h4>" +
          "<p>" + escapeHtml(natureLine("phenology", lesson.phenology)) + "</p>" +
        "</article>" +
        "<article class='g1-nature-card'>" + natureIcon("why", lesson) +
          "<h4>" + escapeHtml(nt("whyLabel")) + "</h4>" + whyHtml +
        "</article>" +
      "</div>" +
      "<p class='g1-nature-home'><strong>" + escapeHtml(nt("homeLabel")) + "</strong> " +
        escapeHtml(natureLine("home", lesson.home)) + "</p>" +
      "<p class='g1-nature-note'>" + escapeHtml(nt("disclaimer")) + "</p>";
  }

  /* ---- 对外接口 -------------------------------------------------------- */

  function notify() {
    for (var i = 0; i < listeners.length; i += 1) listeners[i](state.geo, state.climate);
  }

  window.G1Location = {
    init: init,
    /** 传给 runScoring 的 geo 载荷；未选点时为 null */
    getScoringGeo: function () {
      if (!state.geo || !window.GlobalEngine.isUsableLocation(state.geo)) return null;
      return window.GlobalEngine.toScoringGeo(state.geo);
    },
    getResolution: function () { return state.geo; },
    getClimate: function () { return state.climate; },
    hasLocation: function () {
      return !!state.geo && window.GlobalEngine.isUsableLocation(state.geo);
    },
    onChange: function (cb) { if (typeof cb === "function") listeners.push(cb); },
    setLocale: function (locale) {
      state.locale = locale === "zh" ? "zh" : "en";
      if (state.map) state.map.setLocale(state.locale);
      if (el.canvas) el.canvas.setAttribute("aria-label", t("mapLabel"));
      if (state.notice) setNotice(state.notice.message, state.notice.kind);
      renderCard();
    }
  };
})();
