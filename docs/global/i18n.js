/**
 * Global mode i18n runtime.
 *
 * 规格 §5「Language behavior（必须实现）」：
 *   - 语言选择写入 localStorage.locale，并同步到 URL query（?lang=zh / ?lang=en）
 *   - 默认：浏览器语言以 zh 开头 → 中文，否则英文；用户手动选择后以用户选择为准
 *   - 文案来源必须走 i18n/en.json 与 i18n/zh.json，不在组件里硬编码
 *   - 不要同屏双语显示
 *
 * 用法：页面元素加 data-i18n="key"；需要写属性时用 data-i18n-attr="placeholder:key"。
 * 其他 Global 页面（G3/G4/G7）后续接入时直接引本文件即可。
 */
(function () {
  "use strict";

  var STORAGE_KEY = "locale";
  var SUPPORTED = ["en", "zh"];
  var DICT_URL = function (locale) { return "/i18n/" + locale + ".json"; };

  var cache = Object.create(null);

  function normalize(value) {
    if (!value) return null;
    var v = String(value).toLowerCase();
    if (v.indexOf("zh") === 0) return "zh";
    if (v.indexOf("en") === 0) return "en";
    return null;
  }

  function readStored() {
    try {
      return normalize(window.localStorage.getItem(STORAGE_KEY));
    } catch (err) {
      return null; // 隐私模式下 localStorage 可能抛错
    }
  }

  function writeStored(locale) {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch (err) {
      /* 存不下也不该阻塞用户，忽略 */
    }
  }

  /** 优先级：URL ?lang= > localStorage > 浏览器语言 > en */
  function resolveInitialLocale() {
    var fromQuery = normalize(new URLSearchParams(window.location.search).get("lang"));
    if (fromQuery) return fromQuery;

    var stored = readStored();
    if (stored) return stored;

    var langs = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language];
    for (var i = 0; i < langs.length; i += 1) {
      var hit = normalize(langs[i]);
      if (hit) return hit;
    }
    return "en";
  }

  function loadDictionary(locale) {
    if (cache[locale]) return Promise.resolve(cache[locale]);
    return fetch(DICT_URL(locale), { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("i18n dictionary " + locale + " → HTTP " + res.status);
        return res.json();
      })
      .then(function (dict) {
        cache[locale] = dict;
        return dict;
      });
  }

  function applyDictionary(dict, locale) {
    document.documentElement.setAttribute("lang", dict["meta.htmlLang"] || locale);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        el.textContent = dict[key];
      } else if (window.console) {
        console.warn("[i18n] missing key:", key, "in", locale);
      }
    });

    // data-i18n-attr="placeholder:some.key,title:other.key"
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(",").forEach(function (pair) {
        var parts = pair.split(":");
        var attr = (parts[0] || "").trim();
        var key = (parts[1] || "").trim();
        if (attr && key && Object.prototype.hasOwnProperty.call(dict, key)) {
          el.setAttribute(attr, dict[key]);
        }
      });
    });

    // 页面标题走各自声明的 key：<html data-i18n-title="story.hero.heading">
    // 不声明就保留 HTML 里的 <title>，避免把每个页面都改成落地页标题。
    var titleKey = document.documentElement.getAttribute("data-i18n-title");
    if (titleKey && Object.prototype.hasOwnProperty.call(dict, titleKey)) {
      document.title = dict[titleKey];
    }
  }

  function syncQuery(locale) {
    var url = new URL(window.location.href);
    url.searchParams.set("lang", locale);
    window.history.replaceState({}, "", url);
  }

  function setLocale(locale, opts) {
    var target = normalize(locale) || "en";
    return loadDictionary(target)
      .then(function (dict) {
        applyDictionary(dict, target);
        writeStored(target);
        if (!opts || opts.syncQuery !== false) syncQuery(target);

        var select = document.getElementById("localeSelect");
        if (select && select.value !== target) select.value = target;

        document.body.setAttribute("data-i18n-state", "ready");
        window.dispatchEvent(new CustomEvent("localechange", { detail: { locale: target, dict: dict } }));
        return dict;
      })
      .catch(function (err) {
        // 字典拿不到时，让页面里的英文兜底文案显示出来，不要留白屏
        document.body.setAttribute("data-i18n-state", "error");
        if (window.console) console.error("[i18n]", err);
      });
  }

  window.GlobalI18n = {
    supported: SUPPORTED.slice(),
    current: null,
    setLocale: function (locale) {
      window.GlobalI18n.current = normalize(locale) || "en";
      return setLocale(window.GlobalI18n.current);
    },
    t: function (key) {
      var dict = cache[window.GlobalI18n.current];
      return dict && Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    },
  };

  function init() {
    var initial = resolveInitialLocale();
    window.GlobalI18n.current = initial;

    var select = document.getElementById("localeSelect");
    if (select) {
      select.value = initial;
      select.addEventListener("change", function () {
        window.GlobalI18n.setLocale(select.value);
      });
    }

    setLocale(initial);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
