const profileForm = document.getElementById("profileForm");
const dashboard = document.getElementById("dashboard");
const logBox = document.getElementById("logBox");
const choiceBox = document.getElementById("choiceBox");
const startBtn = document.getElementById("startBtn");

const statIds = ["heating_annual_cost", "annual_income", "compliance", "emission_score"];
const game = {
  sessionId: "",
  ended: false,
};

function renderState(state, delta = null) {
  statIds.forEach((id) => {
    const el = document.getElementById(id);
    const value = state[id] ?? 0;
    let text = String(value);
    if (delta && Object.prototype.hasOwnProperty.call(delta, id)) {
      const d = Number(delta[id]) || 0;
      const sign = d > 0 ? "+" : "";
      if (d !== 0) text += ` (${sign}${d})`;
    }
    el.textContent = text;
  });
}

function appendLog(title, body, type = "normal") {
  const card = document.createElement("article");
  card.className = `log-item ${type}`;

  const titleEl = document.createElement("h3");
  titleEl.textContent = title;
  card.appendChild(titleEl);

  const bodyEl = document.createElement("p");
  bodyEl.textContent = body;
  card.appendChild(bodyEl);

  logBox.appendChild(card);
  logBox.scrollTop = logBox.scrollHeight;
}

function renderChoices(choices = [], disabled = false) {
  choiceBox.innerHTML = "";
  choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn";
    btn.textContent = choice.label;
    btn.disabled = disabled;
    btn.addEventListener("click", () => onChoose(choice));
    choiceBox.appendChild(btn);
  });
}

async function requestJSON(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function onChoose(choice) {
  if (!game.sessionId || game.ended) return;
  renderChoices([], true);
  appendLog("你选择了", choice.label, "user");

  try {
    const data = await requestJSON("/api/step", {
      session_id: game.sessionId,
      choice_id: choice.id,
      choice_label: choice.label,
    });

    renderState(data.state, data.delta);
    appendLog(`第 ${data.turn} 回合`, data.narrative, "assistant");

    if (data.event?.triggered) {
      appendLog(`特殊事件：${data.event.title}`, data.event.description || "事件影响了你的家庭决策环境。", "event");
    }

    if (data.ending?.is_final) {
      game.ended = true;
      const endingTypeMap = {
        success: "成功转型",
        bankrupt: "经济破产",
        seized: "被处罚",
        none: "阶段结束",
      };
      const endingType = endingTypeMap[data.ending.type] || "阶段结束";
      appendLog(`结局：${endingType}`, data.ending.summary || "本次模拟结束。", "ending");
      if (data.ending.policy_diagnosis) {
        appendLog("政策诊断总结", data.ending.policy_diagnosis, "assistant");
      }
      renderChoices([], true);
      return;
    }

    renderChoices(data.choices);
  } catch (err) {
    appendLog("系统错误", err.message, "error");
    renderChoices([choice]);
  }
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  startBtn.disabled = true;
  logBox.innerHTML = "";
  choiceBox.innerHTML = "";
  game.ended = false;

  const formData = new FormData(profileForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const data = await requestJSON("/api/start", payload);
    game.sessionId = data.session_id;
    dashboard.classList.remove("hidden");
    logBox.classList.remove("hidden");
    choiceBox.classList.remove("hidden");

    renderState(data.state);
    appendLog("开局分析", data.narrative, "assistant");
    renderChoices(data.choices);
  } catch (err) {
    appendLog("启动失败", err.message, "error");
  } finally {
    startBtn.disabled = false;
  }
});
