const CONFIG = {
  wsUrl: new URLSearchParams(location.search).get("ws") || "wss://web-production-c8e68.up.railway.app/ws",
  defaultRoomKey: "beginner",
  rooms: {
    beginner: {
      roomId: "room_16",
      label: "初級",
      title: "7枚 / 偶数半減",
      summary: "ペナルティ1枚",
      roomHeading: "初級ルーム",
      badge: "7枚 / 偶数半減 / ペナルティ1枚",
      defaultSampleKey: "gold_prime_table",
    },
    advanced: {
      roomId: "room_14",
      label: "上級",
      title: "11枚 / 通常",
      summary: "ペナルティ通常",
      roomHeading: "上級ルーム",
      badge: "11枚 / 通常",
      defaultSampleKey: "sashimi2024",
    },
  },
  defaultSampleKey: "sashimi2024",
};

const state = {
  ws: null,
  connected: false,
  playerId: null,
  playerName: "",
  roomJoined: false,
  appMode: "setup",
  roomState: "waiting",
  selectedRoomKey: CONFIG.defaultRoomKey,
  isWaiting: false,
  currentTurn: "",
  firstPlayerId: null,
  roomCounts: {},
  roomCountsLoaded: false,
  roomRules: {},
  roomCpuProfiles: {},
  roomHnpChallengeEnabled: {},
  roomRegisteredNumberLimits: {},
  cpuChooserOpen: false,
  selectedCpuKey: "",
  players: [],
  currentRoomHasCpu: false,
  hnpChallengeEnabled: false,
  registeredPrimeValues: new Set(),
  sampleOptions: [],
  deckCount: "-",
  fieldCards: [],
  handCounts: [],
  flowPreviewCards: [],
  flowPreviewTimer: null,
  hand: [],
  selectedCards: [],
  jokerAssignedRanks: [],
  compositeMode: false,
  compositeTokens: [],
  compositeJokerAssign: [],
  lastAssistCandidates: [],
  remainingFinishExists: false,
  assistFilters: {
    target_scope: "all",
    limit_mode: "ten",
    order: "recommended",
    count_scope: "field",
    card_count: "1",
    face_mode: "letters",
  },
  pendingFlow: null,
  sampleLoadedForFlow: false,
  cpuRequestedForFlow: false,
  startRequestedForFlow: false,
  assistTimer: null,
  assistRequestVersion: 0,
};

const el = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  setRandomNameIfEmpty();
  connect();
  renderAll();
});

function bindElements() {
  [
    "connectionDot",
    "connectionLabel",
    "serverLabel",
    "setupPanel",
    "roomPanel",
    "registerPanel",
    "nameInput",
    "randomNameBtn",
    "roomBeginnerBtn",
    "roomAdvancedBtn",
    "practiceBtn",
    "leaveBtn",
    "roomBadge",
    "roomHeading",
    "nextHint",
    "playStatus",
    "playerList",
    "turnLabel",
    "readyBtn",
    "addCpuBtn",
    "startBtn",
    "cpuChooser",
    "cpuProfileSelect",
    "cpuProfileDescription",
    "cpuChooserCloseBtn",
    "confirmCpuBtn",
    "sampleBtn",
    "sampleSelect",
    "primeText",
    "compositeText",
    "saveRegisterBtn",
    "registerStatus",
    "registerLimitNote",
    "fieldCards",
    "deckCount",
    "myHandMetric",
    "myHandLabel",
    "myHandCount",
    "opponentMetric",
    "opponentLabel",
    "opponentCounts",
    "assistRecommendedBtn",
    "assistStrongBtn",
    "assistEasyBtn",
    "assistRestBtn",
    "assistManyBtn",
    "assistList",
    "selectedTitle",
    "clearSelectionBtn",
    "selectedCards",
    "jokerControls",
    "compositeModeBtn",
    "compositePanel",
    "compositeTitle",
    "compositeCards",
    "compositeJokerControls",
    "compositeMulBtn",
    "compositePowBtn",
    "compositeClearBtn",
    "playBtn",
    "drawBtn",
    "passBtn",
    "handCards",
    "remainingFinishNotice",
    "turnBadge",
    "logBox",
    "chatInput",
    "chatBtn",
  ].forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

function bindEvents() {
  el.randomNameBtn.addEventListener("click", setRandomName);
  el.roomBeginnerBtn.addEventListener("click", () => selectRoom("beginner"));
  el.roomAdvancedBtn.addEventListener("click", () => selectRoom("advanced"));
  el.practiceBtn.addEventListener("click", () => startFlow("enter"));
  el.leaveBtn.addEventListener("click", leaveRoom);
  el.readyBtn.addEventListener("click", toggleReady);
  el.addCpuBtn.addEventListener("click", toggleCpu);
  el.cpuProfileSelect.addEventListener("change", selectCpuProfile);
  el.cpuChooserCloseBtn.addEventListener("click", closeCpuChooser);
  el.confirmCpuBtn.addEventListener("click", confirmCpuSelection);
  el.startBtn.addEventListener("click", startGame);
  el.sampleBtn.addEventListener("click", loadSample);
  el.saveRegisterBtn.addEventListener("click", saveRegisteredNumbers);
  el.clearSelectionBtn.addEventListener("click", clearSelection);
  el.compositeModeBtn.addEventListener("click", toggleCompositeMode);
  el.compositeMulBtn.addEventListener("click", () => addCompositeOp("×"));
  el.compositePowBtn.addEventListener("click", () => addCompositeOp("^"));
  el.compositeClearBtn.addEventListener("click", () => {
    clearCompositeMode();
    renderAll();
  });
  el.playBtn.addEventListener("click", playSelected);
  el.drawBtn.addEventListener("click", () => send({ type: "draw_card" }));
  el.passBtn.addEventListener("click", () => send({ type: "pass" }));
  el.chatBtn.addEventListener("click", sendChat);
  el.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") sendChat();
  });
  el.assistRecommendedBtn.addEventListener("click", () => setAssistOrder("recommended"));
  el.assistStrongBtn.addEventListener("click", () => setAssistOrder("strong"));
  el.assistEasyBtn.addEventListener("click", () => setAssistOrder("weak"));
  el.assistRestBtn.addEventListener("click", toggleAssistRest);
  el.assistManyBtn.addEventListener("click", toggleAssistLimit);
}

function currentRoomOption() {
  return CONFIG.rooms[state.selectedRoomKey] || CONFIG.rooms[CONFIG.defaultRoomKey];
}

function currentRoomId() {
  return currentRoomOption().roomId;
}

function selectRoom(roomKey) {
  if (state.roomJoined || !CONFIG.rooms[roomKey] || !isRoomAvailable(roomKey)) return;
  state.selectedRoomKey = roomKey;
  state.hnpChallengeEnabled = !!state.roomHnpChallengeEnabled[currentRoomId()];
  state.currentRoomHasCpu = false;
  state.cpuChooserOpen = false;
  state.selectedCpuKey = "";
  renderSampleOptions();
  setSampleSelectToRoomDefault();
  renderRoomChoice();
  renderAll();
}

function setSampleSelectToRoomDefault() {
  const key = currentRoomOption().defaultSampleKey || CONFIG.defaultSampleKey;
  if ([...el.sampleSelect.options].some((option) => option.value === key)) {
    el.sampleSelect.value = key;
  }
}

function isRoomAvailable(roomKey) {
  if (!state.roomCountsLoaded) return true;
  return Object.prototype.hasOwnProperty.call(state.roomCounts, CONFIG.rooms[roomKey].roomId);
}

function connect() {
  setConnection("connecting", "接続中", CONFIG.wsUrl);
  state.ws = new WebSocket(CONFIG.wsUrl);

  state.ws.addEventListener("open", () => {
    state.connected = true;
    setConnection("online", "接続済み", `既存サーバー / ${currentRoomId()}`);
    send({ type: "get_room_counts" });
    renderAll();
  });

  state.ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
  });

  state.ws.addEventListener("close", () => {
    state.connected = false;
    setConnection("error", "切断されました", "ページを再読み込みすると再接続します");
    log("system", "サーバーとの接続が切れました。");
    renderAll();
  });

  state.ws.addEventListener("error", () => {
    state.connected = false;
    setConnection("error", "接続エラー", "サーバーに接続できませんでした");
    renderAll();
  });
}

function handleMessage(msg) {
  switch (msg.type) {
    case "your_id":
      state.playerId = msg.id;
      break;
    case "room_counts":
      state.roomCounts = msg.counts || {};
      state.roomCountsLoaded = true;
      state.roomRules = msg.rules || {};
      state.roomCpuProfiles = msg.cpu_profiles || {};
      state.roomHnpChallengeEnabled = msg.hnp_challenge_enabled || {};
      state.roomRegisteredNumberLimits = msg.registered_number_limits || {};
      if (!isRoomAvailable(state.selectedRoomKey) && isRoomAvailable("advanced")) {
        state.selectedRoomKey = "advanced";
      }
      state.hnpChallengeEnabled = !!state.roomHnpChallengeEnabled[currentRoomId()];
      state.sampleOptions = msg.registered_sample_options || [];
      renderSampleOptions();
      break;
    case "name_set":
      state.playerName = msg.name || state.playerName;
      break;
    case "room_state_initialization":
      state.roomJoined = true;
      state.roomState = msg.room_state || "waiting";
      state.appMode = msg.room_state === "playing" ? "playing" : "room";
      if (typeof msg.hnp_challenge_enabled === "boolean") state.hnpChallengeEnabled = msg.hnp_challenge_enabled;
      continuePendingFlowAfterJoin();
      break;
    case "update_room_status":
      if (msg.room_id === currentRoomId()) {
        state.roomCounts[currentRoomId()] = msg.count;
        state.currentRoomHasCpu = (msg.player_list || []).some((player) => player.is_cpu);
        if (state.currentRoomHasCpu) state.cpuChooserOpen = false;
        state.roomCpuProfiles[currentRoomId()] = msg.cpu_profiles || state.roomCpuProfiles[currentRoomId()] || [];
        if (typeof msg.hnp_challenge_enabled === "boolean") state.hnpChallengeEnabled = msg.hnp_challenge_enabled;
        renderPlayers(msg.player_list || [], msg.waiting_count || 0);
        continuePendingFlowAfterCpuStatus();
      }
      break;
    case "registered_numbers_updated":
    case "registered_primes_updated":
      renderRegisteredStatus(msg);
      state.sampleLoadedForFlow = true;
      continuePendingFlowAfterRegistration();
      break;
    case "game_start":
      state.appMode = "playing";
      state.roomState = "playing";
      state.firstPlayerId = null;
      if (typeof msg.hnp_challenge_enabled === "boolean") state.hnpChallengeEnabled = msg.hnp_challenge_enabled;
      clearFlowPreview(false);
      clearSelection();
      break;
    case "deal":
      state.hand = msg.your_hand || [];
      clearSelection();
      scheduleAssist();
      break;
    case "hand_update":
      state.hand = msg.your_hand || [];
      renderHand();
      scheduleAssist();
      break;
    case "game_update":
      state.appMode = msg.state === "playing" ? "playing" : state.appMode;
      state.roomState = msg.state || state.roomState;
      state.currentTurn = msg.current_turn || "";
      state.firstPlayerId = msg.first_player_id || state.firstPlayerId;
      state.currentRoomHasCpu = (msg.player_list || []).some((player) => player.is_cpu);
      if (typeof msg.hnp_challenge_enabled === "boolean") state.hnpChallengeEnabled = msg.hnp_challenge_enabled;
      renderField(msg);
      renderPlayers(msg.player_list || [], null);
      scheduleAssist();
      break;
    case "turn_update":
    case "next_turn":
      state.currentTurn = msg.current_turn || "";
      scheduleAssist();
      break;
    case "prime_assist_result":
      if (
        Number.isInteger(msg.assist_request_id)
        && msg.assist_request_id !== state.assistRequestVersion
      ) {
        break;
      }
      state.lastAssistCandidates = msg.candidates || [];
      state.remainingFinishExists = typeof msg.remaining_finish_exists === "boolean"
        ? msg.remaining_finish_exists
        : state.lastAssistCandidates.some(candidateFinishesRemaining);
      renderHand();
      renderAssist();
      break;
    case "action_result":
      if (msg.action === "field_flow") {
        showFlowPreview(msg.played_cards || []);
      }
      break;
    case "penalty":
      break;
    case "game_over":
      state.roomState = msg.state || "waiting";
      state.appMode = "room";
      state.hand = [];
      state.firstPlayerId = null;
      clearFlowPreview(false);
      clearSelection();
      break;
    case "score_record":
      logScoreRecord(msg.lines || []);
      break;
    case "chat":
      log(msg.sender || "chat", msg.message || "");
      break;
    case "error":
      if (msg.code === "registered_number_limit") {
        el.registerStatus.textContent = msg.message || "登録数が上限を超えています";
      }
      log("error", msg.message || "エラーが発生しました。");
      break;
  }
  renderAll();
}

function startFlow(flow) {
  if (!state.connected || !state.ws || state.ws.readyState !== WebSocket.OPEN) {
    log("error", "サーバーへ接続してから入室してください。");
    renderAll();
    return;
  }
  if (!isRoomAvailable(state.selectedRoomKey)) {
    log("error", `${currentRoomId()} は接続先サーバーにまだありません。サーバー反映後に選べます。`);
    renderAll();
    return;
  }
  ensureName();
  state.pendingFlow = flow;
  state.sampleLoadedForFlow = false;
  state.cpuRequestedForFlow = false;
  state.startRequestedForFlow = false;
  state.appMode = "room";
  send({ type: "set_name", name: state.playerName });
  send({ type: "join_room", room_id: currentRoomId() });
  renderAll();
}

function continuePendingFlowAfterJoin() {
  if (!state.pendingFlow) return;
  if (state.pendingFlow === "enter") {
    loadSample();
    state.pendingFlow = null;
    return;
  }
  if (state.pendingFlow !== "watch") {
    loadSample();
    if (!state.isWaiting) {
      state.isWaiting = true;
      send({ type: "change_status", status: "waiting" });
    }
  }
}

function continuePendingFlowAfterRegistration() {
  if (state.pendingFlow === "practice") {
    if (!state.currentRoomHasCpu && !state.cpuRequestedForFlow) {
      state.cpuRequestedForFlow = true;
      addCpu();
      return;
    }
    if (!state.startRequestedForFlow) {
      state.startRequestedForFlow = true;
      setTimeout(startGame, 350);
    }
  }
}

function continuePendingFlowAfterCpuStatus() {
  if (state.pendingFlow === "practice" && state.sampleLoadedForFlow && state.currentRoomHasCpu && !state.startRequestedForFlow) {
    state.startRequestedForFlow = true;
    setTimeout(startGame, 350);
  }
}

function ensureName() {
  const typed = el.nameInput.value.trim();
  state.playerName = typed || randomName();
  el.nameInput.value = state.playerName;
}

function setRandomNameIfEmpty() {
  if (!el.nameInput.value.trim()) el.nameInput.placeholder = `例: ${randomSushiName()}`;
}

function setRandomName() {
  el.nameInput.value = randomName();
}

function randomName() {
  return `プレイヤー${Math.floor(1000 + Math.random() * 9000)}`;
}

function randomSushiName() {
  const sushiNames = [
    "マグロ",
    "サーモン",
    "イカ",
    "エビ",
    "タマゴ",
    "アナゴ",
    "イクラ",
    "ホタテ",
    "ハマチ",
    "ネギトロ",
    "カンパチ",
    "ブリ",
  ];
  return sushiNames[Math.floor(Math.random() * sushiNames.length)];
}

function leaveRoom() {
  send({ type: "leave_room" });
  state.roomJoined = false;
  state.appMode = "setup";
  state.isWaiting = false;
  state.pendingFlow = null;
  state.cpuChooserOpen = false;
  state.selectedCpuKey = "";
  state.hand = [];
  state.currentTurn = "";
  state.fieldCards = [];
  state.handCounts = [];
  state.firstPlayerId = null;
  clearFlowPreview(false);
  clearSelection();
  renderAll();
}

function toggleReady() {
  if (state.roomState === "playing") return;
  state.isWaiting = !state.isWaiting;
  send({ type: "change_status", status: state.isWaiting ? "waiting" : "watching" });
  if (!state.isWaiting) {
    state.hand = [];
    clearSelection();
  }
  renderAll();
}

function addCpu(cpuKey = "") {
  const profiles = state.roomCpuProfiles[currentRoomId()] || [];
  const selected = profiles.find((profile) => profile.key === cpuKey) || profiles[0];
  if (!selected) {
    log("error", "この部屋で選べるCPUがありません。");
    return;
  }
  send({ type: "add_cpu", cpu_key: selected.key });
}

function removeCpu() {
  send({ type: "remove_cpu" });
}

function toggleCpu() {
  if (state.roomState === "playing") return;
  if (state.currentRoomHasCpu) {
    state.cpuChooserOpen = false;
    removeCpu();
  } else {
    state.cpuChooserOpen = !state.cpuChooserOpen;
    renderCpuChooser();
  }
}

function selectCpuProfile() {
  state.selectedCpuKey = el.cpuProfileSelect.value;
  renderCpuChooser();
}

function closeCpuChooser() {
  state.cpuChooserOpen = false;
  renderCpuChooser();
}

function confirmCpuSelection() {
  const cpuKey = el.cpuProfileSelect.value || state.selectedCpuKey;
  state.selectedCpuKey = cpuKey;
  state.cpuChooserOpen = false;
  addCpu(cpuKey);
  renderCpuChooser();
}

function startGame() {
  send({ type: "start_game" });
}

function loadSample() {
  const selected = el.sampleSelect.value || currentRoomOption().defaultSampleKey || CONFIG.defaultSampleKey;
  send({ type: "load_sample_registered_primes", sample_key: selected });
  el.registerStatus.textContent = "サンプル読み込み中...";
}

function saveRegisteredNumbers() {
  send({
    type: "set_registered_numbers",
    prime_text: el.primeText.value,
    composite_text: el.compositeText.value,
  });
  el.registerStatus.textContent = "登録中...";
}

function renderRegisteredStatus(msg) {
  if (msg.sample_key) el.sampleSelect.value = msg.sample_key;
  if (msg.sample_prime_text) el.primeText.value = msg.sample_prime_text;
  if (msg.sample_composite_text) el.compositeText.value = msg.sample_composite_text;
  rebuildRegisteredPrimeValues();
  const primeCount = msg.prime_count ?? msg.count ?? 0;
  const compositeCount = msg.composite_count ?? 0;
  const errorCount = (msg.prime_errors || msg.errors || []).length + (msg.composite_errors || []).length;
  el.registerStatus.textContent = errorCount
    ? `素数 ${primeCount} / 合成数 ${compositeCount} / エラー ${errorCount}`
    : `素数 ${primeCount} / 合成数 ${compositeCount}`;
  scheduleAssist();
}

function renderSampleOptions() {
  const current = el.sampleSelect.value || currentRoomOption().defaultSampleKey || CONFIG.defaultSampleKey;
  const limit = state.roomRegisteredNumberLimits[currentRoomId()];
  const availableOptions = state.sampleOptions.filter((option) => (
    !Number.isFinite(limit)
    || !Number.isFinite(option.total_count)
    || option.total_count <= limit
  ));
  el.sampleSelect.innerHTML = "";
  availableOptions.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.key;
    opt.textContent = readableSampleLabel(option);
    el.sampleSelect.appendChild(opt);
  });
  if ([...el.sampleSelect.options].some((option) => option.value === current)) {
    el.sampleSelect.value = current;
  }
}

function readableSampleLabel(option) {
  const labels = {
    sashimi2024: "おすすめセット",
    tournament_order: "大会風セット",
    gold_prime_table: "ゴールド素数表",
    silver_prime_table: "シルバー素数表",
  };
  const label = labels[option.key] || option.label || option.key;
  return Number.isFinite(option.total_count)
    ? `${label}（${option.total_count}件）`
    : label;
}

function renderPlayers(players, waitingCount) {
  state.players = players;
  const parts = players.map(playerListLabel);
  el.playerList.textContent = parts.length ? parts.join("、") : "まだ誰もいません";
  if (waitingCount !== null) {
    const canStart = state.isWaiting && (waitingCount === 1 || waitingCount === 2);
    el.startBtn.disabled = !canStart;
  }
}

function playerListLabel(player) {
  const label = playerLabel(player);
  if (state.roomState === "playing") return label;
  return player.status === "waiting" ? label : `${label}(観戦)`;
}

function playerLabel(player) {
  if (player.id === state.playerId) return "自分";
  if (player.is_cpu) return player.name || "CPU";
  return player.name || "相手";
}

function turnLabel() {
  if (!state.currentTurn) return "未開始";
  const player = state.players.find((item) => item.name === state.currentTurn);
  if (player) return playerLabel(player);
  return state.currentTurn === state.playerName ? "自分" : state.currentTurn;
}

function renderField(msg) {
  state.deckCount = String(msg.deck_count ?? "-");
  state.fieldCards = msg.field || [];
  state.handCounts = msg.hand_counts || [];
  if (state.fieldCards.length) clearFlowPreview(false);
  el.deckCount.textContent = state.deckCount;
  renderFieldCards();
  renderHandMetrics();
}

function renderFieldCards() {
  const field = state.fieldCards.length ? state.fieldCards : state.flowPreviewCards;
  const isPreview = !state.fieldCards.length && state.flowPreviewCards.length;
  el.fieldCards.innerHTML = "";
  if (!field.length) {
    el.fieldCards.textContent = "まだ何も出ていません";
    el.fieldCards.classList.add("empty");
    el.fieldCards.classList.remove("flow-preview");
  } else {
    el.fieldCards.classList.remove("empty");
    el.fieldCards.classList.toggle("flow-preview", isPreview);
    field.forEach((card) => el.fieldCards.appendChild(cardButton(card, { staticOnly: true, field: true })));
  }
}

function showFlowPreview(cards) {
  if (!cards.length) return;
  state.flowPreviewCards = cards;
  if (state.flowPreviewTimer) clearTimeout(state.flowPreviewTimer);
  renderFieldCards();
  state.flowPreviewTimer = setTimeout(() => clearFlowPreview(true), 1100);
}

function clearFlowPreview(shouldRender = true) {
  if (state.flowPreviewTimer) clearTimeout(state.flowPreviewTimer);
  state.flowPreviewTimer = null;
  state.flowPreviewCards = [];
  if (shouldRender) renderFieldCards();
}

function renderHandMetrics() {
  if (state.roomState === "playing" && !state.isWaiting) {
    const spectatorCounts = spectatorHandCounts();
    renderSpectatorHandMetric(el.myHandMetric, el.myHandLabel, el.myHandCount, "先手", spectatorCounts[0]);
    renderSpectatorHandMetric(el.opponentMetric, el.opponentLabel, el.opponentCounts, "後手", spectatorCounts[1]);
    return;
  }

  el.myHandLabel.textContent = "手札";
  el.myHandCount.textContent = String(state.hand.length);
  el.myHandMetric.title = `自分の手札: ${state.hand.length}枚`;
  el.myHandMetric.setAttribute("aria-label", `自分の手札 ${state.hand.length}枚`);

  el.opponentLabel.textContent = "相手";
  renderOpponentCounts(state.handCounts);
}

function spectatorHandCounts() {
  if (!state.firstPlayerId) return state.handCounts;
  const firstIndex = state.handCounts.findIndex((item) => item.id === state.firstPlayerId);
  if (firstIndex < 0) return state.handCounts;
  const first = state.handCounts[firstIndex];
  return [first, ...state.handCounts.filter((_, index) => index !== firstIndex)];
}

function renderSpectatorHandMetric(metric, label, count, side, player) {
  const playerName = player?.name || "";
  label.textContent = playerName ? `${side} ${playerName}` : side;
  count.textContent = player ? String(player.count) : "-";
  const description = player
    ? `${side} ${playerName}の手札: ${player.count}枚`
    : `${side}: プレイヤーなし`;
  metric.title = description;
  metric.setAttribute("aria-label", description);
}

function renderOpponentCounts(handCounts) {
  const opponents = handCounts.filter((item) => (
    state.playerId && item.id
      ? item.id !== state.playerId
      : item.name !== state.playerName
  ));
  if (!opponents.length) {
    el.opponentCounts.textContent = "-";
    el.opponentCounts.title = "";
    el.opponentMetric.title = "相手の手札: 未確定";
    el.opponentMetric.setAttribute("aria-label", "相手の手札 未確定");
    return;
  }
  el.opponentCounts.textContent = opponents.map((item) => item.count).join("/");
  el.opponentCounts.title = opponents.map((item) => `${item.name}: ${item.count}`).join(" / ");
  const description = opponents.map((item) => `${item.name}の手札 ${item.count}枚`).join("、");
  el.opponentMetric.title = description;
  el.opponentMetric.setAttribute("aria-label", description);
}

function renderAll() {
  document.body.dataset.mode = state.appMode;
  el.setupPanel.classList.toggle("hidden", state.appMode !== "setup");
  el.roomPanel.classList.toggle("hidden", state.appMode === "setup");
  renderRoomChoice();
  el.playStatus.textContent = state.isWaiting
    ? state.roomState === "playing"
      ? "対戦中"
      : "対戦待ち"
    : "観戦中";
  el.turnLabel.textContent = turnLabel();
  el.readyBtn.textContent = state.isWaiting ? "待機をやめる" : "対戦に参加";
  el.readyBtn.disabled = state.roomState === "playing";
  el.addCpuBtn.textContent = state.currentRoomHasCpu ? "CPU退出" : "CPU追加";
  el.addCpuBtn.setAttribute("aria-expanded", String(state.cpuChooserOpen && !state.currentRoomHasCpu));
  el.addCpuBtn.disabled = state.roomState === "playing" || (
    !state.currentRoomHasCpu
    && !(state.roomCpuProfiles[currentRoomId()] || []).length
  );
  el.startBtn.disabled = state.roomState === "playing" || !state.isWaiting;
  renderCpuChooser();
  el.playBtn.disabled = !isMyTurn() || !state.selectedCards.length || (state.compositeMode && !state.compositeTokens.length);
  el.playBtn.textContent = isHnpChallengeSelection() ? "HNPチャレンジ" : "出す";
  el.compositeModeBtn.disabled = state.roomState !== "playing" || !state.hand.length;
  el.compositeModeBtn.textContent = "合成数出し";
  el.compositeModeBtn.classList.toggle("hidden", state.compositeMode);
  el.drawBtn.disabled = !isMyTurn();
  el.passBtn.disabled = !isMyTurn();
  el.turnBadge.textContent = isMyTurn() ? "あなたの番" : state.roomState === "playing" ? "相手の番" : "待機中";
  el.turnBadge.classList.toggle("ready", isMyTurn());
  el.turnBadge.classList.toggle("alert", state.roomState === "playing" && !isMyTurn());
  renderHandMetrics();
  renderNextHint();
  renderHand();
  renderSelection();
  renderCompositeZone();
  renderAssist();
}

function renderCpuChooser() {
  const profiles = state.roomCpuProfiles[currentRoomId()] || [];
  const shouldShow = state.cpuChooserOpen
    && !state.currentRoomHasCpu
    && state.roomState !== "playing"
    && profiles.length > 0;
  el.addCpuBtn.setAttribute("aria-expanded", String(shouldShow));
  el.cpuChooser.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  const selectedExists = profiles.some((profile) => profile.key === state.selectedCpuKey);
  if (!selectedExists) state.selectedCpuKey = profiles[0].key;

  el.cpuProfileSelect.replaceChildren(...profiles.map((profile) => {
    const option = document.createElement("option");
    option.value = profile.key;
    option.textContent = profile.label;
    return option;
  }));
  el.cpuProfileSelect.value = state.selectedCpuKey;

  const selected = profiles.find((profile) => profile.key === state.selectedCpuKey);
  el.cpuProfileDescription.textContent = selected?.description || "このCPUの説明はありません。";
  el.confirmCpuBtn.textContent = `${selected?.label || "CPU"}を追加`;
}

function renderRoomChoice() {
  const room = currentRoomOption();
  const roomId = currentRoomId();
  const count = state.roomCounts[roomId] ?? 0;

  el.roomBeginnerBtn.classList.toggle("active", state.selectedRoomKey === "beginner");
  el.roomAdvancedBtn.classList.toggle("active", state.selectedRoomKey === "advanced");
  el.roomBeginnerBtn.classList.toggle("unavailable", !isRoomAvailable("beginner"));
  el.roomAdvancedBtn.classList.toggle("unavailable", !isRoomAvailable("advanced"));
  el.roomBeginnerBtn.disabled = state.roomJoined || !isRoomAvailable("beginner");
  el.roomAdvancedBtn.disabled = state.roomJoined || !isRoomAvailable("advanced");
  el.roomBeginnerBtn.setAttribute("aria-pressed", String(state.selectedRoomKey === "beginner"));
  el.roomAdvancedBtn.setAttribute("aria-pressed", String(state.selectedRoomKey === "advanced"));

  el.practiceBtn.textContent = `${room.label}に入室する`;
  el.practiceBtn.disabled = !state.connected || !isRoomAvailable(state.selectedRoomKey);
  el.roomBadge.textContent = room.badge;
  el.roomHeading.textContent = room.roomHeading;
  const registeredNumberLimit = state.roomRegisteredNumberLimits[roomId];
  el.registerLimitNote.classList.toggle("hidden", !Number.isFinite(registeredNumberLimit));
  if (Number.isFinite(registeredNumberLimit)) {
    el.registerLimitNote.textContent = `${room.label}は素数・合成数あわせて${registeredNumberLimit}件まで登録できます。`;
  }
  if (state.connected && state.appMode === "setup") {
    renderServerRoomStatus(roomId, count);
  }
}

function renderServerRoomStatus(roomId, count) {
  const population = document.createElement("span");
  population.className = "room-population";
  population.classList.toggle("has-players", count > 0);
  population.textContent = `${count}人`;
  el.serverLabel.replaceChildren(
    document.createTextNode(`既存サーバー / ${roomId} / `),
    population,
  );
}

function renderNextHint() {
  if (!state.roomJoined) {
    el.nextHint.textContent = "まず入室します。入室後に対戦参加、CPU追加、開始を選べます。";
    return;
  }
  if (state.roomState !== "playing") {
    if (!state.isWaiting) {
      el.nextHint.textContent = "観戦中です。遊ぶ場合は「対戦に参加」を押してください。";
    } else if (!state.currentRoomHasCpu) {
      el.nextHint.textContent = "「開始」で一人プレイ、CPUを追加して「開始」でCPU対戦ができます。友だちを待つ場合はこのまま待てます。";
    } else {
      el.nextHint.textContent = "準備OKです。「開始」を押すと練習対戦が始まります。";
    }
    return;
  }
  if (isMyTurn()) {
    el.nextHint.textContent = state.lastAssistCandidates.length
      ? "おすすめ候補を押すと、出すカードが自動で選ばれます。"
      : "候補がない場合はドローかパスを試してください。";
  } else {
    el.nextHint.textContent = "相手の番です。場と手札を見ながら次の候補を待ちましょう。";
  }
}

function renderHand() {
  el.remainingFinishNotice.classList.toggle(
    "hidden",
    !state.selectedCards.length || !state.remainingFinishExists,
  );
  el.handCards.innerHTML = "";
  if (!state.hand.length) {
    setCardRowColumns(el.handCards, 1);
    el.handCards.textContent = state.roomState === "playing" ? "手札を待っています" : "ゲーム開始後に表示されます";
    el.handCards.classList.add("empty-row");
    return;
  }
  const selectedIds = new Set(state.selectedCards.map((card) => card.card_id));
  const compositeIds = new Set(state.compositeTokens.filter((token) => token.kind === "card").map((token) => token.card_id));
  const visibleHand = state.hand.filter((card) => !selectedIds.has(card.card_id) && !compositeIds.has(card.card_id));
  if (!visibleHand.length) {
    setCardRowColumns(el.handCards, 1);
    el.handCards.textContent = "すべて選択中または材料中";
    el.handCards.classList.add("empty-row");
    return;
  }
  setCardRowColumns(el.handCards, visibleHand.length);
  el.handCards.classList.remove("empty-row");
  visibleHand.forEach((card) => {
    const btn = cardButton(card);
    btn.addEventListener("click", () => toggleCard(card, "hand"));
    el.handCards.appendChild(btn);
  });
}

function renderSelection() {
  el.selectedCards.innerHTML = "";
  if (!state.selectedCards.length) {
    if (state.assistFilters.target_scope === "unselected") state.assistFilters.target_scope = "all";
    setCardRowColumns(el.selectedCards, 1);
    el.selectedCards.textContent = "未選択";
    el.selectedCards.classList.add("empty-row");
    el.selectedTitle.textContent = "選択中: なし";
  } else {
    setCardRowColumns(el.selectedCards, state.selectedCards.length);
    el.selectedCards.classList.remove("empty-row");
    state.selectedCards.forEach((card) => {
      const btn = cardButton(card);
      btn.classList.add("selected");
      btn.addEventListener("click", () => toggleCard(card, "selected"));
      el.selectedCards.appendChild(btn);
    });
    const number = selectedNumberText();
    el.selectedTitle.textContent = number
      ? isHnpChallengeSelection()
        ? `選択中: ${number} (HNP)`
        : `選択中: ${number}`
      : "選択中: X=?";
  }
  renderJokerControls();
}

function setCardRowColumns(container, count) {
  const cardCount = Math.max(1, count || 1);
  const columns = Math.min(18, cardCount);
  const styles = getComputedStyle(container);
  const cardWidth = parseFloat(styles.getPropertyValue("--card-width")) || 52;
  const configuredGap = parseFloat(styles.getPropertyValue("--card-gap")) || 0;
  const availableWidth = container.clientWidth || 0;
  const fullWidth = cardCount * cardWidth + Math.max(0, cardCount - 1) * configuredGap;

  if (availableWidth > 0 && fullWidth <= availableWidth) {
    container.style.gridTemplateColumns = `repeat(${cardCount}, var(--card-width))`;
    container.style.columnGap = "var(--card-gap)";
    return;
  }

  const overlapStep = columns > 1
    ? Math.max(1, (availableWidth - cardWidth) / (columns - 1))
    : cardWidth;
  container.style.gridTemplateColumns = `repeat(${columns}, ${overlapStep}px)`;
  container.style.columnGap = "0px";
}

function renderJokerControls() {
  el.jokerControls.innerHTML = "";
  const jokers = state.selectedCards.filter(isJoker);
  jokers.forEach((_, index) => {
    const label = document.createElement("label");
    label.textContent = `ジョーカー${index + 1}`;
    const select = document.createElement("select");
    ["inf", ...Array.from({ length: 14 }, (_, i) => String(i))].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "inf" ? "∞" : value;
      select.appendChild(option);
    });
    select.value = state.jokerAssignedRanks[index] ?? "inf";
    select.addEventListener("change", () => {
      state.jokerAssignedRanks[index] = select.value;
      renderSelection();
      scheduleAssist();
    });
    label.appendChild(select);
    el.jokerControls.appendChild(label);
  });
}

function renderCompositeZone() {
  el.compositePanel.classList.toggle("hidden", !state.compositeMode);
  el.compositeCards.innerHTML = "";
  el.compositeJokerControls.innerHTML = "";
  if (!state.compositeMode) return;

  normalizeCompositeJokerRanks();
  const expression = tokensToText(state.compositeTokens, state.compositeJokerAssign);
  el.compositeTitle.textContent = `${selectedNumberText() || "?"} = ${expression || "材料未選択"}`;
  if (!state.compositeTokens.length) {
    setCardRowColumns(el.compositeCards, 1);
    el.compositeCards.textContent = "手札から材料札を選んでください";
    el.compositeCards.classList.add("empty-row");
  } else {
    setCardRowColumns(el.compositeCards, state.compositeTokens.length);
    el.compositeCards.classList.remove("empty-row");
    state.compositeTokens.forEach((token, index) => {
      if (token.kind === "op") {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "operator-token";
        btn.textContent = token.op;
        btn.title = "クリックで削除";
        btn.addEventListener("click", () => removeCompositeToken(index));
        el.compositeCards.appendChild(btn);
        return;
      }

      const card = cardForToken(token);
      const btn = cardButton(card);
      btn.classList.add("selected");
      btn.title = "クリックで材料から外す";
      btn.addEventListener("click", () => removeCompositeToken(index));
      el.compositeCards.appendChild(btn);
    });
  }

  renderCompositeJokerControls();
}

function renderCompositeJokerControls() {
  const jokers = state.compositeTokens
    .filter((token) => token.kind === "card")
    .map(cardForToken)
    .filter(isJoker);
  normalizeCompositeJokerRanks();
  jokers.forEach((_, index) => {
    const label = document.createElement("label");
    label.textContent = `式ジョーカー${index + 1}`;
    const select = document.createElement("select");
    ["inf", ...Array.from({ length: 14 }, (_, i) => String(i))].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value === "inf" ? "∞" : value;
      select.appendChild(option);
    });
    select.value = state.compositeJokerAssign[index] ?? "inf";
    select.addEventListener("change", () => {
      state.compositeJokerAssign[index] = select.value;
      renderCompositeZone();
    });
    label.appendChild(select);
    el.compositeJokerControls.appendChild(label);
  });
}

function renderAssist() {
  const recommendationMode = state.assistFilters.order === "recommended";
  el.assistRecommendedBtn.classList.toggle("active", recommendationMode);
  el.assistStrongBtn.classList.toggle("active", state.assistFilters.order === "strong");
  el.assistEasyBtn.classList.toggle("active", state.assistFilters.order === "weak");
  el.assistRestBtn.classList.toggle("active", state.assistFilters.target_scope === "unselected");
  el.assistRestBtn.disabled = !state.selectedCards.length;
  el.assistManyBtn.classList.toggle("hidden", recommendationMode);
  el.assistManyBtn.classList.toggle("active", state.assistFilters.limit_mode === "fifty");
  el.assistManyBtn.textContent = state.assistFilters.limit_mode === "fifty" ? "減らす" : "増やす";
  el.assistManyBtn.title = state.assistFilters.limit_mode === "fifty" ? "候補: 多め" : "候補: 少なめ";
  el.assistList.innerHTML = "";
  if (state.roomState !== "playing" || !state.hand.length) {
    el.assistList.textContent = "ゲーム開始後に候補が出ます";
    el.assistList.classList.add("empty");
    return;
  }
  if (!state.lastAssistCandidates.length) {
    el.assistList.textContent = "候補なし";
    el.assistList.classList.add("empty");
    return;
  }
  el.assistList.classList.remove("empty");
  state.lastAssistCandidates.forEach((candidate, index) => {
    const btn = document.createElement("button");
    btn.className = "assist-card";
    btn.type = "button";

    const number = document.createElement("span");
    number.className = "assist-number";
    number.textContent = candidate.visible_text || candidate.number || assistCardsText(candidate.cards, candidate.assigned_numbers);
    btn.appendChild(number);

    const tags = assistTags(candidate);
    if (tags.length) {
      const tagRow = document.createElement("span");
      tagRow.className = "assist-tags";
      tags.forEach((label) => {
        const tag = document.createElement("span");
        tag.className = "assist-tag";
        tag.textContent = label;
        tagRow.appendChild(tag);
      });
      btn.appendChild(tagRow);
    }

    btn.addEventListener("click", () => applyAssistCandidate(candidate));
    el.assistList.appendChild(btn);
  });
}

function assistTags(candidate) {
  const tags = [];
  if (candidate.kind === "composite") tags.push("合成");
  if (candidate.special_effect === "infinity") tags.push("∞");
  if (candidate.special_effect === "cut") tags.push("カット");
  if (candidate.special_effect === "revolution") tags.push("革命");
  if (candidate.field_count_match === false) tags.push("枚数注意");
  if (candidate.next_finish) tags.push("次で上がり");
  if (candidateFinishesRemaining(candidate)) tags.push("残り上がり");
  if (candidate.finishes_hand) tags.push("上がり");
  return tags;
}

function candidateFinishesRemaining(candidate) {
  if (candidate.finishes_remaining) return true;
  const selectedIds = new Set([
    ...state.selectedCards.map((card) => card.card_id),
    ...state.compositeTokens
      .filter((token) => token.kind === "card")
      .map((token) => token.card_id),
  ]);
  if (!selectedIds.size) return false;

  const remainingIds = new Set(
    state.hand
      .filter((card) => !selectedIds.has(card.card_id))
      .map((card) => card.card_id),
  );
  const usedIds = new Set([
    ...(candidate.cards || []).map((card) => card.card_id),
    ...(((candidate.composite || {}).cards) || []).map((card) => card.card_id),
  ]);
  return remainingIds.size > 0
    && remainingIds.size === usedIds.size
    && [...remainingIds].every((cardId) => usedIds.has(cardId));
}

function toggleCard(card, source = "hand") {
  if (state.compositeMode && source === "hand") {
    addCompositeCard(card);
    return;
  }
  const index = state.selectedCards.findIndex((item) => item.card_id === card.card_id);
  if (index >= 0) {
    state.selectedCards.splice(index, 1);
  } else {
    state.selectedCards.push(card);
  }
  normalizeJokerRanks();
  renderAll();
  scheduleAssist();
}

function toggleCompositeMode() {
  if (state.compositeMode) {
    clearCompositeMode();
  } else {
    state.compositeMode = true;
    state.compositeTokens = [];
    state.compositeJokerAssign = [];
  }
  renderAll();
}

function addCompositeCard(card) {
  removeCompositeCard(card.card_id);
  state.selectedCards = state.selectedCards.filter((item) => item.card_id !== card.card_id);
  state.compositeTokens.push({ kind: "card", card_id: card.card_id });
  normalizeJokerRanks();
  normalizeCompositeJokerRanks();
  renderAll();
  scheduleAssist();
}

function addCompositeOp(op) {
  if (!state.compositeMode) return;
  const last = state.compositeTokens[state.compositeTokens.length - 1];
  if (!last || last.kind !== "card") return;
  state.compositeTokens.push({ kind: "op", op });
  renderAll();
}

function removeCompositeToken(index) {
  state.compositeTokens.splice(index, 1);
  normalizeCompositeJokerRanks();
  renderAll();
}

function removeCompositeCard(cardId) {
  const index = state.compositeTokens.findIndex((token) => token.kind === "card" && token.card_id === cardId);
  if (index >= 0) state.compositeTokens.splice(index, 1);
}

function applyAssistCandidate(candidate) {
  const handById = new Map(state.hand.map((card) => [card.card_id, card]));
  state.selectedCards = (candidate.cards || []).map((card) => handById.get(card.card_id)).filter(Boolean);
  state.jokerAssignedRanks = (candidate.assigned_numbers || []).map(String);
  if (candidate.kind === "composite") {
    state.compositeMode = true;
    state.compositeTokens = ((candidate.composite && candidate.composite.tokens) || []).map((token) => ({ ...token }));
    state.compositeJokerAssign = ((candidate.composite && candidate.composite.assigned_numbers) || []).map(String);
  } else {
    clearCompositeMode();
  }
  normalizeJokerRanks();
  normalizeCompositeJokerRanks();
  scheduleAssist(0);
  renderAll();
}

function clearSelection() {
  state.selectedCards = [];
  state.jokerAssignedRanks = [];
  clearCompositeMode();
  renderAll();
  scheduleAssist();
}

function clearCompositeMode() {
  state.compositeMode = false;
  state.compositeTokens = [];
  state.compositeJokerAssign = [];
}

function normalizeJokerRanks() {
  const count = state.selectedCards.filter(isJoker).length;
  state.jokerAssignedRanks = state.jokerAssignedRanks.slice(0, count);
  while (state.jokerAssignedRanks.length < count) state.jokerAssignedRanks.push("inf");
}

function normalizeCompositeJokerRanks() {
  const count = state.compositeTokens
    .filter((token) => token.kind === "card")
    .map(cardForToken)
    .filter(isJoker).length;
  state.compositeJokerAssign = state.compositeJokerAssign.slice(0, count);
  while (state.compositeJokerAssign.length < count) state.compositeJokerAssign.push("inf");
}

function cardForToken(token) {
  return state.hand.find((card) => card.card_id === token.card_id) || token;
}

function selectedNumberText() {
  if (!state.selectedCards.length) return "";
  const parts = [];
  let jokerIndex = 0;
  for (const card of state.selectedCards) {
    if (isJoker(card)) {
      const value = state.jokerAssignedRanks[jokerIndex++] ?? "inf";
      if (value === "inf") return "";
      parts.push(value);
    } else {
      parts.push(String(card.rank));
    }
  }
  const text = parts.join("");
  return text.startsWith("0") ? "" : text;
}

function registeredPatternToValue(pattern) {
  const faceValues = { t: "10", j: "11", q: "12", k: "13" };
  const text = String(pattern || "").trim().toLowerCase();
  if (!/^[0-9tjqk]+$/.test(text)) return null;
  const value = [...text].map((char) => faceValues[char] || char).join("");
  return !value || value.startsWith("0") ? null : value;
}

function rebuildRegisteredPrimeValues() {
  state.registeredPrimeValues = new Set();
  String(el.primeText.value || "").split(/[\s,、，]+/).forEach((token) => {
    const value = registeredPatternToValue(token);
    if (value !== null) state.registeredPrimeValues.add(value);
  });
}

function isHnpChallengeSelection() {
  if (!state.hnpChallengeEnabled || state.compositeMode || state.selectedCards.length < 2) return false;
  const number = selectedNumberText();
  if (!number || number === "57" || number === "1729") return false;
  return !state.registeredPrimeValues.has(number);
}

function playSelected() {
  if (!state.selectedCards.length) return;
  if (state.compositeMode) {
    const lastToken = state.compositeTokens[state.compositeTokens.length - 1];
    if (!lastToken || lastToken.kind !== "card") {
      log("error", "合成数出しゾーンに材料札で終わる式を作ってください。");
      return;
    }
    if (!selectedNumberText() || state.jokerAssignedRanks.some((value) => String(value) === "inf")) {
      log("error", "合成数出しでは、選択中のジョーカー値を数字にしてください。");
      return;
    }
    if (state.compositeJokerAssign.some((value) => String(value) === "inf")) {
      log("error", "合成数出しゾーンのジョーカー値を数字にしてください。");
      return;
    }
    send({
      type: "play_card",
      mode: "composite",
      selected: {
        cards: state.selectedCards,
        assigned_numbers: state.jokerAssignedRanks,
      },
      consume: {
        cards: compositeConsumeCards(),
      },
      composite: {
        tokens: state.compositeTokens,
        assigned_numbers: state.compositeJokerAssign,
      },
    });
  } else {
    send({
      type: "play_card",
      cards: state.selectedCards,
      assigned_numbers: state.jokerAssignedRanks,
    });
  }
  clearSelection();
}

function compositeConsumeCards() {
  const handById = new Map(state.hand.map((card) => [card.card_id, card]));
  return state.compositeTokens
    .filter((token) => token.kind === "card")
    .map((token) => handById.get(token.card_id))
    .filter(Boolean);
}

function scheduleAssist(delay = 220) {
  if (state.assistTimer) clearTimeout(state.assistTimer);
  state.assistRequestVersion += 1;
  const requestVersion = state.assistRequestVersion;
  state.remainingFinishExists = false;
  if (el.remainingFinishNotice) el.remainingFinishNotice.classList.add("hidden");
  state.assistTimer = setTimeout(() => requestAssist(requestVersion), delay);
}

function requestAssist(requestVersion = state.assistRequestVersion) {
  state.assistTimer = null;
  if (requestVersion !== state.assistRequestVersion) return;
  if (state.roomState !== "playing" || !state.hand.length || !state.roomJoined) return;
  send({
    type: "get_prime_assist",
    assist_request_id: requestVersion,
    selected_card_ids: state.selectedCards.map((card) => card.card_id),
    composite_card_ids: state.compositeTokens
      .filter((token) => token.kind === "card")
      .map((token) => token.card_id),
    filters: state.assistFilters,
    limit: state.assistFilters.limit_mode === "fifty" ? 50 : 10,
  });
}

function setAssistOrder(order) {
  state.assistFilters.order = order;
  scheduleAssist();
  renderAssist();
}

function toggleAssistLimit() {
  state.assistFilters.limit_mode = state.assistFilters.limit_mode === "fifty" ? "ten" : "fifty";
  scheduleAssist();
  renderAssist();
}

function toggleAssistRest() {
  state.assistFilters.target_scope = state.assistFilters.target_scope === "unselected" ? "all" : "unselected";
  scheduleAssist();
  renderAssist();
}

function cardButton(card, options = {}) {
  const btn = document.createElement(options.staticOnly ? "div" : "button");
  btn.className = `playing-card ${isRedSuit(card.suit) ? "red" : ""}`;
  if (options.field) btn.classList.add("field-card");
  if (!options.staticOnly) btn.type = "button";
  const suit = document.createElement("span");
  suit.className = "suit";
  suit.textContent = suitLabel(card);
  const rank = document.createElement("span");
  rank.className = "rank";
  rank.textContent = rankLabel(card);
  btn.append(suit, rank);
  return btn;
}

function suitLabel(card) {
  if (isJoker(card)) return "☆";
  return { H: "♥", D: "♦", S: "♠", C: "♣" }[card.suit] || card.suit || "";
}

function rankLabel(card) {
  if (isJoker(card)) return "X";
  return { 1: "A", 10: "T", 11: "J", 12: "Q", 13: "K" }[Number(card.rank)] || String(card.rank);
}

function isJoker(card) {
  return card?.is_joker || card?.suit === "X";
}

function isRedSuit(suit) {
  return suit === "H" || suit === "D";
}

function assistCardsText(cards = [], assigned = []) {
  let jokerIndex = 0;
  return cards
    .map((card) => {
      if (!isJoker(card)) return rankLabel(card);
      const value = assigned[jokerIndex++] ?? "?";
      return value === "inf" ? "X" : `X=${value}`;
    })
    .join("");
}

function tokensToText(tokens = [], assigned = []) {
  const handById = new Map(state.hand.map((card) => [card.card_id, card]));
  let jokerIndex = 0;
  return tokens
    .map((token) => {
      if (token.kind === "op") return token.op === "*" ? "×" : token.op;
      const card = handById.get(token.card_id) || token;
      if (!isJoker(card)) return rankLabel(card);
      const value = assigned[jokerIndex++] ?? "?";
      return `X=${value}`;
    })
    .join(" ");
}

function isMyTurn() {
  return Boolean(state.currentTurn && state.playerName && state.currentTurn === state.playerName && state.roomState === "playing");
}

function sendChat() {
  const message = el.chatInput.value.trim();
  if (!message) return;
  send({ type: "chat", message });
  el.chatInput.value = "";
}

function send(payload) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    log("error", "まだサーバーに接続できていません。");
    return;
  }
  state.ws.send(JSON.stringify(payload));
}

function setConnection(kind, label, detail) {
  el.connectionDot.className = "dot";
  if (kind === "online") el.connectionDot.classList.add("online");
  if (kind === "error") el.connectionDot.classList.add("error");
  el.connectionLabel.textContent = label;
  el.serverLabel.textContent = detail;
}

function log(sender, message) {
  const line = document.createElement("div");
  line.className = "log-line";
  const strong = document.createElement("strong");
  strong.textContent = sender;
  line.append(strong, document.createTextNode(`: ${message}`));
  el.logBox.prepend(line);
}

function logScoreRecord(lines) {
  if (!lines.length) return;
  const entry = document.createElement("details");
  entry.className = "log-line score-record";
  entry.open = true;

  const summary = document.createElement("summary");
  summary.textContent = "数譜";
  entry.appendChild(summary);

  const pre = document.createElement("pre");
  pre.textContent = lines.join("\n");
  entry.appendChild(pre);

  el.logBox.prepend(entry);
}
