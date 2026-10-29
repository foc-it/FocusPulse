// ==========================================
// FocusPulse - Main Timer & App Controller (script.js)
// Screen-Off & Tray-Resilient Pomodoro Engine:
// - Wall-Clock Target Timestamp (targetEndTimeMs)
// - Inline Web Worker Background Ticker (immune to main-thread tab throttling)
// - Silent Web Audio Keep-Alive Stream + MediaSession (keeps JS & audio alive when screen is off)
// - Screen Wake Lock API (prevents unexpected sleep while Pomodoro is active)
// - Instant visibilitychange / focus / pageshow catch-up & multi-burst alarm when time is up
// ==========================================

let timerInterval = null;
let pomoBgWorker = null;
let pomoWakeLock = null;
let pomoKeepAliveOsc = null;
let pomoKeepAliveGain = null;
let activeSecondsToday = 0;

document.addEventListener('contextmenu', e => e.preventDefault());
// Allow natural browser touch and wheel scrolling
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
    }
});

// Initialize Inline Web Worker for background ticking when minimized to tray or screen off
function initPomodoroBackgroundWorker() {
    if (pomoBgWorker) return pomoBgWorker;
    try {
        const workerCode = `
            let iv = null;
            self.onmessage = function(e) {
                if (e.data === 'start') {
                    if (iv) clearInterval(iv);
                    iv = setInterval(() => {
                        self.postMessage('tick');
                    }, 500);
                } else if (e.data === 'stop') {
                    if (iv) {
                        clearInterval(iv);
                        iv = null;
                    }
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        pomoBgWorker = new Worker(URL.createObjectURL(blob));
        pomoBgWorker.onmessage = function(e) {
            if (e.data === 'tick' && window.appState && window.appState.timer && window.appState.timer.isRunning) {
                syncPomodoroWallClock();
            }
        };
    } catch (e) {
        pomoBgWorker = null;
    }
    return pomoBgWorker;
}

// Silent Web Audio Keep-Alive + MediaSession so mobile & desktop OSes keep Pomodoro active when screen is off
function startPomodoroBackgroundKeepAlive() {
    try {
        if (typeof initAudioContext === 'function') initAudioContext();
        if (audioCtx) {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }
            if (!pomoKeepAliveOsc) {
                pomoKeepAliveOsc = audioCtx.createOscillator();
                pomoKeepAliveGain = audioCtx.createGain();
                pomoKeepAliveOsc.type = 'sine';
                pomoKeepAliveOsc.frequency.setValueAtTime(30, audioCtx.currentTime);
                // Sub-audible gain keeps the audio pipeline active without any audible sound
                pomoKeepAliveGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
                pomoKeepAliveOsc.connect(pomoKeepAliveGain);
                pomoKeepAliveGain.connect(audioCtx.destination);
                pomoKeepAliveOsc.start();
            }
        }
    } catch (e) {}

    // Acquire Screen Wake Lock if supported
    requestPomodoroWakeLock();

    // Update MediaSession metadata so lock-screen / background audio controller knows FocusPulse is active
    updatePomodoroMediaSession();
}

function stopPomodoroBackgroundKeepAlive() {
    try {
        if (pomoKeepAliveOsc) {
            pomoKeepAliveOsc.stop();
            pomoKeepAliveOsc.disconnect();
            pomoKeepAliveOsc = null;
        }
        if (pomoKeepAliveGain) {
            pomoKeepAliveGain.disconnect();
            pomoKeepAliveGain = null;
        }
    } catch (e) {}

    releasePomodoroWakeLock();

    try {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
        }
    } catch (e) {}
}

async function requestPomodoroWakeLock() {
    try {
        if ('wakeLock' in navigator && window.appState && window.appState.timer && window.appState.timer.isRunning) {
            if (!pomoWakeLock) {
                pomoWakeLock = await navigator.wakeLock.request('screen');
                pomoWakeLock.addEventListener('release', () => {
                    pomoWakeLock = null;
                });
            }
        }
    } catch (e) {}
}

function releasePomodoroWakeLock() {
    try {
        if (pomoWakeLock) {
            pomoWakeLock.release().catch(() => {});
            pomoWakeLock = null;
        }
    } catch (e) {}
}

function updatePomodoroMediaSession() {
    try {
        if ('mediaSession' in navigator && window.appState && window.appState.timer) {
            const t = window.appState.timer;
            const mins = Math.floor((t.secondsLeft || 0) / 60);
            const secs = (t.secondsLeft || 0) % 60;
            const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            const modeLabel = t.mode === 'pomodoro' ? 'Deep Focus' : (t.mode === 'short' ? 'Short Break' : 'Long Break');
            navigator.mediaSession.metadata = new MediaMetadata({
                title: `${modeLabel} — ${timeStr}`,
                artist: 'FocusPulse Pomodoro Timer',
                album: `Session ${t.sessionCount} of ${window.appState.timerSettings.sessionsTotal || 4}`
            });
            navigator.mediaSession.playbackState = t.isRunning ? 'playing' : 'paused';
        }
    } catch (e) {}
}

function updatePomodoroRunningUI(isRunning) {
    const btn = document.getElementById('timer-toggle-btn');
    const icon = document.getElementById('timer-play-icon');
    const txt = document.getElementById('timer-play-text');
    const screenOffBadge = document.getElementById('pomo-screenoff-badge');

    if (isRunning) {
        if (btn) btn.className = "px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-full text-xs font-extrabold shadow-lg transition flex items-center gap-2";
        if (icon) icon.className = "fa-solid fa-pause";
        if (txt) txt.innerText = "Pause";
        if (screenOffBadge) {
            screenOffBadge.classList.remove('hidden');
            screenOffBadge.classList.add('inline-flex');
        }
    } else {
        if (btn) btn.className = "v-accent-btn px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full text-xs font-extrabold shadow-lg transition flex items-center gap-2";
        if (icon) icon.className = "fa-solid fa-play";
        if (txt) txt.innerText = "Start Focus";
        if (screenOffBadge) {
            screenOffBadge.classList.add('hidden');
            screenOffBadge.classList.remove('inline-flex');
        }
    }
}

// Sync Pomodoro / Short / Long mode buttons and Deep Focus badge with active accent color
function syncTimerModeAccentUI() {
    const mode = (window.appState && window.appState.timer && window.appState.timer.mode) ? window.appState.timer.mode : 'pomodoro';
    const btnPom = document.getElementById('slider-btn-pomodoro');
    const btnShort = document.getElementById('slider-btn-short');
    const btnLong = document.getElementById('slider-btn-long');

    const inactiveClass = "flex-1 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 transition text-center cursor-pointer";
    const activeClass = "flex-1 py-2 rounded-xl text-xs font-semibold shadow-sm transition text-center cursor-pointer v-accent-btn";

    [btnPom, btnShort, btnLong].forEach(b => {
        if (b) {
            b.className = inactiveClass;
            b.style.background = '';
            b.style.color = '';
            b.style.borderColor = '';
        }
    });

    const activeBtn = mode === 'short' ? btnShort : (mode === 'long' ? btnLong : btnPom);
    if (activeBtn) {
        activeBtn.className = activeClass;
        activeBtn.style.background = 'var(--v-accent)';
        activeBtn.style.color = 'var(--v-accent-fg)';
        activeBtn.style.borderColor = 'var(--v-accent)';
    }

    const badge = document.getElementById('timer-mode-badge');
    if (badge) {
        badge.innerText = mode === 'pomodoro' ? 'Deep Focus' : (mode === 'short' ? 'Short Break' : 'Long Break');
        badge.style.background = 'rgba(var(--v-accent-rgb), 0.18)';
        badge.style.color = 'var(--v-accent)';
        badge.style.borderColor = 'rgba(var(--v-accent-rgb), 0.42)';
    }
}

// Core Wall-Clock Synchronization Engine (immune to screen-off / tray sleep drift)
function syncPomodoroWallClock() {
    if (!window.appState || !window.appState.timer || !window.appState.timer.isRunning) return;
    const t = window.appState.timer;
    const now = Date.now();

    if (!t.targetEndTimeMs || t.targetEndTimeMs <= 0) {
        t.targetEndTimeMs = now + ((t.secondsLeft || 0) * 1000);
        t.lastTickTimestampMs = now;
    }

    const prevSecsLeft = t.secondsLeft;
    const remainingMs = t.targetEndTimeMs - now;
    const newSecsLeft = Math.max(0, Math.ceil(remainingMs / 1000));

    // Calculate exact elapsed seconds since last wall-clock check to credit totalFocusSecs even if screen was off
    if (t.mode === 'pomodoro') {
        const deltaSecs = Math.max(0, prevSecsLeft - newSecsLeft);
        if (deltaSecs > 0) {
            t.totalFocusSecs = (t.totalFocusSecs || 0) + deltaSecs;
        }
    }

    t.secondsLeft = newSecsLeft;
    t.lastTickTimestampMs = now;

    if (newSecsLeft !== prevSecsLeft) {
        renderTimerDisplay();
        updatePomodoroMediaSession();
        // Periodically persist state so totalFocusSecs and targetEndTimeMs survive any OS kill
        if (newSecsLeft % 5 === 0) {
            saveState();
        }
    }

    if (remainingMs <= 0) {
        handlePomodoroTimeUp();
    }
}

function handlePomodoroTimeUp() {
    const finishedMode = window.appState.timer.mode;
    pauseTimer();

    // Update browser/window title briefly so tray/taskbar also shows alert
    try {
        document.title = finishedMode === 'pomodoro' ? "🔔 TIME'S UP! — FocusPulse" : "⚡ BREAK OVER! — FocusPulse";
        setTimeout(() => { document.title = "FocusPulse"; }, 12000);
    } catch (e) {}

    showNotification(
        finishedMode === 'pomodoro' ? "Pomodoro Time's Up! 🎉" : "Break Finished! ⚡",
        finishedMode === 'pomodoro'
            ? "Great deep focus session! Your timer finished — time to recharge and hydrate."
            : "Break time is up! Ready for your next Deep Focus block?",
        "timer",
        true
    );

    skipToNextInterval();
}

// Re-sync wall clock immediately whenever screen turns back on, window is restored from tray, or tab gains focus
document.addEventListener('visibilitychange', () => {
    if (window.appState && window.appState.timer && window.appState.timer.isRunning) {
        syncPomodoroWallClock();
        if (document.visibilityState === 'visible') {
            requestPomodoroWakeLock();
        }
    }
});

window.addEventListener('focus', () => {
    if (window.appState && window.appState.timer && window.appState.timer.isRunning) {
        syncPomodoroWallClock();
    }
});

window.addEventListener('pageshow', () => {
    if (window.appState && window.appState.timer && window.appState.timer.isRunning) {
        syncPomodoroWallClock();
    }
});

window.addEventListener('DOMContentLoaded', () => {
    loadState();
    if (typeof detectAndApplyPlatformUI === 'function') detectAndApplyPlatformUI();
    evaluateStreakCalendar();
    window.updateUI();
    if (window.appState.autoCheckUpdates !== false && typeof fetchLatestGitHubReleaseVersion === 'function') {
        fetchLatestGitHubReleaseVersion(true);
    }
    // On startup open directly from home (dashboard, not from last closed view)
    window.appState.activeSection = 'home';
    switchAppView('home', false);
    if (typeof runEveryLaunchStartupSequence === 'function') {
        runEveryLaunchStartupSequence();
    }
    if (typeof startDashboardNextUpSlider === 'function') {
        startDashboardNextUpSlider();
    }
    window.addEventListener('resize', adjustAiCoachHeight);

    // If a Pomodoro timer was active before reload or screen lock, resume wall-clock tracking immediately
    if (window.appState && window.appState.timer && window.appState.timer.isRunning && window.appState.timer.targetEndTimeMs) {
        resumeRunningTimerFromState();
    }

    // 1-minute daily interaction streak tracker + background 24h task history & hydration reminder sweep
    setInterval(() => {
        activeSecondsToday += 10;
        if (activeSecondsToday >= 60) {
            creditDailyStreak();
        }
        if (typeof runScheduledNotificationChecks === 'function') {
            runScheduledNotificationChecks();
        }
    }, 10000);
});

function getMidnight(dStr) {
    const d = dStr ? new Date(dStr) : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function evaluateStreakCalendar() {
    if (!window.appState.lastActiveDate) return;
    const todayMidnight = getMidnight();
    const lastActiveMidnight = getMidnight(window.appState.lastActiveDate);
    const diffDays = Math.round((todayMidnight - lastActiveMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays >= 2) {
        if (window.appState.streakCount > 0) {
            window.appState.previousStreakCount = window.appState.streakCount;
        }
        window.appState.streakCount = 0;
        saveState();
    }
}

function creditDailyStreak() {
    const todayStr = new Date().toDateString();
    if (window.appState.lastCreditedStreakDate === todayStr) return;

    window.appState.streakCount = (window.appState.streakCount || 0) + 1;
    window.appState.lastCreditedStreakDate = todayStr;
    window.appState.lastActiveDate = todayStr;
    saveState();
    window.updateUI();
    showNotification("Daily Streak +1 🔥", `You're on a ${window.appState.streakCount}-day FocusPulse streak!`, "success");
}

function restoreMissedStreak() {
    if (window.appState.streakRestoredThisWeek) {
        showNotification("Streak Restore", "You have already restored a streak this week!", "warning");
        return;
    }
    if (!window.appState.previousStreakCount || window.appState.previousStreakCount <= 0) {
        showNotification("Streak Restore", "No missed streak available to restore right now!", "info");
        return;
    }

    window.appState.streakCount = (window.appState.streakCount || 0) + window.appState.previousStreakCount;
    window.appState.previousStreakCount = 0;
    window.appState.streakRestoredThisWeek = true;
    window.appState.lastActiveDate = new Date().toDateString();
    saveState();
    window.updateUI();
    showNotification("Streak Restored! 🔥", `Your ${window.appState.streakCount}-day streak is back!`, "success");
}

function toggleStreakFeature(checkbox) {
    window.appState.showStreak = checkbox.checked;
    toggleStreakBadgeVisibility(checkbox.checked);
    saveState();
}

function toggleStreakBadgeVisibility(show) {
    const badge = document.getElementById('streak-badge');
    if (badge) {
        if (show) badge.classList.remove('hidden');
        else badge.classList.add('hidden');
    }
}

// Pomodoro Timer Engine
function setTimerMode(mode) {
    pauseTimer();
    window.appState.timer.mode = mode;
    if (mode === 'pomodoro') window.appState.timer.secondsLeft = window.appState.timerSettings.pomodoro * 60;
    else if (mode === 'short') window.appState.timer.secondsLeft = window.appState.timerSettings.short * 60;
    else if (mode === 'long') window.appState.timer.secondsLeft = window.appState.timerSettings.long * 60;
    window.appState.timer.targetEndTimeMs = null;
    window.appState.timer.lastTickTimestampMs = null;

    syncTimerModeAccentUI();
    renderTimerDisplay();
    saveState();
}

function toggleTimer() {
    window.appState.timer.isRunning ? pauseTimer() : startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    const now = Date.now();
    window.appState.timer.isRunning = true;
    window.appState.timer.targetEndTimeMs = now + ((window.appState.timer.secondsLeft || 0) * 1000);
    window.appState.timer.lastTickTimestampMs = now;

    // Request OS notification permission proactively if not yet decided so time-up alert can show on lock screen
    try {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission().catch(() => {});
        }
    } catch (e) {}

    updatePomodoroRunningUI(true);
    startPomodoroBackgroundKeepAlive();

    const worker = initPomodoroBackgroundWorker();
    if (worker) {
        try { worker.postMessage('start'); } catch (e) {}
    }

    timerInterval = setInterval(() => {
        syncPomodoroWallClock();
    }, 500);

    saveState();
}

function resumeRunningTimerFromState() {
    clearInterval(timerInterval);
    updatePomodoroRunningUI(true);
    startPomodoroBackgroundKeepAlive();
    const worker = initPomodoroBackgroundWorker();
    if (worker) {
        try { worker.postMessage('start'); } catch (e) {}
    }
    syncPomodoroWallClock();
    if (window.appState.timer.isRunning) {
        timerInterval = setInterval(() => {
            syncPomodoroWallClock();
        }, 500);
    }
}

function pauseTimer() {
    if (window.appState && window.appState.timer && window.appState.timer.isRunning && window.appState.timer.targetEndTimeMs) {
        const remMs = window.appState.timer.targetEndTimeMs - Date.now();
        window.appState.timer.secondsLeft = Math.max(0, Math.ceil(remMs / 1000));
    }
    window.appState.timer.isRunning = false;
    window.appState.timer.targetEndTimeMs = null;
    window.appState.timer.lastTickTimestampMs = null;
    clearInterval(timerInterval);
    timerInterval = null;

    if (pomoBgWorker) {
        try { pomoBgWorker.postMessage('stop'); } catch (e) {}
    }
    stopPomodoroBackgroundKeepAlive();
    updatePomodoroRunningUI(false);
    renderTimerDisplay();
    saveState();
}

function skipToNextInterval() {
    pauseTimer();
    if (window.appState.timer.mode === 'pomodoro') {
        if (window.appState.timer.sessionCount < (window.appState.timerSettings.sessionsTotal || 4)) {
            window.appState.timer.sessionCount++;
            setTimerMode('short');
        } else {
            window.appState.timer.sessionCount = 1;
            setTimerMode('long');
        }
    } else {
        setTimerMode('pomodoro');
    }
    saveState();
    window.updateUI();
}

function renderTimerDisplay() {
    const totalSecs = Math.max(0, Number(window.appState.timer.secondsLeft) || 0);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const disp = document.getElementById('timer-display');
    if (disp) disp.innerText = formatted;
    syncTimerModeAccentUI();
}

function selectPomoPreset(name, focus, short, long, count) {
    document.getElementById('inline-focus-input').value = focus;
    document.getElementById('inline-short-input').value = short;
    document.getElementById('inline-long-input').value = long;
    document.getElementById('inline-sessions-input').value = count;
    showNotification("Preset Selected", `Loaded ${name} preset (${focus}m / ${short}m). Click Save Settings to apply.`, "info");
}

function togglePomoInlineSettings(open) {
    if (open) {
        document.getElementById('pomo-standard-view').classList.add('hidden');
        document.getElementById('pomo-inline-settings').classList.remove('hidden');
        document.getElementById('inline-focus-input').value = window.appState.timerSettings.pomodoro;
        document.getElementById('inline-short-input').value = window.appState.timerSettings.short;
        document.getElementById('inline-long-input').value = window.appState.timerSettings.long || 15;
        document.getElementById('inline-sessions-input').value = window.appState.timerSettings.sessionsTotal || 4;
    } else {
        document.getElementById('pomo-inline-settings').classList.add('hidden');
        document.getElementById('pomo-standard-view').classList.remove('hidden');
    }
    setTimeout(adjustAiCoachHeight, 50);
}

function saveInlinePomoSettings(e) {
    e.preventDefault();
    window.appState.timerSettings.pomodoro = parseInt(document.getElementById('inline-focus-input').value) || 25;
    window.appState.timerSettings.short = parseInt(document.getElementById('inline-short-input').value) || 5;
    window.appState.timerSettings.long = parseInt(document.getElementById('inline-long-input').value) || 15;
    window.appState.timerSettings.sessionsTotal = parseInt(document.getElementById('inline-sessions-input').value) || 4;
    setTimerMode('pomodoro');
    togglePomoInlineSettings(false);
    saveState();
    window.updateUI();
    showNotification("Timer Saved", `Configured ${window.appState.timerSettings.pomodoro}m Focus / ${window.appState.timerSettings.short}m Break.`, "success");
}
