const CAMPAIGN_CONFIG = {
  apiBaseUrl:
    new URLSearchParams(location.search).get("api")
    || "https://web-production-c8e68.up.railway.app",
  refreshIntervalMs: 15000,
};

const campaignState = {
  serverOffsetMs: 0,
  startsAtMs: null,
  endsAtMs: null,
  status: "loading",
};

const campaignElements = {};

document.addEventListener("DOMContentLoaded", () => {
  bindCampaignElements();
  campaignElements.campaignRetryBtn.addEventListener("click", loadCampaign);
  loadCampaign();
  window.setInterval(loadCampaign, CAMPAIGN_CONFIG.refreshIntervalMs);
  window.setInterval(updateCountdown, 1000);
});

function bindCampaignElements() {
  [
    "campaignLoading",
    "campaignUnavailable",
    "campaignErrorMessage",
    "campaignRetryBtn",
    "campaignDashboard",
    "campaignPeriod",
    "campaignCountdownLabel",
    "campaignCountdown",
    "campaignTotalLabel",
    "campaignStatusNote",
    "campaignProgressTrack",
    "campaignProgressBar",
    "campaignMilestones",
    "campaignProgressCopy",
    "campaignUpdatedAt",
    "campaignRanking",
    "campaignEmptyRanking",
    "campaignPrimeRanking",
    "campaignEmptyPrimeRanking",
    "campaignHistory",
    "campaignEmptyHistory",
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
    renderCampaign(await response.json());
  } catch (error) {
    showUnavailable("時間をおいて、もう一度お試しください。");
    console.error("weekly challenge fetch failed", error);
  }
}

function renderCampaign(payload) {
  const serverNowMs = Date.parse(payload.server_now);
  if (Number.isFinite(serverNowMs)) {
    campaignState.serverOffsetMs = serverNowMs - Date.now();
  }
  campaignState.startsAtMs = payload.starts_at ? Date.parse(payload.starts_at) : null;
  campaignState.endsAtMs = payload.ends_at ? Date.parse(payload.ends_at) : null;
  campaignState.status = payload.status;

  campaignElements.campaignLoading.classList.add("hidden");
  campaignElements.campaignUnavailable.classList.add("hidden");
  if (!["active", "scheduled", "finished"].includes(payload.status)) {
    showUnavailable(payload.message || "集計情報を取得できません");
    return;
  }

  campaignElements.campaignDashboard.classList.remove("hidden");
  campaignElements.campaignPeriod.textContent = payload.period_label
    ? `${payload.period_label}｜${payload.schedule_label || ""}`
    : payload.schedule_label || "";
  const goal = positiveNumber(payload.goal, 300);
  const totalWins = nonNegativeNumber(payload.total_wins, 0);
  const progress = Math.min(100, Math.max(0, Number(payload.progress_percent) || 0));

  campaignElements.campaignTotalLabel.textContent = `${totalWins} / ${goal}勝`;
  campaignElements.campaignStatusNote.className = `campaign-status-note ${payload.status}`;
  campaignElements.campaignStatusNote.textContent = statusMessage(payload);
  campaignElements.campaignProgressBar.style.width = `${progress}%`;
  campaignElements.campaignProgressTrack.setAttribute("aria-valuenow", String(Math.min(totalWins, goal)));
  campaignElements.campaignProgressTrack.setAttribute("aria-valuemax", String(goal));
  campaignElements.campaignProgressTrack.setAttribute("aria-label", `${goal}勝までの進捗`);
  renderMilestones(goal, totalWins);
  campaignElements.campaignProgressCopy.textContent = totalWins >= goal
    ? `目標達成！ 現在${totalWins}勝`
    : `${goal}勝まであと${goal - totalWins}勝`;
  campaignElements.campaignUpdatedAt.textContent = payload.last_updated_at
    ? `更新 ${formatDateTime(Date.parse(payload.last_updated_at))}`
    : "今週の記録はまだありません";

  renderWinRanking(Array.isArray(payload.rankings) ? payload.rankings : []);
  renderPrimeRanking(Array.isArray(payload.prime_rankings) ? payload.prime_rankings : []);
  renderHistory(Array.isArray(payload.history) ? payload.history : [], payload.period_key);
  updateCountdown();
}

function statusMessage(payload) {
  if (payload.status === "scheduled") {
    return payload.message || "月曜6:00から新しい週が始まります。";
  }
  if (payload.status === "finished") {
    return payload.message || "最終結果です。";
  }
  return campaignState.endsAtMs
    ? `${formatDateTime(campaignState.endsAtMs)}まで。勝敗にかかわらず、最大素数も記録されます。`
    : "開催中です。";
}

function renderMilestones(goal, totalWins) {
  campaignElements.campaignMilestones.replaceChildren();
  [Math.round(goal / 3), Math.round(goal * 2 / 3)].forEach((milestone) => {
    if (milestone <= 0 || milestone >= goal) return;
    const marker = document.createElement("span");
    marker.className = "campaign-progress-marker";
    marker.style.left = `${milestone / goal * 100}%`;
    marker.classList.toggle("reached", totalWins >= milestone);
    const label = document.createElement("span");
    label.textContent = totalWins >= milestone ? `${milestone}✓` : String(milestone);
    marker.appendChild(label);
    campaignElements.campaignMilestones.appendChild(marker);
  });
}

function renderWinRanking(rankings) {
  campaignElements.campaignRanking.replaceChildren();
  campaignElements.campaignEmptyRanking.classList.toggle("hidden", rankings.length > 0);
  rankings.forEach((entry) => {
    campaignElements.campaignRanking.appendChild(
      rankingRow(entry.rank, entry.player_name, `${nonNegativeNumber(entry.wins, 0)}勝`),
    );
  });
}

function renderPrimeRanking(rankings) {
  campaignElements.campaignPrimeRanking.replaceChildren();
  campaignElements.campaignEmptyPrimeRanking.classList.toggle("hidden", rankings.length > 0);
  [...rankings]
    .sort((left, right) => (
      compareUnsignedIntegerStrings(right.prime_value, left.prime_value)
      || nonNegativeNumber(left.rank, 0) - nonNegativeNumber(right.rank, 0)
    ))
    .forEach((entry) => {
      const row = rankingRow(entry.rank, entry.player_name, "");
      row.classList.add("prime-ranking-row");
      const value = document.createElement("strong");
      value.className = "campaign-prime-value";
      value.textContent = String(entry.prime_value || "");
      value.title = `${nonNegativeNumber(entry.digit_count, 0)}桁の素数`;
      const digits = document.createElement("small");
      digits.className = "campaign-digit-count";
      digits.textContent = `${nonNegativeNumber(entry.digit_count, 0)}桁`;
      row.lastElementChild.replaceWith(value, digits);
      campaignElements.campaignPrimeRanking.appendChild(row);
    });
}

function compareUnsignedIntegerStrings(leftValue, rightValue) {
  const left = String(leftValue ?? "0").replace(/^0+(?=\d)/, "");
  const right = String(rightValue ?? "0").replace(/^0+(?=\d)/, "");
  if (left.length !== right.length) return left.length - right.length;
  return left === right ? 0 : left < right ? -1 : 1;
}

function rankingRow(rankValue, playerName, resultText) {
  const row = document.createElement("li");
  row.className = "campaign-ranking-row";
  const rank = document.createElement("span");
  rank.className = "campaign-rank";
  rank.textContent = `${rankValue}位`;
  const name = document.createElement("span");
  name.className = "campaign-player-name";
  name.textContent = String(playerName || "");
  const result = document.createElement("strong");
  result.className = "campaign-player-wins";
  result.textContent = resultText;
  row.append(rank, name, result);
  return row;
}

function renderHistory(history, currentPeriodKey) {
  campaignElements.campaignHistory.replaceChildren();
  const archived = history.filter((entry) => (
    entry.period_key !== currentPeriodKey || Date.parse(entry.ends_at) <= Date.now() + campaignState.serverOffsetMs
  ));
  campaignElements.campaignEmptyHistory.classList.toggle("hidden", archived.length > 0);
  archived.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "campaign-history-card";
    const heading = document.createElement("h3");
    heading.textContent = entry.label || formatPeriod(entry.starts_at, entry.ends_at);
    const total = document.createElement("strong");
    total.textContent = `${nonNegativeNumber(entry.total_wins, 0)}勝`;
    const detail = document.createElement("p");
    const parts = [`参加 ${nonNegativeNumber(entry.participant_count, 0)}名`];
    if (entry.winner_name) parts.push(`1位 ${entry.winner_name} ${entry.winner_wins}勝`);
    if (entry.largest_prime) parts.push(`最大素数 ${entry.largest_prime}`);
    detail.textContent = parts.join("｜");
    item.append(heading, total, detail);
    campaignElements.campaignHistory.appendChild(item);
  });
}

function showUnavailable(message) {
  campaignElements.campaignLoading.classList.add("hidden");
  campaignElements.campaignDashboard.classList.add("hidden");
  campaignElements.campaignUnavailable.classList.remove("hidden");
  campaignElements.campaignErrorMessage.textContent = message;
}

function updateCountdown() {
  const target = campaignState.status === "scheduled"
    ? campaignState.startsAtMs
    : campaignState.endsAtMs;
  if (!Number.isFinite(target)) return;
  const remainingMs = Math.max(0, target - (Date.now() + campaignState.serverOffsetMs));
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  campaignElements.campaignCountdownLabel.textContent = campaignState.status === "scheduled"
    ? "次週スタートまで"
    : "今週の締切まで";
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
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatPeriod(startsAt, endsAt) {
  return `${formatDateTime(Date.parse(startsAt))}〜${formatDateTime(Date.parse(endsAt))}`;
}

function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
