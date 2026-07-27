const CAMPAIGN_CONFIG = {
  apiBaseUrl:
    new URLSearchParams(location.search).get("api")
    || "https://web-production-c8e68.up.railway.app",
  refreshIntervalMs: 15000,
};

const campaignState = {
  serverOffsetMs: 0,
  startsAtMs: null,
  refreshTimer: null,
  countdownTimer: null,
};

const campaignElements = {};

document.addEventListener("DOMContentLoaded", () => {
  bindCampaignElements();
  campaignElements.campaignRetryBtn.addEventListener("click", loadCampaign);
  loadCampaign();
  campaignState.refreshTimer = window.setInterval(
    loadCampaign,
    CAMPAIGN_CONFIG.refreshIntervalMs,
  );
  campaignState.countdownTimer = window.setInterval(updateCountdown, 1000);
});

function bindCampaignElements() {
  [
    "campaignLoading",
    "campaignScheduled",
    "campaignUnavailable",
    "campaignActive",
    "campaignCountdown",
    "campaignStartAt",
    "campaignScheduledMessage",
    "campaignErrorMessage",
    "campaignRetryBtn",
    "campaignTotalLabel",
    "campaignProgressTrack",
    "campaignProgressBar",
    "campaignProgressCopy",
    "campaignUpdatedAt",
    "campaignRanking",
    "campaignEmptyRanking",
  ].forEach((id) => {
    campaignElements[id] = document.getElementById(id);
  });
}

async function loadCampaign() {
  try {
    const response = await fetch(
      `${CAMPAIGN_CONFIG.apiBaseUrl}/api/campaigns/gold-cpu-100`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    renderCampaign(payload);
  } catch (error) {
    renderUnavailable("時間をおいて、もう一度お試しください。");
    console.error("campaign fetch failed", error);
  }
}

function renderCampaign(payload) {
  const serverNowMs = Date.parse(payload.server_now);
  if (Number.isFinite(serverNowMs)) {
    campaignState.serverOffsetMs = serverNowMs - Date.now();
  }
  campaignState.startsAtMs = payload.starts_at ? Date.parse(payload.starts_at) : null;

  hideAllCampaignStates();
  if (payload.status === "scheduled") {
    campaignElements.campaignScheduled.classList.remove("hidden");
    campaignElements.campaignScheduledMessage.textContent = payload.message || "";
    campaignElements.campaignStartAt.textContent = campaignState.startsAtMs
      ? `${formatDateTime(campaignState.startsAtMs)} 開始`
      : "開始日時は準備中です";
    updateCountdown();
    return;
  }

  if (payload.status !== "active") {
    renderUnavailable(payload.message || "集計情報を取得できません");
    return;
  }

  campaignElements.campaignActive.classList.remove("hidden");
  const goal = positiveNumber(payload.goal, 100);
  const totalWins = nonNegativeNumber(payload.total_wins, 0);
  const progress = Math.min(100, Math.max(0, Number(payload.progress_percent) || 0));

  campaignElements.campaignTotalLabel.textContent = `${totalWins} / ${goal}勝`;
  campaignElements.campaignProgressBar.style.width = `${progress}%`;
  campaignElements.campaignProgressTrack.setAttribute("aria-valuenow", String(Math.min(totalWins, goal)));
  campaignElements.campaignProgressTrack.setAttribute("aria-valuemax", String(goal));
  campaignElements.campaignProgressCopy.textContent = totalWins >= goal
    ? `目標達成！ 現在${totalWins}勝`
    : `${goal}勝まであと${goal - totalWins}勝`;
  campaignElements.campaignUpdatedAt.textContent = payload.last_updated_at
    ? `更新 ${formatDateTime(Date.parse(payload.last_updated_at))}`
    : "まだ勝利記録はありません";
  renderRanking(Array.isArray(payload.rankings) ? payload.rankings : []);
}

function renderRanking(rankings) {
  campaignElements.campaignRanking.replaceChildren();
  campaignElements.campaignEmptyRanking.classList.toggle("hidden", rankings.length > 0);

  rankings.forEach((entry) => {
    const row = document.createElement("li");
    row.className = "campaign-ranking-row";

    const rank = document.createElement("span");
    rank.className = "campaign-rank";
    rank.textContent = `${entry.rank}位`;

    const name = document.createElement("span");
    name.className = "campaign-player-name";
    name.textContent = String(entry.player_name || "");

    const wins = document.createElement("strong");
    wins.className = "campaign-player-wins";
    wins.textContent = `${nonNegativeNumber(entry.wins, 0)}勝`;

    row.append(rank, name, wins);
    campaignElements.campaignRanking.appendChild(row);
  });
}

function renderUnavailable(message) {
  hideAllCampaignStates();
  campaignElements.campaignUnavailable.classList.remove("hidden");
  campaignElements.campaignErrorMessage.textContent = message;
}

function hideAllCampaignStates() {
  campaignElements.campaignLoading.classList.add("hidden");
  campaignElements.campaignScheduled.classList.add("hidden");
  campaignElements.campaignUnavailable.classList.add("hidden");
  campaignElements.campaignActive.classList.add("hidden");
}

function updateCountdown() {
  if (
    !campaignState.startsAtMs
    || campaignElements.campaignScheduled.classList.contains("hidden")
  ) {
    return;
  }
  const remainingMs = Math.max(
    0,
    campaignState.startsAtMs - (Date.now() + campaignState.serverOffsetMs),
  );
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  campaignElements.campaignCountdown.textContent = [
    `${days}日`,
    `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  ].join(" ");

  if (remainingMs === 0) loadCampaign();
}

function formatDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
