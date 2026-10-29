// ==========================================
// FocusPulse - Notification, Reminder, Audio & Native OS Push Engine (notifications.js)
// Supports Native Windows Toast (Tauri), Android/Web ServiceWorker Push & Background Catch-Up
// ==========================================

let audioCtx = null;
let notificationHistory = [];

window.CASUAL_ERROR_MSG = "An unexpected operation error occurred. Please try again or submit feedback if the issue persists.";

window.showCasualError = function(contextTitle = "System Notice") {
    showNotification(contextTitle, window.CASUAL_ERROR_MSG, "warning");
};

// Register Service Worker for Android / Web system notification delivery
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

// Listen for Tauri system tray "Start / Pause Pomodoro" menu action
if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.listen === 'function') {
    window.__TAURI__.event.listen('tray_toggle_timer', () => {
        if (typeof toggleTimer === 'function') {
            toggleTimer();
        }
    }).catch(() => {});
    window.__TAURI__.event.listen('fp_window_restored', () => {
        runScheduledNotificationChecks();
    }).catch(() => {});
}

// Catch unexpected runtime errors gracefully
window.addEventListener('error', function(e) {
    if (e && e.message && (e.message.includes('ResizeObserver') || e.message.includes('Script error'))) return;
});

window.addEventListener('unhandledrejection', function(e) {
    // Prevent noisy unhandled promise popups on offline network probes
});

function initAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
}

document.addEventListener('pointerdown', initAudioContext, { once: true });
document.addEventListener('keydown', initAudioContext, { once: true });

// High-priority multi-burst alarm chime & vibration for Pomodoro completion
function playTimerAlarmSequence() {
    try {
        if (navigator.vibrate) {
            navigator.vibrate([450, 180, 450, 180, 650]);
        }
    } catch (e) {}

    if (window.appState && window.appState.soundEnabled === false) return;
    try {
        initAudioContext();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        const burstOffsets = [0, 0.72, 1.44];
        burstOffsets.forEach(offset => {
            const start = audioCtx.currentTime + offset;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(587.33, start);
            osc.frequency.setValueAtTime(880.00, start + 0.14);
            osc.frequency.setValueAtTime(1174.66, start + 0.28);
            gain.gain.setValueAtTime(0.24, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.62);
            osc.start(start);
            osc.stop(start + 0.65);
        });
    } catch (e) {}
}

function playNotificationChime(type = 'info') {
    if (window.appState && window.appState.soundEnabled === false) return;
    try {
        initAudioContext();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'success' || type === 'habit' || type === 'task') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.09);
            osc.frequency.setValueAtTime(783.99, now + 0.18);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'timer') {
            playTimerAlarmSequence();
            return;
        } else if (type === 'error' || type === 'warning') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(392, now + 0.12);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.32);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.25);
        }
    } catch (e) {}
}

function getSystemNotificationPermissionState() {
    if (window.__TAURI__ && window.__TAURI__.core) {
        return 'granted';
    }
    if (!("Notification" in window)) {
        return 'unsupported';
    }
    return Notification.permission || 'default';
}

function deliverNativeSystemNotification(title, message, type = 'info') {
    if (window.appState && window.appState.notificationsEnabled === false) return;

    // 1. Native Windows Desktop (.exe) notification via Tauri backend command (FP-13)
    try {
        if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
            window.__TAURI__.core.invoke('send_native_notification', { title, body: message }).catch(() => {});
        }
        if (window.focusPulseDesktop && typeof window.focusPulseDesktop.notifyTimerComplete === 'function') {
            window.focusPulseDesktop.notifyTimerComplete(title, message);
        }
    } catch (e) {}

    // 2. Native Android (.apk) & Web Browser OS Notification via ServiceWorker or Notification API (FP-12)
    if ("Notification" in window) {
        const fireWebNotif = () => {
            const notifOptions = {
                body: message,
                icon: 'assets/icon.png',
                badge: 'assets/favicon.png',
                tag: type === 'timer' ? 'focuspulse-pomodoro-alarm' : ('focuspulse-alert-' + Date.now()),
                renotify: true,
                requireInteraction: type === 'timer',
                vibrate: type === 'timer' ? [450, 180, 450, 180, 650] : [220, 100, 220],
                silent: false
            };
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                    navigator.serviceWorker.ready.then(reg => {
                        if (reg && typeof reg.showNotification === 'function') {
                            reg.showNotification(title, notifOptions);
                        } else {
                            new Notification(title, notifOptions);
                        }
                    }).catch(() => {
                        try { new Notification(title, notifOptions); } catch (err) {}
                    });
                } else {
                    new Notification(title, notifOptions);
                }
            } catch (e) {}
        };

        if (Notification.permission === "granted") {
            fireWebNotif();
        }
    }
}

function showNotification(title, message = '', type = 'info', sendBrowserPush = false) {
    if (!message) {
        message = title;
        title = 'FocusPulse';
    }

    playNotificationChime(type);

    const item = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
        title,
        message,
        type,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    notificationHistory.unshift(item);
    if (notificationHistory.length > 30) notificationHistory.pop();
    renderNotificationCenter();

    // Respect user's In-App Toast Popups setting (ON by default)
    const allowPopup = !window.appState || window.appState.inAppPopupsEnabled !== false;
    const container = document.getElementById('toast-container');
    if (container && allowPopup) {
        const iconMap = {
            success: '<i class="fa-solid fa-circle-check text-emerald-500 text-base"></i>',
            habit: '<i class="fa-solid fa-fire-flame-curved text-amber-500 text-base"></i>',
            task: '<i class="fa-solid fa-list-check text-indigo-500 text-base"></i>',
            error: '<i class="fa-solid fa-heart-crack text-rose-500 text-base"></i>',
            warning: '<i class="fa-solid fa-hand-holding-heart text-amber-500 text-base"></i>',
            timer: '<i class="fa-solid fa-bell text-indigo-500 text-base animate-bounce"></i>',
            info: '<i class="fa-solid fa-wand-magic-sparkles text-sky-500 text-base"></i>'
        };
        const borderMap = {
            success: 'border-emerald-500/40',
            habit: 'border-amber-500/40',
            task: 'border-indigo-500/40',
            error: 'border-rose-500/40',
            warning: 'border-amber-500/40',
            timer: 'border-indigo-500/50',
            info: 'border-indigo-500/30'
        };

        const toast = document.createElement('div');
        toast.className = `toast-animate glass-panel px-4 py-3 rounded-2xl shadow-2xl border ${borderMap[type] || borderMap.info} flex items-start gap-3 max-w-xs sm:max-w-sm pointer-events-auto`;
        toast.innerHTML = `
            <div class="mt-0.5 shrink-0">${iconMap[type] || iconMap.info}</div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(title)}</p>
                <p class="text-[11px] text-slate-700 dark:text-slate-300 font-medium leading-snug mt-0.5">${escapeHtml(message)}</p>
            </div>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs p-0.5"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            if (toast && toast.parentElement) toast.remove();
        }, 4400);
    }

    // Deliver native OS notification when requested, when timer finishes, or when app is hidden/minimized (FP-12, FP-13, FP-14)
    const isHiddenOrBackground = (document.visibilityState === 'hidden') || !document.hasFocus();
    if (sendBrowserPush || type === 'timer' || isHiddenOrBackground) {
        deliverNativeSystemNotification(title, message, type);
    }
}

async function requestBrowserNotificationPermission(fromOnboarding = false) {
    initAudioContext();
    if (!window.appState) return 'unsupported';
    window.appState.notificationsEnabled = true;
    window.appState.notificationPreference = 'enabled';
    saveState();

    // If running in Windows Tauri desktop app, test native Windows notification immediately
    if (window.__TAURI__ && window.__TAURI__.core) {
        showNotification("Windows Notifications Active 🔔", "Native Windows system notifications, popups, and audio chimes are enabled!", "success", true);
        if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
        return 'granted';
    }

    if (!("Notification" in window)) {
        showNotification("In-App Notifications Active 🔔", "App toast popups and harmonic audio chimes are enabled!", "success", false);
        if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
        return 'unsupported';
    }

    if (Notification.permission === "granted") {
        showNotification("Notifications Active ✅", "System push notifications, popups, and audio chimes are ready!", "success", true);
        if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
        return 'granted';
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            window.appState.notificationsEnabled = true;
            window.appState.notificationPreference = 'enabled';
            saveState();
            showNotification("Notifications Enabled 🔔", "You're all set! We'll give you a gentle nudge for tasks, habits, and study sessions.", "success", true);
        } else if (permission === "denied") {
            window.appState.notificationPreference = 'denied';
            saveState();
            showNotification("In-App Alerts Active", "Browser push is blocked by system settings, but in-app popups and sound chimes remain active!", "info", false);
        } else {
            showNotification("In-App Alerts Active", "FocusPulse in-app toast notifications & audio chimes are active.", "info", false);
        }
        if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
        return permission;
    } catch (e) {
        if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
        return 'default';
    }
}

function sendTestNotification() {
    initAudioContext();
    showNotification(
        "FocusPulse System Notification 🔔",
        "Native OS push notification, in-app toast popup, and harmonic audio chime fired!",
        "timer",
        true
    );
}

// Comprehensive background & catch-up reminder checks for Water, Tasks, Habits, and Streaks (FP-14)
function runScheduledNotificationChecks() {
    if (!window.appState) return;
    if (typeof sweepCompletedTasksToHistory === 'function') {
        const moved = sweepCompletedTasksToHistory();
        if (moved && typeof window.updateUI === 'function') {
            window.updateUI();
        }
    }

    if (window.appState.notificationsEnabled === false) return;
    const channels = window.appState.notificationChannels || { pomodoro: true, tasks: true, habits: true, hydration: true };
    const now = Date.now();
    const todayKey = typeof formatDateKey === 'function' ? formatDateKey(new Date()) : new Date().toISOString().slice(0, 10);

    // 1. Water / Hydration Reminder
    if (window.appState.waterRemindersEnabled !== false && channels.hydration !== false) {
        const intervalMin = Number(window.appState.waterReminderIntervalMin) || 90;
        const lastWater = Number(window.appState.lastWaterReminderAt) || now;
        if (now - lastWater >= intervalMin * 60 * 1000) {
            window.appState.lastWaterReminderAt = now;
            saveState();
            if ((window.appState.waterIntakeMl || 0) < (window.appState.dailyWaterGoalMl || 2500)) {
                showNotification(
                    "Hydration Reminder 💧",
                    `Time for a ${window.appState.glassSizeMl || 250}ml glass of water! (${window.appState.waterIntakeMl || 0}/${window.appState.dailyWaterGoalMl || 2500}ml today)`,
                    "info",
                    true
                );
            }
        }
    }

    // 2. Due-Today / Overdue Task Reminder (every 3 hours max)
    if (channels.tasks !== false) {
        const lastTaskRem = Number(window.appState.lastTaskReminderAt) || 0;
        if (now - lastTaskRem >= 3 * 60 * 60 * 1000) {
            const dueTasks = (window.appState.tasks || []).filter(t => !t.completed && t.dueDate && t.dueDate <= todayKey);
            if (dueTasks.length > 0) {
                window.appState.lastTaskReminderAt = now;
                saveState();
                showNotification(
                    `Task Due Today 📋 (${dueTasks.length})`,
                    `Next up: "${dueTasks[0].title}" (${dueTasks[0].course || dueTasks[0].category}). Start a 25m Pomodoro to knock it out!`,
                    "task",
                    true
                );
            }
        }
    }

    // 3. Daily Habit Flow & Streak Protection Reminder (after 5:00 PM if habits unchecked, max once every 4 hours)
    if (channels.habits !== false) {
        const currentHour = new Date().getHours();
        const lastHabitRem = Number(window.appState.lastHabitReminderAt) || 0;
        if (currentHour >= 17 && (now - lastHabitRem >= 4 * 60 * 60 * 1000)) {
            const uncheckedHabits = (window.appState.habits || []).filter(h => !(h.logs && h.logs[todayKey]));
            if (uncheckedHabits.length > 0) {
                window.appState.lastHabitReminderAt = now;
                saveState();
                showNotification(
                    `Protect Your ${window.appState.streakCount || 1}-Day Streak 🔥`,
                    `You have ${uncheckedHabits.length} habit(s) left for today — next up: "${uncheckedHabits[0].name}".`,
                    "habit",
                    true
                );
            }
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        runScheduledNotificationChecks();
    }
});

window.addEventListener('focus', () => {
    runScheduledNotificationChecks();
});

function toggleNotificationCenter() {
    const panel = document.getElementById('notification-center-modal');
    if (panel) {
        panel.classList.toggle('hidden');
        renderNotificationCenter();
    }
}

function clearNotificationHistory() {
    notificationHistory = [];
    renderNotificationCenter();
}

function renderNotificationCenter() {
    const listEl = document.getElementById('notification-history-list');
    const badgeEl = document.getElementById('notif-unread-dot');
    if (badgeEl) {
        if (notificationHistory.length > 0) badgeEl.classList.remove('hidden');
        else badgeEl.classList.add('hidden');
    }
    if (!listEl) return;
    if (notificationHistory.length === 0) {
        listEl.innerHTML = `<p class="text-center text-xs text-slate-500 dark:text-slate-400 py-6">No recent notifications yet. Click <strong>Test Alert</strong> above to verify sound & OS push!</p>`;
        return;
    }
    listEl.innerHTML = notificationHistory.map(n => `
        <div class="bg-white/50 dark:bg-white/5 border border-white/40 dark:border-white/10 p-3 rounded-2xl flex items-start justify-between gap-2 text-xs">
            <div>
                <p class="font-bold text-slate-900 dark:text-white">${escapeHtml(n.title)}</p>
                <p class="text-[11px] text-slate-700 dark:text-slate-300 mt-0.5">${escapeHtml(n.message)}</p>
            </div>
            <span class="text-[10px] text-slate-500 dark:text-slate-400 shrink-0 font-mono">${escapeHtml(n.time)}</span>
        </div>
    `).join('');
}

function toggleSoundEffects(checkbox) {
    window.appState.soundEnabled = Boolean(checkbox.checked);
    saveState();
    if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
    if (checkbox.checked) {
        showNotification("Sound Effects On 🔊", "Audio chimes will play on timers, tasks & check-ins.", "success");
    }
}

function toggleInAppPopups(checkbox) {
    window.appState.inAppPopupsEnabled = Boolean(checkbox.checked);
    saveState();
    if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
    if (checkbox.checked) {
        showNotification("In-App Popups On 💬", "Floating toast popups are enabled for reminders & actions.", "success");
    }
}

function toggleNotificationChannel(channelKey, isChecked) {
    if (!window.appState.notificationChannels) {
        window.appState.notificationChannels = { pomodoro: true, tasks: true, habits: true, hydration: true };
    }
    window.appState.notificationChannels[channelKey] = Boolean(isChecked);
    if (channelKey === 'hydration') {
        window.appState.waterRemindersEnabled = Boolean(isChecked);
    }
    saveState();
    if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
}

function updateNotificationSettingsUI() {
    if (!window.appState) return;
    const soundToggle = document.getElementById('sound-toggle-input');
    if (soundToggle) soundToggle.checked = window.appState.soundEnabled !== false;
    const pageSoundToggle = document.getElementById('page-sound-toggle-input');
    if (pageSoundToggle) pageSoundToggle.checked = window.appState.soundEnabled !== false;
    const pagePopupToggle = document.getElementById('page-popup-toggle-input');
    if (pagePopupToggle) pagePopupToggle.checked = window.appState.inAppPopupsEnabled !== false;
    const modalPopupToggle = document.getElementById('modal-popup-toggle-input');
    if (modalPopupToggle) modalPopupToggle.checked = window.appState.inAppPopupsEnabled !== false;

    const statusBadge = document.getElementById('settings-notif-perm-badge');
    if (statusBadge) {
        const perm = getSystemNotificationPermissionState();
        if (perm === 'granted') {
            statusBadge.innerText = 'Access Granted ✅';
            statusBadge.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30';
        } else if (perm === 'denied') {
            statusBadge.innerText = 'Browser Blocked (In-App Active)';
            statusBadge.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30';
        } else {
            statusBadge.innerText = 'Ready to Enable';
            statusBadge.className = 'text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30';
        }
    }
}
