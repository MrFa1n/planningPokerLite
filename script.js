document.addEventListener("DOMContentLoaded", () => {
  if (
    typeof startTutorial === "function" &&
    !localStorage.getItem("tutorialCompleted_v1")
  ) {
    setTimeout(() => {
      startTutorial(loginTutorialSteps, false);
    }, 500);
  }

  const ROOM_PREFIX = "mgmt_poker_v7/rooms/";
  const HEARTBEAT_INTERVAL = 5000;
  const PLAYER_TIMEOUT = 15000;
  const VOTING_ROLES = ["FE", "BE", "QA", "BA/SA", "Other"];

  const netStatusEl = document.getElementById("net-status");
  const roomIdEl = document.getElementById("room-id");
  const timerDisplayEl = document.getElementById("timer-display");
  const timerSecondsEl = document.getElementById("timer-seconds");
  const userBadgeEl = document.getElementById("user-badge");
  const myRoleIconEl = document.getElementById("my-role-icon");
  const myDisplayNameEl = document.getElementById("my-display-name");
  const controlsEl = document.getElementById("controls");
  const pmControlsEl = document.getElementById("pm-controls");
  const voterRoleControlsEl = document.getElementById("voter-role-controls");
  const votingRolesDisplayEl = document.getElementById("voting-roles-display");
  const pmOnlyMsgEl = document.getElementById("pm-only-msg");
  const btnReveal = document.getElementById("btn-reveal");
  const btnReset = document.getElementById("btn-reset");
  const timerSelectEl = document.getElementById("timer-select");
  const loginScreenEl = document.getElementById("login-screen");
  const usernameEl = document.getElementById("username");
  const rolesGridEl = document.getElementById("roles-grid");
  const isObserverEl = document.getElementById("is-observer");
  const newRoomBtn = document.getElementById("new-room-btn");
  const gameScreenEl = document.getElementById("game-screen");
  const playersGridEl = document.getElementById("players-grid");
  const handPanelEl = document.getElementById("hand-panel");
  const lockOverlayEl = document.getElementById("lock-overlay");
  const cardsContainerEl = document.getElementById("cards-container");

  let myName = "",
    myRole = "",
    isObserver = false,
    isRevealed = false;
  let players = {};
  let timerEndTimestamp = null;
  let timerInterval = null;
  let heartbeatInterval = null;
  let allowedVoters = [];

  const roomHash =
    window.location.hash.replace("#", "") ||
    Math.random().toString(36).substring(7);
  window.location.hash = roomHash;
  roomIdEl.innerText = roomHash.toUpperCase();

  const myId = Math.random().toString(36).substring(7);
  const topic = `${ROOM_PREFIX}${roomHash}`;
  const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

  window.copyRoomLink = copyRoomLink;
  window.leaveGame = leaveGame;
  window.startTimer = startTimer;
  window.broadcastAction = broadcastAction;
  window.setRole = setRole;
  window.toggleObserverMode = toggleObserverMode;
  window.joinGame = joinGame;
  window.pickCard = pickCard;

  if (newRoomBtn) {
    newRoomBtn.addEventListener("click", () => {
      window.location.hash = "";
      window.location.reload();
    });
  }

  function generateCards() {
    if (!cardsContainerEl) return;
    let buttonsHTML = "";
    for (let i = 1; i <= 20; i++) {
      buttonsHTML += `<button onclick="pickCard('${i}')" class="choice-btn w-11 h-14 rounded-xl font-black text-sm" title="Оценить в ${i} единиц">${i}</button>`;
    }
    cardsContainerEl.innerHTML = buttonsHTML;
  }

  client.on("connect", () => {
    netStatusEl.className =
      "w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]";
    client.subscribe(topic);
    broadcastAction("ping");
  });

  client.on("message", (t, msg) => {
    const data = JSON.parse(msg.toString());

    switch (data.type) {
      case "update":
        players[data.id] = { ...data, ts: Date.now() };
        render();
        break;
      case "leave":
        delete players[data.id];
        render();
        break;
      case "reveal":
        isRevealed = true;
        stopLocalTimer();
        btnReveal.disabled = true;
        btnReset.classList.add("highlight-action");
        render();
        break;
      case "reset":
        isRevealed = false;
        stopLocalTimer();
        btnReset.classList.remove("highlight-action");
        if (myRole === "PM") {
          btnReveal.disabled = false;
        }
        Object.keys(players).forEach((id) => {
          if (players[id]) players[id].vote = null;
        });
        document
          .querySelectorAll(".choice-btn")
          .forEach((b) => b.classList.remove("active"));
        render();
        break;
      case "timer_start":
        startLocalTimer(data.endTime);
        break;
      case "vote_control":
        allowedVoters = data.allowedRoles;
        if (myRole === "PM") {
          voterRoleControlsEl
            .querySelectorAll(".role-checkbox")
            .forEach((box) => {
              box.checked = allowedVoters.includes(box.value);
            });
        }
        updateVotingAbility();
        updateVotingRolesDisplay();
        render();
        break;
      case "ping":
        if (myName) {
          sendUpdate(players[myId]?.vote || null);
          if (myRole === "PM") {
            if (timerEndTimestamp) broadcastTimer(timerEndTimestamp);
            broadcastVoteControl();
          }
        }
        break;
    }
  });

  function toggleObserverMode(checked) {
    if (checked) {
      myRole = "";
      rolesGridEl.classList.add("roles-disabled");
      document
        .querySelectorAll(".role-btn")
        .forEach(
          (b) =>
            (b.className =
              "role-btn py-3 bg-white/5 border border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all hover:border-slate-600 opacity-50"),
        );
    } else {
      rolesGridEl.classList.remove("roles-disabled");
    }
  }

  function setRole(role, btn) {
    isObserverEl.checked = false;
    rolesGridEl.classList.remove("roles-disabled");

    myRole = role;
    document
      .querySelectorAll(".role-btn")
      .forEach(
        (b) =>
          (b.className =
            "role-btn py-3 bg-white/5 border border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all hover:border-slate-600 opacity-50"),
      );
    btn.className =
      "role-btn py-3 bg-cyan-500/20 border border-cyan-500 rounded-xl text-[10px] font-black uppercase text-cyan-400 shadow-lg";
  }

  function broadcastVoteControl() {
    client.publish(
      topic,
      JSON.stringify({ type: "vote_control", allowedRoles: allowedVoters }),
    );
  }

  function initVoterControls() {
    let checkboxesHTML = `<span class="text-xs font-semibold uppercase text-slate-500 w-full mb-2 block text-center">Разрешить голосовать:</span><div class="flex flex-wrap gap-2 justify-center">`;
    VOTING_ROLES.forEach((role) => {
      checkboxesHTML += `
              <label class="role-chip">
                  <input type="checkbox" value="${role}" class="role-checkbox">
                  <span>${role}</span>
              </label>
          `;
    });
    checkboxesHTML += `<button id="select-all-roles-btn" class="role-chip-all">Всем</button></div>`;
    voterRoleControlsEl.innerHTML = checkboxesHTML;

    voterRoleControlsEl.querySelectorAll(".role-checkbox").forEach((box) => {
      box.addEventListener("change", () => {
        allowedVoters = Array.from(
          voterRoleControlsEl.querySelectorAll(".role-checkbox:checked"),
        ).map((b) => b.value);
        broadcastVoteControl();
      });
    });

    document
      .getElementById("select-all-roles-btn")
      .addEventListener("click", () => {
        const allSelected = allowedVoters.length === VOTING_ROLES.length;
        voterRoleControlsEl
          .querySelectorAll(".role-checkbox")
          .forEach((box) => (box.checked = !allSelected));
        allowedVoters = allSelected ? [] : [...VOTING_ROLES];
        broadcastVoteControl();
      });
  }

  function updateVotingAbility() {
    if (isObserver) {
      handPanelEl.classList.add("hidden");
      return;
    }

    const canVote = allowedVoters.includes(myRole);

    if (myRole === "PM") {
      handPanelEl.classList.remove("hidden");
      cardsContainerEl.classList.add("hidden");
      voterRoleControlsEl.classList.remove("hidden");
    } else {
      voterRoleControlsEl.classList.add("hidden");
      if (canVote) {
        handPanelEl.classList.remove("hidden");
        cardsContainerEl.classList.remove("hidden");
      } else {
        handPanelEl.classList.add("hidden");
      }
    }
  }

  function updateVotingRolesDisplay() {
    if (!votingRolesDisplayEl) return;
    const pmExists = Object.values(players).some((p) => p.role === "PM");

    if (!pmExists) {
      votingRolesDisplayEl.innerHTML =
        "<div><span class='font-bold text-slate-500'>Ожидание подключения PM...</span></div>";
      return;
    }

    if (allowedVoters.length === VOTING_ROLES.length) {
      votingRolesDisplayEl.innerHTML =
        "<div>Голосуют: <span class='font-bold'>Все роли</span></div>";
    } else if (allowedVoters.length === 0) {
      votingRolesDisplayEl.innerHTML =
        "<div><span class='font-bold text-red-400'>Голосование отключено</span></div>";
    } else {
      votingRolesDisplayEl.innerHTML = `<div>Голосуют: <span class='font-bold'>${allowedVoters.join(", ")}</span></div>`;
    }
  }

  function joinGame() {
    myName = usernameEl.value.trim();
    isObserver = isObserverEl.checked;

    if (!myName) {
      alert("Пожалуйста, введите ваше имя.");
      return;
    }
    if (!isObserver && !myRole) {
      alert("Пожалуйста, выберите роль или режим наблюдателя.");
      return;
    }

    if (isObserver) myRole = "Observer";

    if (myRole === "PM") {
      const pmExists = Object.values(players).some(
        (p) => p.role === "PM" && Date.now() - p.ts < PLAYER_TIMEOUT,
      );
      if (pmExists) {
        alert("В этой комнате уже есть PM. Выберите другую роль.");
        return;
      }
    }

    loginScreenEl.style.display = "none";
    gameScreenEl.classList.remove("hidden");
    controlsEl.classList.remove("hidden");
    userBadgeEl.classList.remove("hidden");
    votingRolesDisplayEl.classList.remove("hidden");

    if (myRole === "PM") {
      pmControlsEl.classList.remove("hidden");
      btnReveal.disabled = false;
      btnReset.disabled = false;
      pmOnlyMsgEl.classList.add("hidden");
      initVoterControls();
    } else {
      pmControlsEl.classList.add("hidden");
      btnReveal.disabled = true;
      btnReset.disabled = true;
      pmOnlyMsgEl.classList.remove("hidden");
    }

    myDisplayNameEl.innerText = myName;
    const roleIconClass = `role-${myRole.toLowerCase().replace("/", "")}`;
    myRoleIconEl.innerText = myRole === "Observer" ? "👁️" : myRole;
    myRoleIconEl.className = `w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] border ${roleIconClass}`;

    updateVotingAbility();

    sendUpdate(null);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(
      () => sendUpdate(players[myId]?.vote || null),
      HEARTBEAT_INTERVAL,
    );

    if (
      typeof startTutorial === "function" &&
      !localStorage.getItem("tutorialCompleted_v1")
    ) {
      let steps;
      if (myRole === "PM") {
        steps = pmTutorialSteps;
      } else if (isObserver) {
        steps = observerTutorialSteps;
      } else {
        steps = voterTutorialSteps;
      }

      setTimeout(() => startTutorial(steps, true), 500);
    }
  }

  function leaveGame() {
    broadcastAction("leave");
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    stopLocalTimer();

    myName = "";
    myRole = "";
    isObserver = false;

    votingRolesDisplayEl.classList.add("hidden");
    gameScreenEl.classList.add("hidden");
    controlsEl.classList.add("hidden");
    userBadgeEl.classList.add("hidden");
    loginScreenEl.style.display = "block";
    usernameEl.value = "";
    isObserverEl.checked = false;
    rolesGridEl.classList.remove("roles-disabled");
    document
      .querySelectorAll(".role-btn")
      .forEach(
        (b) =>
          (b.className =
            "role-btn py-3 bg-white/5 border border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all hover:border-slate-600 opacity-50"),
      );
  }

  function startTimer() {
    const seconds = parseInt(timerSelectEl.value);
    if (seconds <= 0) return;
    broadcastTimer(Date.now() + seconds * 1000);
  }

  function broadcastTimer(endTime) {
    client.publish(
      topic,
      JSON.stringify({ type: "timer_start", endTime: endTime }),
    );
  }

  function startLocalTimer(endTime) {
    stopLocalTimer();
    timerEndTimestamp = endTime;
    timerDisplayEl.classList.remove("hidden");
    timerInterval = setInterval(() => {
      const diff = Math.max(
        0,
        Math.floor((timerEndTimestamp - Date.now()) / 1000),
      );
      if (diff <= 0) {
        stopLocalTimer();
        if (myRole === "PM") broadcastAction("reveal");
      } else {
        const m = Math.floor(diff / 60);
        const s = diff % 60;
        timerSecondsEl.innerText = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        timerSecondsEl.classList.toggle("timer-active", diff <= 10);
      }
    }, 500);
  }

  function stopLocalTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    timerEndTimestamp = null;
    timerDisplayEl.classList.add("hidden");
  }

  function pickCard(val) {
    if (
      isRevealed ||
      isObserver ||
      myRole === "PM" ||
      !allowedVoters.includes(myRole)
    )
      return;
    const currentVote = players[myId]?.vote;
    const finalVote = currentVote === val ? null : val;
    document
      .querySelectorAll(".choice-btn")
      .forEach((b) => b.classList.toggle("active", b.innerText === finalVote));
    sendUpdate(finalVote);
  }

  function sendUpdate(vote) {
    if (!myName) return;
    const payload = {
      type: "update",
      id: myId,
      name: myName,
      role: myRole,
      isObserver,
      vote,
    };
    client.publish(topic, JSON.stringify(payload));
  }

  function broadcastAction(type) {
    client.publish(topic, JSON.stringify({ type: type, id: myId }));
  }

  function render() {
    playersGridEl.innerHTML = "";
    const now = Date.now();
    const activeVotes = [];

    if (loginScreenEl.style.display !== "none") {
      votingRolesDisplayEl.classList.add("hidden");
    } else {
      const numPlayers = Object.keys(players).length;
      const pmExists = Object.values(players).some((p) => p.role === "PM");

      if (numPlayers <= 1 && myName) {
        votingRolesDisplayEl.classList.add("hidden");
      } else {
        votingRolesDisplayEl.classList.remove("hidden");
        if (!pmExists) {
          votingRolesDisplayEl.innerHTML =
            "<div><span class='font-bold text-slate-500'>Ожидание подключения PM...</span></div>";
        } else {
          updateVotingRolesDisplay();
        }
      }
    }

    lockOverlayEl.classList.toggle("hidden", !isRevealed);

    Object.keys(players)
      .sort()
      .forEach((id) => {
        const p = players[id];
        if (!p || now - p.ts > PLAYER_TIMEOUT) {
          delete players[id];
          return;
        }

        const hasVoted =
          p.vote !== null && p.vote !== "null" && p.vote !== undefined;
        const canVote = allowedVoters.includes(p.role);

        if (hasVoted && !p.isObserver && p.role !== "PM" && canVote) {
          activeVotes.push(Number(p.vote));
        }

        const roleKey = p.role.toLowerCase().replace("/", "");
        const roleClass = `role-${roleKey}`;
        const votingDisabledClass =
          !canVote && p.role !== "PM" && !p.isObserver ? "voting-disabled" : "";

        const cardMarkup = `
                <div class="flex flex-col items-center gap-4 ${id === myId ? "my-card-glow p-2" : ""} ${votingDisabledClass}">
                    <div class="poker-card ${isRevealed ? "is-flipped" : ""}">
                        <div class="poker-card-inner">
                            <div class="card-face card-front ${hasVoted ? "voted-border" : ""}">
                                ${
                                  p.isObserver
                                    ? '<span class="text-3xl">👁️</span>'
                                    : p.role === "PM"
                                      ? '<span class="text-3xl">👑</span>'
                                      : hasVoted
                                        ? '<div class="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#00f2ff]"></div>'
                                        : '<span class="text-[8px] opacity-10 font-black uppercase">Ждет...</span>'
                                }
                            </div>
                            <div class="card-face card-back shadow-2xl">${p.vote || ""}</div>
                        </div>
                    </div>
                    <div class="text-center">
                        <span class="text-[8px] px-2 py-0.5 rounded-md border ${roleClass} font-black mb-1 inline-block uppercase tracking-tighter">${p.role}</span>
                        <p class="font-bold text-[13px] tracking-tight ${id === myId ? "text-cyan-400 font-black" : "text-slate-300"}">${p.name}</p>
                    </div>
                </div>
            `;
        playersGridEl.insertAdjacentHTML("beforeend", cardMarkup);
      });

    const statsPanel = document.getElementById("stats-panel");
    if (isRevealed && activeVotes.length > 0) {
      statsPanel.classList.remove("hidden");
      const avg = activeVotes.reduce((a, b) => a + b, 0) / activeVotes.length;
      const sorted = [...activeVotes].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      const counts = activeVotes.reduce((acc, val) => {
        acc[val] = (acc[val] || 0) + 1;
        return acc;
      }, {});
      const mode = Object.keys(counts).reduce((a, b) =>
        counts[a] > counts[b] ? a : b,
      );

      document.getElementById("stat-avg").innerText = avg.toFixed(1);
      document.getElementById("stat-med").innerText = med;
      document.getElementById("stat-mode").innerText = mode;
    } else {
      statsPanel.classList.add("hidden");
    }
  }

  function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert("Ссылка скопирована!");
    });
  }

  const themeSwitcherEl = document.getElementById("theme-switcher");
  const themeToggleInput = themeSwitcherEl
    ? themeSwitcherEl.querySelector('input[type="checkbox"]')
    : null;

  const setTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    if (themeToggleInput) {
      themeToggleInput.checked = theme === "dark";
    }
  };

  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;

    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme(systemPrefersDark ? "dark" : "light");
    }
  };

  if (themeToggleInput) {
    themeToggleInput.addEventListener("change", (e) => {
      setTheme(e.target.checked ? "dark" : "light");
    });
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    });

  generateCards();
  initTheme();
  setInterval(render, 3000);

  const appPreloader = document.getElementById("app-preloader");
  if (appPreloader) {
    const minimumDisplayTime = 1000;
    const timeLoaded = performance.now();

    const hidePreloader = () => {
      appPreloader.classList.add("preloader-fade-out");
      appPreloader.addEventListener(
        "transitionend",
        () => {
          appPreloader.remove();
        },
        { once: true },
      );
    };

    const timeSinceLoad = performance.now() - timeLoaded;
    const delay = Math.max(0, minimumDisplayTime - timeSinceLoad);

    setTimeout(hidePreloader, delay);
  }
});
