const STORAGE_SESSIONS = "phoneVault.sessions.v1";
const STORAGE_ACTIVE = "phoneVault.activeStart.v1";

const screen = document.getElementById("screen");
const tabButtons = Array.from(document.querySelectorAll(".tab"));

let activeTab = "vault";
let displayMonth = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function makeId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getSessions() {
  return safeParse(localStorage.getItem(STORAGE_SESSIONS), [])
    .filter(s => s && s.startedAt && s.endedAt)
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(sessions));
}

function getActiveStart() {
  return localStorage.getItem(STORAGE_ACTIVE);
}

function setActiveStart(isoString) {
  if (isoString) {
    localStorage.setItem(STORAGE_ACTIVE, isoString);
  } else {
    localStorage.removeItem(STORAGE_ACTIVE);
  }
}

function formatDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatDurationShort(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function formatCalendarDuration(seconds) {
  seconds = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTotalSeconds(sessions) {
  return sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0);
}

function getRecordSession(sessions) {
  if (!sessions.length) return null;
  return sessions.reduce((max, s) =>
    (s.durationSeconds || 0) > (max.durationSeconds || 0) ? s : max
  , sessions[0]);
}

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayEnd(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function secondsOverlappingRange(session, rangeStart, rangeEnd) {
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  const overlapStart = Math.max(start.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime());
  return Math.max(0, Math.floor((overlapEnd - overlapStart) / 1000));
}

function getRangeTotal(sessions, rangeStart, rangeEnd) {
  return sessions.reduce((sum, s) => sum + secondsOverlappingRange(s, rangeStart, rangeEnd), 0);
}

function getTodaySeconds(sessions) {
  const now = new Date();
  return getRangeTotal(sessions, dayStart(now), dayEnd(now));
}

function getWeekSeconds(sessions) {
  const now = new Date();
  const start = dayStart(now);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return getRangeTotal(sessions, start, end);
}

function getMonthSeconds(sessions) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return getRangeTotal(sessions, start, end);
}

function isNightSession(session) {
  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);

  const startedBeforeMidnight = start.getHours() >= 20;

  const endedNextDay =
    end.getFullYear() !== start.getFullYear() ||
    end.getMonth() !== start.getMonth() ||
    end.getDate() !== start.getDate();

  return startedBeforeMidnight && endedNextDay;
}

function getDayStats(sessions, year, month, day) {
  const start = new Date(year, month, day);
  const end = new Date(year, month, day + 1);
  const totalSeconds = getRangeTotal(sessions, start, end);

  const sessionsTouchingDay = sessions.filter(s =>
    secondsOverlappingRange(s, start, end) > 0
  );

  return {
    totalSeconds,
    sessionCount: sessionsTouchingDay.length,
    hasNightSession: sessionsTouchingDay.some(isNightSession)
  };
}

function getNightStreak(sessions) {
  let streak = 0;
  const check = dayStart(new Date());
  check.setDate(check.getDate() - 1);

  while (true) {
    const stats = getDayStats(
      sessions,
      check.getFullYear(),
      check.getMonth(),
      check.getDate()
    );

    if (!stats.hasNightSession) break;
    streak += 1;
    check.setDate(check.getDate() - 1);
  }

  return streak;
}

function getLongestNightStreak(sessions) {
  if (!sessions.length) return 0;

  const nightDates = new Set();

  sessions.forEach(session => {
    if (isNightSession(session)) {
      const start = new Date(session.startedAt);
      const key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      nightDates.add(key);
    }
  });

  const sortedDates = Array.from(nightDates)
    .map(key => new Date(key + "T00:00:00"))
    .sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  let previous = null;

  sortedDates.forEach(date => {
    if (!previous) {
      current = 1;
    } else {
      const diffDays = Math.round((date - previous) / (1000 * 60 * 60 * 24));
      current = diffDays === 1 ? current + 1 : 1;
    }

    longest = Math.max(longest, current);
    previous = date;
  });

  return longest;
}


function updateTabs() {
  tabButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.tab === activeTab);
  });
}

function render() {
  updateTabs();
  if (activeTab === "vault") renderVault();
  if (activeTab === "history") renderHistory();
  if (activeTab === "calendar") renderCalendar();
}

function renderVault() {
  const activeStart = getActiveStart();
  const isActive = Boolean(activeStart);
  const elapsed = isActive
    ? Math.floor((Date.now() - new Date(activeStart).getTime()) / 1000)
    : 0;

  screen.innerHTML = `
    <section>
      <div class="header-row">
        <div class="logo">🔒</div>
        <h1 class="app-title">Phone Vault</h1>
      </div>

      <div class="vault-circle ${isActive ? "active" : ""}">
        <div>
          <div class="vault-icon">${isActive ? "📵" : "📱"}</div>
          <div class="status-label">${isActive ? "IN VAULT" : "OUTSIDE"}</div>
        </div>
      </div>

      <div class="timer-container">
        ${
          isActive
            ? `
              <p class="timer-label">TIME IN VAULT</p>
              <p class="timer-display" id="timer-display">${formatDuration(elapsed)}</p>
            `
            : `
              <p class="idle-message">Phone is not in the vault</p>
              <p class="idle-submessage">Press Phone In to start tracking</p>
            `
        }
      </div>

      <div class="action-area">
        ${
          isActive
            ? `<button class="big-button phone-out" id="phone-out">🔓<br>PHONE OUT</button>`
            : `<button class="big-button phone-in" id="phone-in">🔒<br>PHONE IN</button>`
        }
      </div>
    </section>
  `;

  const phoneInButton = document.getElementById("phone-in");
  const phoneOutButton = document.getElementById("phone-out");

  if (phoneInButton) {
    phoneInButton.addEventListener("click", () => {
      setActiveStart(new Date().toISOString());
      render();
    });
  }

  if (phoneOutButton) {
    phoneOutButton.addEventListener("click", () => {
      const startedAt = getActiveStart();
      if (!startedAt) return;

      const endedAt = new Date().toISOString();
      const durationSeconds = Math.max(
        0,
        Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
      );

      const sessions = getSessions();
      sessions.unshift({
        id: makeId(),
        startedAt,
        endedAt,
        durationSeconds
      });

      saveSessions(sessions);
      setActiveStart(null);
      render();
    });
  }
}


function renderHistory() {
  const sessions = getSessions();
  const totalSeconds = getTotalSeconds(sessions);
  const recordSession = getRecordSession(sessions);
  const longestNightStreak = getLongestNightStreak(sessions);

  screen.innerHTML = `
    <section>
      <div class="section-header">
        <div>
          <h1 class="section-title">Session History</h1>
          <p class="section-subtitle">${sessions.length} sessions • ${formatDurationShort(totalSeconds)} total</p>
        </div>
      ${sessions.length ? `<button class="clear-button" id="clear-history" aria-label="Clear history">Clear</button>` : ""}
      </div>

      <div class="quick-stats">
        <div class="quick-card"><span>Today</span><span>${formatDurationShort(getTodaySeconds(sessions))}</span></div>
        <div class="quick-card"><span>This week</span><span>${formatDurationShort(getWeekSeconds(sessions))}</span></div>
        <div class="quick-card"><span>This month</span><span>${formatDurationShort(getMonthSeconds(sessions))}</span></div>
      </div>

      <div class="total-card">
        <div class="card-label">🏆 Total Vault Time</div>
        <div class="card-value">${formatDuration(totalSeconds)}</div>
      </div>

      <div class="record-card">
        <div class="card-label">⭐ Record Vault Time</div>
        <div class="card-value">${recordSession ? formatDuration(recordSession.durationSeconds) : "00:00:00"}</div>
        <div class="card-date">${recordSession ? formatDate(recordSession.startedAt) : "No record yet"}</div>
      </div>

      <div class="record-card">
        <div class="card-label">🌙 Night Vault Streak</div>
        <div class="card-value">${nightStreak} night${nightStreak === 1 ? "" : "s"}</div>
        <div class="card-date">Longest streak: ${longestNightStreak} night${longestNightStreak === 1 ? "" : "s"}</div>
      </div>

      ${
        sessions.length === 0
          ? `
            <div class="empty">
              <div>
                <div class="empty-icon">📭</div>
                <h2>No Sessions Yet</h2>
                <p>Put your phone in the vault to start tracking your screen-free time.</p>
              </div>
            </div>
          `
          : `
            <div class="sessions-list">
              ${sessions.map(session => `
                <article class="session-card">
                  <div class="session-left">
                    <div class="session-lock">🔒</div>
                    <div>
                      <div class="session-date">${formatDate(session.startedAt)}</div>
                      <div class="session-times">${formatTime(session.startedAt)} → ${formatTime(session.endedAt)}</div>
                    </div>
                  </div>
                  <div class="duration-badge">${formatDurationShort(session.durationSeconds)}</div>
                </article>
              `).join("")}
            </div>
          `
      }
    </section>
  `;

  const clearButton = document.getElementById("clear-history");
  if (clearButton) {
    clearButton.addEventListener("click", () => {
      const confirmed = confirm("Clear all session history? This cannot be undone.");
      if (!confirmed) return;
      saveSessions([]);
      render();
    });
  }
}

function renderCalendar() {
  const sessions = getSessions();
  const now = new Date();

  const firstDay = new Date(displayMonth.year, displayMonth.month, 1).getDay();
  const daysInMonth = new Date(displayMonth.year, displayMonth.month + 1, 0).getDate();
  const monthName = new Date(displayMonth.year, displayMonth.month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(`<div class="calendar-empty"></div>`);

  for (let day = 1; day <= daysInMonth; day++) {
    const stats = getDayStats(sessions, displayMonth.year, displayMonth.month, day);
    const isToday =
      day === now.getDate() &&
      displayMonth.month === now.getMonth() &&
      displayMonth.year === now.getFullYear();

    cells.push(`
      <div class="calendar-day ${isToday ? "today" : ""}">
        <div>
          <div class="day-number">${day}</div>
          ${stats.totalSeconds > 0 ? `<div class="day-time">${formatCalendarDuration(stats.totalSeconds)}</div>` : ""}
        </div>
        ${stats.hasNightSession ? `<div class="night-dot">🌙</div>` : ""}
      </div>
    `);
  }

  const nightStreak = getNightStreak(sessions);

  screen.innerHTML = `
    <section>
      <div class="section-header">
        <div>
          <h1 class="section-title">Vault Calendar</h1>
          <p class="section-subtitle">Daily vault time & night tracking</p>
        </div>
      </div>

    

      <div class="month-nav">
        <button class="month-button" id="prev-month" aria-label="Previous month">‹</button>
        <div class="month-name">${monthName}</div>
        <button class="month-button" id="next-month" aria-label="Next month">›</button>
      </div>

      <button class="today-button" id="today-button">Today</button>

      <div class="weekdays">
        ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="weekday">${d}</div>`).join("")}
      </div>

      <div class="calendar-grid">
        ${cells.join("")}
      </div>
    </section>
  `;

  document.getElementById("prev-month").addEventListener("click", () => {
    if (displayMonth.month === 0) {
      displayMonth = { year: displayMonth.year - 1, month: 11 };
    } else {
      displayMonth = { ...displayMonth, month: displayMonth.month - 1 };
    }
    render();
  });

  document.getElementById("next-month").addEventListener("click", () => {
    if (displayMonth.month === 11) {
      displayMonth = { year: displayMonth.year + 1, month: 0 };
    } else {
      displayMonth = { ...displayMonth, month: displayMonth.month + 1 };
    }
    render();
  });

  document.getElementById("today-button").addEventListener("click", () => {
    displayMonth = {
      year: new Date().getFullYear(),
      month: new Date().getMonth()
    };
    render();
  });
}

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    activeTab = button.dataset.tab;
    render();
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && activeTab === "vault") renderVault();
});

window.addEventListener("focus", () => {
  if (activeTab === "vault") renderVault();
});

setInterval(() => {
  if (activeTab === "vault" && getActiveStart()) {
    const display = document.getElementById("timer-display");
    if (display) {
      const elapsed = Math.floor((Date.now() - new Date(getActiveStart()).getTime()) / 1000);
      display.textContent = formatDuration(elapsed);
    }
  }
}, 1000);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js");
  });
}

render();
