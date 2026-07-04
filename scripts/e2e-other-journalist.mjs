/**
 * E2E: identity 其他 / 记者 — full simulation + survey, then verify Supabase.
 * Run: node scripts/e2e-other-journalist.mjs
 */
import { chromium } from "playwright";

const SITE = process.env.E2E_SITE || "https://www.clean-heating-simulator.com";
const SUPABASE_URL = "https://zottuuavggzsjqvblydl.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvdHR1dWF2Z2d6c2pxdmJseWRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4MTA1MjksImV4cCI6MjA5NjM4NjUyOX0.zv7Ne_JIZWcOQaftIET8blOCEi0xOGda67jDdSXwp5M";

const TEST_MARKER = `记者-E2E-${Date.now()}`;

async function querySession(sessionId) {
  const url = `${SUPABASE_URL}/rest/v1/simulation_sessions?id=eq.${sessionId}&select=id,user_identity,identity_detail,ending_type,post_survey,post_survey_at,ai_analysis_at,created_at`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`
    }
  });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function queryByIdentityDetail(marker) {
  const url = `${SUPABASE_URL}/rest/v1/simulation_sessions?identity_detail=eq.${encodeURIComponent(marker)}&select=id,user_identity,identity_detail,ending_type,post_survey,post_survey_at&order=created_at.desc&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`
    }
  });
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function clickChoice(page, labelPart) {
  const btn = page.locator(".choice-btn").filter({ hasText: labelPart }).first();
  await btn.waitFor({ state: "visible", timeout: 15000 });
  await btn.click();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  let sessionId = null;
  let surveySuccess = false;

  try {
    console.log("1. Open site:", SITE);
    await page.goto(SITE, { waitUntil: "domcontentloaded" });

    console.log("2. Welcome: 其他 /", TEST_MARKER);
    await page.selectOption("#userIdentitySelect", "其他");
    await page.fill('[name="identity_other"]', TEST_MARKER);
    await page.click("#welcomeStartBtn");

    console.log("3. Context + consent");
    await page.click("#contextContinueBtn");
    await page.click("#consentAgreeBtn");

    console.log("4. Household form");
    await page.fill('[name="household_population"]', "4");
    await page.fill('[name="annual_income"]', "80000");
    await page.fill('[name="annual_surplus"]', "8000");
    await page.fill('[name="housing_area"]', "100");
    await page.fill('[name="winter_cost"]', "3000");
    await page.click("#profileSubmitBtn");

    console.log("5. Pre-survey Q1");
    await page.locator('#preSurveyForm input[name="q1_understanding_before"][value="3"]').click();
    await page.click("#preSurveySubmitBtn");

    console.log("6. Simulation (5 turns)");
    await page.locator("#playArea").waitFor({ state: "visible", timeout: 15000 });

    await clickChoice(page, "准备转型");
    await clickChoice(page, "天然气");
    await clickChoice(page, "提高收入");
    await clickChoice(page, "结算");

    console.log("7. Wait for ending + AI section");
    await page.locator(".ending").waitFor({ state: "visible", timeout: 30000 });
    await page.locator("#aiAnalysisSection").waitFor({ state: "visible", timeout: 60000 });

    // AI may still be loading; proceed to survey when button appears
    await page.locator("#aiAnalysisNextBtn").waitFor({ state: "visible", timeout: 120000 });
    await page.click("#aiAnalysisNextBtn");

    console.log("8. Post-game survey");
    await page.locator("#surveyOverlay:not([hidden])").waitFor({ state: "visible", timeout: 15000 });

    // Common Q2–Q4
    await page.locator('input[name="q2_understanding_after"][value="4"]').click();
    await page.locator('input[name="q3_biggest_impact"][value="A"]').click();
    await page.locator('input[name="q4_strategy_change"][value="C"]').click();

    // Other audience O1–O5
    await page.locator('input[name="o1_perspective"][value="C"]').click();
    await page.locator('input[name="o2_policy_variance_help"][value="4"]').click();
    await page.locator('input[name="o3_policy_gaps"][value="subsidy"]').click();
    await page.locator('input[name="o3_policy_gaps"][value="tech_mix"]').click();
    await page.fill('[name="o4_policy_conflict_detail"]', "E2E测试：补贴退坡后取暖费上涨最明显。");
    await page.fill('[name="o5_reflection"]', "自动化测试提交。");

    // Ending
    await page.locator('input[name="q_end1_recommend"][value="4"]').click();
    await page.locator('input[name="q_end_ai_helpfulness"][value="C"]').click();

    sessionId = await page.evaluate(() => sessionStorage.getItem("ch_sim_research_session_id"));
    console.log("   Session ID (before submit):", sessionId);

    await page.locator('#postGameSurveyForm button[type="submit"]').click();

    // Wait for success modal or error message
    const successModal = page.locator("#surveySuccessOverlay:not([hidden])");
    const errorStatus = page.locator("#surveyStatus");

    const outcome = await Promise.race([
      successModal.waitFor({ state: "visible", timeout: 90000 }).then(() => "success"),
      errorStatus
        .filter({ hasText: /失败|未能|未成功/ })
        .waitFor({ state: "visible", timeout: 90000 })
        .then(async () => `error:${await errorStatus.textContent()}`)
    ]).catch(async () => {
      const status = (await errorStatus.textContent()) || "(no status)";
      return `timeout:${status}`;
    });

    console.log("9. Submit outcome:", outcome);
    surveySuccess = outcome === "success";

    if (!sessionId) {
      sessionId = await page.evaluate(() => sessionStorage.getItem("ch_sim_research_session_id"));
    }
  } finally {
    await browser.close();
  }

  console.log("\n--- Supabase verification ---");
  let rows = [];
  if (sessionId) {
    rows = await querySession(sessionId);
    console.log("Query by session ID:", sessionId);
  }
  if (!rows?.length) {
    rows = await queryByIdentityDetail(TEST_MARKER);
    console.log("Query by identity_detail:", TEST_MARKER);
  }

  if (!rows?.length) {
    console.log("RESULT: NO ROW FOUND in Supabase");
    console.log(JSON.stringify({ surveySuccess, sessionId, marker: TEST_MARKER }, null, 2));
    process.exit(1);
  }

  const row = rows[0];
  const hasSurvey = Boolean(row.post_survey && row.post_survey_at);
  console.log("RESULT: ROW FOUND");
  console.log(
    JSON.stringify(
      {
        surveyUiSuccess: surveySuccess,
        supabaseRowFound: true,
        id: row.id,
        user_identity: row.user_identity,
        identity_detail: row.identity_detail,
        ending_type: row.ending_type,
        post_survey_at: row.post_survey_at,
        has_post_survey_json: Boolean(row.post_survey),
        survey_user_identity: row.post_survey?.user_identity,
        survey_other_o1: row.post_survey?.other_audience?.o1_perspective?.label,
        survey_submitted_at: row.post_survey?.submitted_at
      },
      null,
      2
    )
  );

  if (!hasSurvey) {
    console.log("WARNING: Session exists but post_survey not saved");
    process.exit(1);
  }

  if (!surveySuccess) {
    console.log("WARNING: UI did not show success modal but data may exist");
  }

  console.log("\nPASS: Survey data saved to Supabase.");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
