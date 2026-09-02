import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * 本地开发用：把 api/*.js 当成 Vercel Serverless 函数挂到 dev server 上。
 * 只在 `vite dev` 生效，不影响 Vercel 部署（线上仍由 Vercel 直接托管 api/）。
 *
 * api/ 下模块格式是混的：chat.js / supabase-config.js 用 ESM export default，
 * explain.js / global-ai.js / global-feedback.js 用 CommonJS module.exports，
 * 而 package.json 声明 "type": "commonjs"。线上靠 Vercel 自己的加载器兜住，
 * 本地则用 vite 的 ssrLoadModule 兜住（裸 import() 会在 ESM 那两个上报
 * "Unexpected token 'export'"）。
 *
 * 注意：这个混用本身是仓库里的隐患 —— 它依赖平台行为，换 runtime 或
 * 直接 `node api/chat.js` 就会炸。建议统一成 CommonJS，见 docs/HANDOFF.md。
 */
function vercelApiDev() {
  return {
    name: "vercel-api-dev",
    apply: "serve",
    configureServer(server) {
      // 直接读 vercel.json，保证本地路由与线上永远一致（不会漂移）
      const REWRITES = Object.fromEntries(
        JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")).rewrites.map(
          (r) => [r.source, r.destination],
        ),
      );
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url || "/").split("?");
        const key = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
        if (Object.prototype.hasOwnProperty.call(REWRITES, key)) {
          req.url = REWRITES[key] + (query ? `?${query}` : "");
        }
        next();
      });

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        if (!url.pathname.startsWith("/api/")) return next();

        const name = url.pathname.slice("/api/".length).replace(/\/+$/, "");
        const file = path.join(ROOT, "api", `${name}.js`);
        if (!name || !existsSync(file)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: `No such API route: /api/${name}` }));
        }

        try {
          // api/ 下模块格式是混的：chat.js / supabase-config.js 用 ESM export default，
          // explain.js / global-ai.js / global-feedback.js 用 CommonJS module.exports，
          // 而 package.json 声明 "type": "commonjs"。裸 import() 会在 ESM 那两个上
          // 抛 "Unexpected token 'export'"。vite 的 ssrLoadModule 会先做转换，
          // 两种格式都能吃，并且自带热重载。
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          const handler = mod.default ?? mod;
          if (typeof handler !== "function") {
            throw new Error(`api/${name}.js 没有导出可调用的 handler`);
          }

          req.body = await readJsonBody(req);
          req.query = Object.fromEntries(url.searchParams);
          decorateResponse(res);

          await handler(req, res);
          if (!res.writableEnded) res.end();
        } catch (error) {
          console.error(`[api/${name}]`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
          }
          if (!res.writableEnded) {
            res.end(JSON.stringify({ error: String(error?.message ?? error) }));
          }
        }
      });
    },
  };
}

function readJsonBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

/** 给 node 原生 res 补上 handler 期望的 Vercel 风格方法 */
function decorateResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
    return res;
  };
  res.send = (payload) => {
    res.end(typeof payload === "string" ? payload : JSON.stringify(payload));
    return res;
  };
}

export default defineConfig(({ mode }) => {
  // 把 .env / .env.local 里的变量塞进 process.env，供上面的 API handler 读取
  // （DEEPSEEK_API_KEY / SUPABASE_URL / SUPABASE_ANON_KEY）
  Object.assign(process.env, loadEnv(mode, ROOT, ""));

  return {
    root: ROOT,
    publicDir: false,
    appType: "mpa", // 多页应用：不要把未匹配的路径都吞给根 index.html
    plugins: [vercelApiDev()],
    server: {
      port: 5173,
      open: false,
      fs: { strict: false },
    },
  };
});
