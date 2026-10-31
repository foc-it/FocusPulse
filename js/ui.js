// ==========================================
// FocusPulse - UI, Theme, Dashboard 5s Next-Up Sliders & Task History Controller (ui.js)
// ==========================================

const motivationalQuotes = [
    "Focus is a muscle. The more you practice eliminating distractions, the easier deep work becomes.",
    "Success is the sum of small efforts, repeated day in and day out.",
    "Don't watch the clock; do what it does. Keep going.",
    "The secret of getting ahead is getting started.",
    "Deep work is the superpower of the 21st century.",
    "We are what we repeatedly do. Excellence, then, is not an act, but a habit."
];

let currentTaskFilter = 'all';
let currentTaskCourseFilter = 'all';
let selectedInlineTaskCourse = '';
let editingCourseId = null;
let selectedCourseFormColor = '#5f5bf6';
let currentTaskSearch = '';
let editingTaskId = null;
let editingScheduleId = null;
let isWorkspaceOpen = false;
let isTaskHistoryOpen = false;
let activeMainTab = 'home';
let navHistoryStack = ['home'];
let navForwardStack = [];
let activeSettingsTab = 'appearance';
let settingsSearchQuery = '';

// Dashboard 5-Second Auto-Sliders State (Next Task & Next Habit)
let nextTaskSlideIndex = 0;
let nextHabitSlideIndex = 0;
let dashboardSliderInterval = null;
let highlightedTaskIdFromDashboard = null;
let highlightedHabitIdFromDashboard = null;

const SECTION_IDS = ['home', 'tasks', 'habits', 'plans', 'ai', 'account', 'settings'];
const SECTION_LABELS = {
    home: 'Home & Focus',
    tasks: 'Tasks Feed',
    habits: 'Habit Flow',
    plans: 'Plans & Hydration',
    ai: 'Zenith AI Coach',
    account: 'Account & Stats',
    settings: 'Settings',
    all: 'All-in-One Overview'
};

function switchAppView(viewName, pushHistory = true) {
    if (viewName === 'focus') viewName = 'tasks';
    if (viewName === 'profile') viewName = 'account';
    activeMainTab = viewName;
    if (window.appState) {
        window.appState.activeSection = viewName;
    }

    if (pushHistory && navHistoryStack[navHistoryStack.length - 1] !== viewName) {
        navHistoryStack.push(viewName);
        if (navHistoryStack.length > 25) navHistoryStack.shift();
        navForwardStack = [];
    }
    if (typeof updateTitlebarNavButtons === 'function') updateTitlebarNavButtons();

    const crumbEl = document.getElementById('topbar-crumb-label');
    if (crumbEl) crumbEl.innerText = SECTION_LABELS[viewName] || 'Home & Focus';

    const topSetBtn = document.getElementById('topbar-settings-btn');
    if (topSetBtn) {
        if (viewName === 'settings') {
            topSetBtn.style.borderColor = 'var(--v-accent)';
            topSetBtn.style.background = 'rgba(var(--v-accent-rgb), 0.16)';
        } else {
            topSetBtn.style.borderColor = '';
            topSetBtn.style.background = '';
        }
    }

    SECTION_IDS.forEach(sec => {
        const sideBtn = document.getElementById(`side-nav-${sec}`);
        const botBtn = document.getElementById(`bot-nav-${sec}`);

        if (sideBtn) {
            const hasBadge = (sec === 'tasks' || sec === 'ai');
            const layoutCls = hasBadge ? "justify-between" : "gap-3.5";
            if (viewName === sec) {
                sideBtn.className = `v-nav-btn v-nav-btn--active ${layoutCls}`;
            } else {
                sideBtn.className = `v-nav-btn ${layoutCls}`;
            }
        }
        if (botBtn) {
            if (viewName === sec) {
                botBtn.className = "fp-ios-nav-item apk-bot-tab active flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl font-extrabold transition";
                botBtn.style.color = 'var(--v-accent)';
            } else {
                botBtn.className = "fp-ios-nav-item apk-bot-tab flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl text-slate-500 dark:text-slate-400 font-semibold transition";
                botBtn.style.color = '';
            }
        }
    });

    const secHome = document.getElementById('view-section-home');
    const secTasks = document.getElementById('view-section-tasks');
    const secHabits = document.getElementById('section-habits');
    const secPlans = document.getElementById('bottom-modules-section');
    const secAi = document.getElementById('view-section-ai');
    const secAccount = document.getElementById('view-section-account');
    const secSettings = document.getElementById('view-section-settings');

    const allSections = [secHome, secTasks, secHabits, secPlans, secAi, secAccount, secSettings];
    if (viewName === 'all') {
        allSections.forEach(el => { if (el && el !== secSettings) el.classList.remove('hidden'); });
        if (secSettings) secSettings.classList.add('hidden');
    } else {
        allSections.forEach(el => { if (el) el.classList.add('hidden'); });
        if (viewName === 'home' && secHome) secHome.classList.remove('hidden');
        if (viewName === 'tasks' && secTasks) secTasks.classList.remove('hidden');
        if (viewName === 'habits' && secHabits) secHabits.classList.remove('hidden');
        if (viewName === 'plans' && secPlans) secPlans.classList.remove('hidden');
        if (viewName === 'ai' && secAi) secAi.classList.remove('hidden');
        if (viewName === 'account' && secAccount) secAccount.classList.remove('hidden');
        if (viewName === 'settings' && secSettings) {
            secSettings.classList.remove('hidden');
            renderThemePalettes();
        }
    }

    if (typeof detectAndApplyPlatformUI === 'function') detectAndApplyPlatformUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateTitlebarNavButtons() {
    const backBtn = document.getElementById('titlebar-back-btn');
    const fwdBtn = document.getElementById('titlebar-forward-btn');
    if (backBtn) backBtn.disabled = !(navHistoryStack && navHistoryStack.length > 1);
    if (fwdBtn) fwdBtn.disabled = !(navForwardStack && navForwardStack.length > 0);
}

function navigateBack() {
    if (navHistoryStack.length > 1) {
        const current = navHistoryStack.pop();
        if (current) navForwardStack.push(current);
        const prev = navHistoryStack[navHistoryStack.length - 1] || 'home';
        switchAppView(prev, false);
        updateTitlebarNavButtons();
    } else if (activeMainTab !== 'home') {
        switchAppView('home', true);
        updateTitlebarNavButtons();
    }
}

function navigateForward() {
    if (navForwardStack.length > 0) {
        const nextView = navForwardStack.pop();
        if (nextView) {
            navHistoryStack.push(nextView);
            switchAppView(nextView, false);
            updateTitlebarNavButtons();
        }
    }
}

function reloadAppView() {
    const icon = document.getElementById('titlebar-reload-icon');
    if (icon) {
        icon.classList.add('fa-spin');
        setTimeout(() => icon.classList.remove('fa-spin'), 450);
    }
    switchAppView(activeMainTab || 'home', false);
    if (typeof renderTasks === 'function') renderTasks();
    if (typeof renderHabits === 'function') renderHabits();
    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
    if (typeof updateTitlebarNavButtons === 'function') updateTitlebarNavButtons();
}

async function fpMinimizeWindow() {
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        try {
            await window.__TAURI__.core.invoke('window_minimize');
            return;
        } catch (e) {}
    }
    if (window.__TAURI__ && window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === 'function') {
        try {
            await window.__TAURI__.window.getCurrentWindow().minimize();
            return;
        } catch (e) {}
    }
    if (window.focusPulseDesktop && typeof window.focusPulseDesktop.windowControl === 'function') {
        try {
            window.focusPulseDesktop.windowControl('minimize');
            return;
        } catch (e) {}
    }
}

async function fpMaximizeWindow() {
    const icon = document.getElementById('win-btn-maximize-icon');
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        try {
            const isMax = await window.__TAURI__.core.invoke('window_toggle_maximize');
            if (icon) icon.className = isMax ? 'fa-regular fa-clone text-[10px]' : 'fa-regular fa-square text-[10px]';
            return;
        } catch (e) {}
    }
    if (window.__TAURI__ && window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === 'function') {
        try {
            const win = window.__TAURI__.window.getCurrentWindow();
            await win.toggleMaximize();
            const isMax = await win.isMaximized();
            if (icon) icon.className = isMax ? 'fa-regular fa-clone text-[10px]' : 'fa-regular fa-square text-[10px]';
            return;
        } catch (e) {}
    }
    if (window.focusPulseDesktop && typeof window.focusPulseDesktop.windowControl === 'function') {
        try {
            window.focusPulseDesktop.windowControl('maximize');
            return;
        } catch (e) {}
    }
}

async function fpToggleFullscreenWindow() {
    const icon = document.getElementById('win-btn-fullscreen-icon');
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        try {
            const isFs = await window.__TAURI__.core.invoke('window_toggle_fullscreen');
            if (icon) icon.className = isFs ? 'fa-solid fa-compress text-[10px]' : 'fa-solid fa-expand text-[10px]';
            return;
        } catch (e) {}
    }
    if (window.__TAURI__ && window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === 'function') {
        try {
            const win = window.__TAURI__.window.getCurrentWindow();
            const cur = await win.isFullscreen();
            await win.setFullscreen(!cur);
            if (icon) icon.className = !cur ? 'fa-solid fa-compress text-[10px]' : 'fa-solid fa-expand text-[10px]';
            return;
        } catch (e) {}
    }
    try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
            if (icon) icon.className = 'fa-solid fa-compress text-[10px]';
        } else if (document.exitFullscreen) {
            await document.exitFullscreen();
            if (icon) icon.className = 'fa-solid fa-expand text-[10px]';
        }
    } catch (e) {}
}

async function fpCloseWindow() {
    const closeToTray = window.appState ? (window.appState.exeCloseToTray !== false) : true;
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
        try {
            await window.__TAURI__.core.invoke('window_close_or_hide', { closeToTray });
            return;
        } catch (e) {}
    }
    if (window.__TAURI__ && window.__TAURI__.window && typeof window.__TAURI__.window.getCurrentWindow === 'function') {
        try {
            const win = window.__TAURI__.window.getCurrentWindow();
            if (closeToTray) {
                await win.hide();
            } else {
                await win.close();
            }
            return;
        } catch (e) {}
    }
    if (window.focusPulseDesktop && typeof window.focusPulseDesktop.windowControl === 'function') {
        try {
            window.focusPulseDesktop.windowControl(closeToTray ? 'hide-to-tray' : 'close');
            return;
        } catch (e) {}
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const installModal = document.getElementById('install-app-modal');
        if (installModal && !installModal.classList.contains('hidden')) {
            closeInstallAppModal();
            return;
        }
    }
    if (e.key === 'F11' && isWindowsDesktopExeRuntime()) {
        e.preventDefault();
        fpToggleFullscreenWindow();
    } else if (e.altKey && e.key === 'ArrowLeft' && isWindowsDesktopExeRuntime()) {
        e.preventDefault();
        navigateBack();
    } else if (e.altKey && e.key === 'ArrowRight' && isWindowsDesktopExeRuntime()) {
        e.preventDefault();
        navigateForward();
    }
});

function switchSettingsTab(tabId) {
    activeSettingsTab = tabId;
    settingsSearchQuery = '';
    const searchInput = document.getElementById('fp-settings-search');
    if (searchInput) searchInput.value = '';
    renderSettingsTabs();
}

function handleSettingsSearch(val) {
    settingsSearchQuery = (val || '').trim().toLowerCase();
    renderSettingsTabs();
}

function renderSettingsTabs() {
    const tabs = ['appearance', 'courses', 'focus', 'notifications', 'cloud', 'storage', 'updates'];
    tabs.forEach(t => {
        const btn = document.getElementById(`v-set-tab-${t}`);
        const pane = document.getElementById(`v-set-pane-${t}`);
        const isActive = (activeSettingsTab === t) && !settingsSearchQuery;
        if (btn) {
            btn.className = isActive ? "v-nav-btn v-nav-btn--active text-xs" : "v-nav-btn text-xs";
        }
        if (pane) {
            if (settingsSearchQuery) {
                const text = (pane.innerText || '').toLowerCase();
                if (text.includes(settingsSearchQuery)) pane.classList.remove('hidden');
                else pane.classList.add('hidden');
            } else {
                if (t === activeSettingsTab) pane.classList.remove('hidden');
                else pane.classList.add('hidden');
            }
        }
    });
}

// =========================================================================
// DASHBOARD 5-SECOND AUTO-SLIDER: NEXT TASK & NEXT HABIT ROW
// =========================================================================
function getTaskDueTimestamp(dueDateStr) {
    if (!dueDateStr) return Number.MAX_SAFE_INTEGER;
    const t = new Date(dueDateStr + 'T00:00:00').getTime();
    return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function getTaskDaysLeftLabel(dueDateStr) {
    if (!dueDateStr) return '';
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const dueMs = getTaskDueTimestamp(dueDateStr);
    if (dueMs === Number.MAX_SAFE_INTEGER) return dueDateStr;
    const diffDays = Math.round((dueMs - todayMidnight.getTime()) / 86400000);
    if (diffDays < 0) return `${dueDateStr} (${Math.abs(diffDays)}d overdue)`;
    if (diffDays === 0) return `${dueDateStr} (Today)`;
    if (diffDays === 1) return `${dueDateStr} (1d left)`;
    return `${dueDateStr} (${diffDays}d left)`;
}

function sortTasksByDateLeftAndCompletion(tasksArray) {
    const now = Date.now();
    return [...(tasksArray || [])].sort((a, b) => {
        const aAtBottom = Boolean(a.completed && (!a.completedAt || (now - a.completedAt >= 5000)));
        const bAtBottom = Boolean(b.completed && (!b.completedAt || (now - b.completedAt >= 5000)));
        if (aAtBottom !== bAtBottom) {
            return aAtBottom ? 1 : -1;
        }
        const dueDiff = getTaskDueTimestamp(a.dueDate) - getTaskDueTimestamp(b.dueDate);
        if (dueDiff !== 0) return dueDiff;
        return String(a.title || '').localeCompare(String(b.title || ''));
    });
}

function getDashboardCandidateTasks() {
    const allPending = (window.appState.tasks || []).filter(t => !t.completed);
    if (allPending.length === 0) return [];
    return [...allPending].sort((a, b) => getTaskDueTimestamp(a.dueDate) - getTaskDueTimestamp(b.dueDate));
}

function getDashboardCandidateHabits() {
    const todayKey = formatDateKey(new Date());
    const allHabits = window.appState.habits || [];
    return allHabits.filter(h => !(h.logs && h.logs[todayKey]));
}

function startDashboardNextUpSlider() {
    if (dashboardSliderInterval) clearInterval(dashboardSliderInterval);
    dashboardSliderInterval = setInterval(() => {
        if (window.appState && window.appState.performanceMode) return;
        if (activeMainTab !== 'home' && activeMainTab !== 'all') return;
        const candidateTasks = getDashboardCandidateTasks();
        const candidateHabits = getDashboardCandidateHabits();
        let shouldRenderTask = false;
        let shouldRenderHabit = false;

        if (candidateTasks.length > 1) {
            nextTaskSlideIndex = (nextTaskSlideIndex + 1) % candidateTasks.length;
            shouldRenderTask = true;
        }
        if (candidateHabits.length > 1) {
            nextHabitSlideIndex = (nextHabitSlideIndex + 1) % candidateHabits.length;
            shouldRenderHabit = true;
        }
        if (shouldRenderTask) renderDashboardNextTaskCard(true);
        if (shouldRenderHabit) renderDashboardNextHabitCard(true);
    }, 5000);
}

function selectDashboardTaskSlide(idx, event) {
    if (event) event.stopPropagation();
    nextTaskSlideIndex = idx;
    renderDashboardNextTaskCard(true);
    startDashboardNextUpSlider();
}

function selectDashboardHabitSlide(idx, event) {
    if (event) event.stopPropagation();
    nextHabitSlideIndex = idx;
    renderDashboardNextHabitCard(true);
    startDashboardNextUpSlider();
}

// Clicking the Next Task box navigates to the Tasks section (does NOT mark complete directly)
function openTaskFromNextUpBox(taskId) {
    isTaskHistoryOpen = false;
    currentTaskFilter = 'all';
    highlightedTaskIdFromDashboard = taskId || null;
    switchAppView('tasks');
    renderTasksList();
    setTimeout(() => {
        if (taskId) {
            const rowEl = document.getElementById(`task-row-${taskId}`);
            if (rowEl) {
                highlightTaskRow(rowEl);
                rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 120);
}

// Clicking the Next Habit box navigates to the Habits section (does NOT mark complete directly)
function openHabitFromNextUpBox(habitId) {
    selectedHabitCategory = 'All';
    habitWeekOffset = 0;
    highlightedHabitIdFromDashboard = habitId || null;
    switchAppView('habits');
    renderHabitsSection();
    setTimeout(() => {
        if (habitId) {
            const rowEl = document.getElementById(`habit-row-${habitId}`);
            if (rowEl) {
                rowEl.classList.add('ring-2', 'ring-indigo-500');
                rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, 120);
}

function renderDashboardNextTaskCard(animate = false) {
    const box = document.getElementById('dashboard-next-task-box');
    if (!box) return;
    const candidateTasks = getDashboardCandidateTasks();
    const todayKey = formatDateKey(new Date());

    if (candidateTasks.length === 0) {
        box.onclick = () => openTaskFromNextUpBox(null);
        box.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <i class="fa-solid fa-circle-check mr-1"></i> Next Task to Check
                </span>
                <span class="text-[10px] font-bold" style="color:var(--v-fg3)">All Done 🎉</span>
            </div>
            <div class="py-2 flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-sm shrink-0">
                    <i class="fa-solid fa-check-double"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">All tasks completed for today!</p>
                    <p class="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Click to open Tasks & add a new goal →</p>
                </div>
            </div>
        `;
        return;
    }

    if (nextTaskSlideIndex >= candidateTasks.length) nextTaskSlideIndex = 0;
    const currentTask = candidateTasks[nextTaskSlideIndex];
    const isToday = currentTask.dueDate === todayKey;

    box.onclick = () => openTaskFromNextUpBox(currentTask.id);
    box.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-2.5">
            <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border" style="background:rgba(var(--v-accent-rgb),0.14);color:var(--v-accent);border-color:rgba(var(--v-accent-rgb),0.3);">
                    <i class="fa-solid fa-list-check mr-1"></i> Next Task to Check
                </span>
                ${candidateTasks.length > 1 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10" style="color:var(--v-fg2)">${nextTaskSlideIndex + 1} / ${candidateTasks.length}</span>` : ''}
            </div>
            <span class="text-[10px] font-bold flex items-center gap-1" style="color:var(--v-fg2)">
                <span>Go to Tasks</span> <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
            </span>
        </div>

        <div class="${animate ? 'next-up-slide-anim' : ''} flex items-center gap-3.5 py-1">
            <div class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border" style="background:rgba(var(--v-accent-rgb),0.12);border-color:rgba(var(--v-accent-rgb),0.3);color:var(--v-accent);">
                <i class="fa-regular fa-square-check text-base"></i>
            </div>
            <div class="min-w-0 flex-1">
                <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">${escapeHtml(currentTask.title)}</h4>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/60 dark:bg-white/10 text-slate-700 dark:text-slate-300">${escapeHtml(currentTask.category)} • ${escapeHtml(currentTask.subcategory || 'General')}</span>
                    <span class="text-[10px] font-bold ${isToday ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}">
                        <i class="fa-regular fa-calendar mr-1"></i>${isToday ? 'Due Today ⚡' : escapeHtml(currentTask.dueDate)}
                    </span>
                </div>
            </div>
        </div>

        <div class="mt-3 pt-2 border-t border-white/30 dark:border-white/10 flex items-center justify-between gap-2" style="border-color:var(--v-bdr)">
            <span class="text-[10px] font-semibold" style="color:var(--v-fg3)">Click card to open in Tasks section (won't mark directly)</span>
            ${candidateTasks.length > 1 ? `
                <div class="flex items-center gap-1.5" onclick="event.stopPropagation()">
                    ${candidateTasks.map((_, idx) => `
                        <button type="button" onclick="selectDashboardTaskSlide(${idx}, event)"
                            class="h-1.5 rounded-full transition-all ${idx === nextTaskSlideIndex ? 'w-4' : 'w-1.5 opacity-40'}"
                            style="background:var(--v-accent)" title="Task ${idx + 1}"></button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        ${candidateTasks.length > 1 ? `<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent overflow-hidden"><div class="h-full slider-progress-5s"></div></div>` : ''}
    `;
}

function renderDashboardNextHabitCard(animate = false) {
    const box = document.getElementById('dashboard-next-habit-box');
    if (!box) return;
    const candidateHabits = getDashboardCandidateHabits();

    if (candidateHabits.length === 0) {
        box.onclick = () => openHabitFromNextUpBox(null);
        box.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <i class="fa-solid fa-fire-flame-curved mr-1"></i> Next Habit to Check
                </span>
                <span class="text-[10px] font-bold" style="color:var(--v-fg3)">100% Today 🔥</span>
            </div>
            <div class="py-2 flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-sm shrink-0">
                    <i class="fa-solid fa-trophy"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">All daily habits completed!</p>
                    <p class="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Click to view your 7-day Habit Flow grid →</p>
                </div>
            </div>
        `;
        return;
    }

    if (nextHabitSlideIndex >= candidateHabits.length) nextHabitSlideIndex = 0;
    const currentHabit = candidateHabits[nextHabitSlideIndex];
    const streak = typeof calcHabitCurrentStreak === 'function' ? calcHabitCurrentStreak(currentHabit.logs || {}) : 0;

    box.onclick = () => openHabitFromNextUpBox(currentHabit.id);
    box.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-2.5">
            <div class="flex items-center gap-1.5">
                <span class="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <i class="fa-solid fa-fire-flame-curved mr-1"></i> Next Habit to Check
                </span>
                ${candidateHabits.length > 1 ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-white/10" style="color:var(--v-fg2)">${nextHabitSlideIndex + 1} / ${candidateHabits.length}</span>` : ''}
            </div>
            <span class="text-[10px] font-bold flex items-center gap-1" style="color:var(--v-fg2)">
                <span>Go to Habits</span> <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
            </span>
        </div>

        <div class="${animate ? 'next-up-slide-anim' : ''} flex items-center gap-3.5 py-1">
            <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 border bg-amber-500/10 border-amber-500/30">
                ${currentHabit.icon || '⚡'}
            </div>
            <div class="min-w-0 flex-1">
                <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">${escapeHtml(currentHabit.name)}</h4>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/60 dark:bg-white/10 text-slate-700 dark:text-slate-300">${escapeHtml(currentHabit.category)}</span>
                    <span class="text-[10px] font-bold text-amber-500"><i class="fa-solid fa-fire mr-1"></i>${streak}d streak • Target ${currentHabit.targetPerWeek || 5}d/wk</span>
                </div>
            </div>
        </div>

        <div class="mt-3 pt-2 border-t border-white/30 dark:border-white/10 flex items-center justify-between gap-2" style="border-color:var(--v-bdr)">
            <span class="text-[10px] font-semibold" style="color:var(--v-fg3)">Click card to open in Habit Flow (won't mark directly)</span>
            ${candidateHabits.length > 1 ? `
                <div class="flex items-center gap-1.5" onclick="event.stopPropagation()">
                    ${candidateHabits.map((_, idx) => `
                        <button type="button" onclick="selectDashboardHabitSlide(${idx}, event)"
                            class="h-1.5 rounded-full transition-all ${idx === nextHabitSlideIndex ? 'w-4' : 'w-1.5 opacity-40'}"
                            style="background:var(--v-accent)" title="Habit ${idx + 1}"></button>
                    `).join('')}
                </div>
            ` : ''}
        </div>
        ${candidateHabits.length > 1 ? `<div class="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent overflow-hidden"><div class="h-full slider-progress-5s"></div></div>` : ''}
    `;
}

function renderDashboardNextUpRow() {
    renderDashboardNextTaskCard(false);
    renderDashboardNextHabitCard(false);
}

// =========================================================================
// THEME & CUSTOM PALETTE ENGINE (Applies to White Mode & Dark Mode)
// =========================================================================
function setSolidTheme(themeId) {
    window.appState.solidTheme = themeId;

    // If user clicks Pure White, switch surface mode to White ('light').
    // If user clicks Pure Black, switch surface mode to Dark ('dark').
    // Otherwise, preserve the user's current Dark or White surface mode so any palette works in White Mode too!
    if (themeId === 'purewhite') {
        window.appState.theme = 'light';
    } else if (themeId === 'pureblack') {
        window.appState.theme = 'dark';
    }

    // Automatically apply the theme's signature accent color when selecting a theme preset
    const found = FP_THEMES.find(t => t.id === themeId);
    if (found && found.accent) {
        window.appState.accentColor = found.accent;
    }

    // Preserve liquid mode last state (do NOT reset back to off)
    applyLiquidGlass(Boolean(window.appState.liquidEffect));
    applyThemeVariables();
    saveState();
    renderThemePalettes();
    const label = found ? found.name : 'Custom Theme';
    const modeStr = window.appState.theme === 'light' ? 'White Mode' : 'Dark Mode';
    const liquidStr = window.appState.liquidEffect ? ' (Liquid Glass ON)' : '';
    showNotification("Theme Applied", `Applied ${label} palette in ${modeStr}${liquidStr}.`, "info");
}

function setSurfaceMode(mode) {
    window.appState.theme = (mode === 'light') ? 'light' : 'dark';
    if (mode === 'light' && window.appState.solidTheme === 'pureblack') {
        window.appState.solidTheme = 'purewhite';
    } else if (mode === 'dark' && window.appState.solidTheme === 'purewhite') {
        window.appState.solidTheme = 'obsidian';
    }
    applyThemeVariables();
    saveState();
    renderThemePalettes();
    showNotification(
        mode === 'light' ? "White Mode Active ☀️" : "Dark Mode Active 🌙",
        mode === 'light'
            ? "All theme & accent palettes now apply directly to White Mode!"
            : "Switched surface to Dark Mode.",
        "info"
    );
}

function setAccentColor(hex) {
    if (!hex) return;
    let val = hex.trim();
    if (!val.startsWith('#')) val = '#' + val;
    window.appState.accentColor = val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        applyThemeVariables();
        if (typeof syncTimerModeAccentUI === 'function') syncTimerModeAccentUI();
        saveState();
        renderThemePalettes();
    }
}

function setCustomBgColor(hex) {
    if (!hex) return;
    let val = hex.trim();
    if (!val.startsWith('#')) val = '#' + val;
    window.appState.customBgColor = val;
    window.appState.solidTheme = 'custom';
    window.appState.theme = isHexLight(val) ? 'light' : 'dark';
    // Preserve liquid mode last state (do NOT reset back to off)
    applyLiquidGlass(Boolean(window.appState.liquidEffect));
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        applyThemeVariables();
        saveState();
        renderThemePalettes();
    }
}


function toggleExeRunAtStartup(forceValue) {
    if (typeof forceValue === 'boolean') {
        window.appState.exeRunAtStartup = forceValue;
    } else {
        window.appState.exeRunAtStartup = !Boolean(window.appState.exeRunAtStartup);
    }
    if (typeof syncExeDesktopBridge === 'function') syncExeDesktopBridge();
    saveState();
    renderThemePalettes();
    showNotification(
        window.appState.exeRunAtStartup ? "Run at Startup: ON 🚀" : "Run at Startup: OFF",
        window.appState.exeRunAtStartup
            ? "FocusPulse will launch automatically when Windows starts."
            : "FocusPulse will no longer auto-launch at Windows startup.",
        "info"
    );
}

function toggleExeCloseToTray(forceValue) {
    if (typeof forceValue === 'boolean') {
        window.appState.exeCloseToTray = forceValue;
    } else {
        window.appState.exeCloseToTray = !(window.appState.exeCloseToTray !== false);
    }
    if (typeof syncExeDesktopBridge === 'function') syncExeDesktopBridge();
    saveState();
    renderThemePalettes();
    showNotification(
        window.appState.exeCloseToTray ? "Move to Tray on Close: ON 📥" : "Move to Tray on Close: OFF",
        window.appState.exeCloseToTray
            ? "Closing the window will minimize FocusPulse to the system tray so Pomodoro keeps running."
            : "Closing the window will exit FocusPulse completely.",
        "info"
    );
}

function togglePerformanceMode(forceValue) {
    if (typeof forceValue === 'boolean') {
        window.appState.performanceMode = forceValue;
    } else {
        window.appState.performanceMode = !Boolean(window.appState.performanceMode);
    }
    applyThemeVariables();
    saveState();
    renderThemePalettes();
    if (typeof startDashboardNextUpSlider === 'function') {
        startDashboardNextUpSlider();
    }
    showNotification(
        window.appState.performanceMode ? "Low-Spec / Eco Mode Enabled ⚡" : "Low-Spec / Eco Mode Disabled",
        window.appState.performanceMode
            ? "GPU blurs, shadows, transitions & background auto-sliders paused for maximum FPS & battery."
            : "Standard visual animations, shadows & 5s dashboard sliders restored.",
        "info"
    );
}

function changeUiScale(delta) {
    const current = Number(window.appState.uiScale) || 0;
    const next = delta === 0 ? 0 : Math.max(-5, Math.min(5, current + Number(delta)));
    window.appState.uiScale = next;
    applyThemeVariables();
    saveState();
    renderThemePalettes();
    if (typeof detectAndApplyPlatformUI === 'function') detectAndApplyPlatformUI();
    const pct = 100 + (next * 5);
    showNotification(
        `Interface Scale: ${pct}%`,
        next === 0 ? "Restored default 100% interface scaling." : `Scaled entire interface typography & layout to ${pct}% (${next > 0 ? '+' + next : next}).`,
        "info"
    );
}

function setUiScaleDirect(stepVal) {
    const next = Math.max(-5, Math.min(5, parseInt(stepVal, 10) || 0));
    window.appState.uiScale = next;
    applyThemeVariables();
    saveState();
    renderThemePalettes();
    if (typeof detectAndApplyPlatformUI === 'function') detectAndApplyPlatformUI();
}

function renderThemePalettes() {
    const state = window.appState;
    const sTheme = state.solidTheme || 'obsidian';
    const accent = state.accentColor || '#5f5bf6';
    const customBg = state.customBgColor || '#0c0b0b';
    const isLiquid = Boolean(state.liquidEffect);
    const isWhiteMode = (state.theme === 'light') || (sTheme === 'purewhite');

    // Update Surface Mode toggle pills
    const btnDarkSurf = document.getElementById('surface-mode-dark-btn');
    const btnLightSurf = document.getElementById('surface-mode-light-btn');
    if (btnDarkSurf && btnLightSurf) {
        if (isWhiteMode) {
            btnLightSurf.className = "px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition v-accent-btn";
            btnDarkSurf.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold transition opacity-75 hover:opacity-100";
        } else {
            btnDarkSurf.className = "px-3.5 py-1.5 rounded-xl text-xs font-extrabold shadow-sm transition v-accent-btn";
            btnLightSurf.className = "px-3.5 py-1.5 rounded-xl text-xs font-bold transition opacity-75 hover:opacity-100";
        }
    }

    // 1. Render Theme Preset Grid (in Settings View AND in Settings Modal)
    ['fp-theme-grid', 'modal-fp-theme-grid'].forEach(gridId => {
        const gridEl = document.getElementById(gridId);
        if (!gridEl) return;
        gridEl.innerHTML = FP_THEMES.map(t => {
            const isSelected = (sTheme === t.id);
            const previewBg = isWhiteMode ? (t.lightBg || '#ffffff') : t.bg;
            const previewCard = isWhiteMode ? (t.lightCard || '#f8fafc') : t.cardBg;
            return `
                <div onclick="setSolidTheme('${t.id}')"
                     class="v-theme-card ${isSelected ? 'active' : ''}">
                    <div class="flex items-center gap-1.5 mb-2.5">
                        <span style="width:14px;height:14px;border-radius:50%;background:${previewBg};border:1px solid rgba(150,150,150,0.4);display:inline-block;"></span>
                        <span style="width:14px;height:14px;border-radius:50%;background:${previewCard};border:1px solid rgba(150,150,150,0.4);display:inline-block;"></span>
                        <span style="width:14px;height:14px;border-radius:50%;background:${t.accent};border:1px solid rgba(150,150,150,0.4);display:inline-block;"></span>
                    </div>
                    <div class="flex items-center justify-between w-full">
                        <span class="text-xs font-extrabold" style="color:var(--v-fg)">${t.name}</span>
                        ${isSelected ? '<i class="fa-solid fa-circle-check text-[11px]" style="color:var(--v-accent)"></i>' : ''}
                    </div>
                    <span class="text-[10.5px] mt-0.5" style="color:var(--v-fg2)">${t.desc}${isWhiteMode && t.id !== 'pureblack' ? ' (White Tint)' : ''}</span>
                </div>
            `;
        }).join('');
    });

    // 2. Update Custom Theme Swatches & Inputs
    const dot1 = document.getElementById('custom-theme-dot-1');
    const dot2 = document.getElementById('custom-theme-dot-2');
    const dot3 = document.getElementById('custom-theme-dot-3');
    if (dot1) dot1.style.background = customBg;
    if (dot2) dot2.style.background = lightenColor(customBg, 4);
    if (dot3) dot3.style.background = accent;

    const customCard = document.getElementById('fp-custom-theme-card');
    if (customCard) {
        const isCustomActive = (sTheme === 'custom');
        customCard.style.borderColor = isCustomActive ? 'var(--v-accent)' : 'var(--v-bdr2)';
    }

    ['custom-bg-hex-input', 'modal-custom-bg-hex-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = customBg;
    });
    ['custom-bg-color-picker', 'modal-custom-bg-color-picker'].forEach(id => {
        const el = document.getElementById(id);
        if (el && /^#[0-9A-Fa-f]{6}$/.test(customBg)) el.value = customBg;
    });

    // 3. Render Accent Color Palette Swatches (Adaptive in White Mode)
    ['fp-accent-swatches', 'modal-fp-accent-swatches'].forEach(containerId => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = FP_ACCENTS.map(acc => {
            const swatchColor = (isWhiteMode && acc.lightValue && isHexLight(acc.value)) ? acc.lightValue : acc.value;
            const isSelected = accent.toLowerCase() === swatchColor.toLowerCase() || accent.toLowerCase() === acc.value.toLowerCase();
            return `
                <button type="button"
                    onclick="setAccentColor('${swatchColor}')"
                    title="${acc.label} (${swatchColor})"
                    style="width:28px;height:28px;border-radius:50%;background:${swatchColor};border:${isSelected ? '2px solid var(--v-fg)' : '1px solid rgba(150,150,150,0.4)'};outline:${isSelected ? '2px solid var(--v-accent)' : 'none'};outline-offset:2px;cursor:pointer;transition:transform 0.15s ease;"
                    onmouseenter="this.style.transform='scale(1.12)'"
                    onmouseleave="this.style.transform='scale(1)'">
                </button>
            `;
        }).join('');
    });

    ['accent-hex-input', 'modal-accent-hex-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) el.value = accent;
    });
    ['accent-color-picker', 'modal-accent-color-picker'].forEach(id => {
        const el = document.getElementById(id);
        if (el && /^#[0-9A-Fa-f]{6}$/.test(accent)) el.value = accent;
    });

    // 4. Update Eco Mode & UI Scale indicators across Settings, Topbar, Sidebar & Quick Settings Modal
    const isPerf = Boolean(state.performanceMode);
    const ecoBadge = document.getElementById('sidebar-eco-badge');
    if (ecoBadge) {
        if (isPerf) ecoBadge.classList.remove('hidden');
        else ecoBadge.classList.add('hidden');
    }
    const topEcoBadge = document.getElementById('topbar-eco-badge');
    if (topEcoBadge) {
        if (isPerf) {
            topEcoBadge.classList.remove('hidden');
            topEcoBadge.classList.add('inline-flex');
        } else {
            topEcoBadge.classList.add('hidden');
            topEcoBadge.classList.remove('inline-flex');
        }
    }
    const perfCheck = document.getElementById('perf-mode-checkbox');
    if (perfCheck) perfCheck.checked = isPerf;

    ['perf-mode-switch-btn', 'modal-perf-mode-switch-btn'].forEach(btnId => {
        const sw = document.getElementById(btnId);
        if (sw) {
            sw.classList.toggle('active', isPerf);
            sw.setAttribute('aria-checked', isPerf ? 'true' : 'false');
        }
    });

    const perfStatusBadge = document.getElementById('perf-mode-status-badge');
    if (perfStatusBadge) {
        perfStatusBadge.innerText = isPerf ? 'ON • ECO ACTIVE' : 'OFF';
        perfStatusBadge.style.color = isPerf ? 'var(--v-accent-fg)' : 'var(--v-fg2)';
        perfStatusBadge.style.background = isPerf ? 'var(--v-accent)' : 'var(--v-bg2)';
        perfStatusBadge.style.borderColor = isPerf ? 'var(--v-accent)' : 'var(--v-bdr3)';
    }
    const perfFpsHint = document.getElementById('perf-mode-fps-hint');
    if (perfFpsHint) {
        perfFpsHint.innerText = isPerf ? 'Max FPS • Animations Paused' : 'Standard Visuals';
        perfFpsHint.style.color = isPerf ? 'var(--v-accent)' : 'var(--v-fg3)';
    }

    const scale = Math.max(-5, Math.min(5, Number(state.uiScale) || 0));
    const scalePct = 100 + (scale * 5);
    const scaleText = scale === 0 ? 'Default scale (100%)' : `Step ${scale > 0 ? '+' + scale : scale} (${scalePct}% interface zoom)`;
    ['ui-scale-label', 'modal-ui-scale-label'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = scaleText;
    });
    ['ui-scale-val', 'modal-ui-scale-val'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = `${scalePct}%`;
    });
    const scaleSlider = document.getElementById('ui-scale-slider');
    if (scaleSlider && document.activeElement !== scaleSlider) {
        scaleSlider.value = String(scale);
    }

    
    // Sync Desktop .EXE 2-option switches (Run at Startup & Move to Tray on Close)
    const isExeStartup = Boolean(state.exeRunAtStartup);
    const isExeTray = state.exeCloseToTray !== false;
    ['exe-startup-switch-btn', 'modal-exe-startup-switch-btn'].forEach(btnId => {
        const sw = document.getElementById(btnId);
        if (sw) {
            sw.classList.toggle('active', isExeStartup);
            sw.setAttribute('aria-checked', isExeStartup ? 'true' : 'false');
        }
    });
    ['exe-tray-switch-btn', 'modal-exe-tray-switch-btn'].forEach(btnId => {
        const sw = document.getElementById(btnId);
        if (sw) {
            sw.classList.toggle('active', isExeTray);
            sw.setAttribute('aria-checked', isExeTray ? 'true' : 'false');
        }
    });

    // 5. Update Liquid Mode status banner
    const modeBanner = document.getElementById('liquid-mode-status-banner');
    if (modeBanner) {
        const surfaceName = isWhiteMode ? 'White Mode' : 'Dark Mode';
        if (isLiquid) {
            modeBanner.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-cyan-500 mr-1.5"></i> <strong>Liquid Glass Mode is ON (${surfaceName})</strong> — translucent frosted glass & gradients are active, with accent palette <code class="px-1.5 py-0.5 rounded text-[10px]" style="background:var(--v-bg3)">${accent}</code>.`;
        } else {
            const activeThemeObj = FP_THEMES.find(t => t.id === sTheme);
            const tName = activeThemeObj ? activeThemeObj.name : 'Custom Theme';
            modeBanner.innerHTML = `<i class="fa-solid fa-palette mr-1.5" style="color:var(--v-accent)"></i> <strong>Solid Theme Mode is ACTIVE (${tName} • ${surfaceName})</strong> — zero gradients, zero blur/transparency, using accent palette <code class="px-1.5 py-0.5 rounded text-[10px]" style="background:var(--v-bg3)">${accent}</code>.`;
        }
    }
}

window.updateUI = function() {
    sweepCompletedTasksToHistory();
    const state = window.appState;
    const savedGuest = (typeof getSavedLocalGuestName === 'function') ? getSavedLocalGuestName() : '';
    if (savedGuest && state.user && (!state.user.name || state.user.name === 'Guest' || state.user.name === 'Student Scholar')) {
        state.user.name = savedGuest;
        state.user.isCustomName = true;
    }
    const rawName = (state.user && state.user.name && state.user.name !== 'Student Scholar') ? state.user.name : (savedGuest || 'Guest');
    const fullName = rawName;
    const firstName = fullName.split(' ')[0];
    const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'FP';

    const headerNameEl = document.getElementById('header-user-name');
    const accNameInput = document.getElementById('account-name-input');
    const accSubjInput = document.getElementById('account-subjects-input');
    const inlineAccName = document.getElementById('inline-profile-name-input');
    const inlineAccSubj = document.getElementById('inline-profile-subjects-input');

    if (headerNameEl) headerNameEl.innerText = firstName;
    if (accNameInput && document.activeElement !== accNameInput) accNameInput.value = fullName === 'Guest' ? '' : fullName;
    if (accSubjInput && document.activeElement !== accSubjInput) accSubjInput.value = state.user.subjects || '';
    if (inlineAccName && document.activeElement !== inlineAccName) inlineAccName.value = fullName === 'Guest' ? '' : fullName;
    if (inlineAccSubj && document.activeElement !== inlineAccSubj) inlineAccSubj.value = state.user.subjects || '';

    const profNameEl = document.getElementById('profile-view-name');
    const profSubjEl = document.getElementById('profile-view-subjects');
    const profAvatarEl = document.getElementById('profile-view-avatar');
    const headerAvatarEl = document.getElementById('header-user-avatar');
    const botNavAvatarEl = document.getElementById('bot-nav-account-icon-wrap');
    const removeAvatarBtn = document.getElementById('inline-profile-remove-avatar-btn');
    const presetAvatarsRow = document.getElementById('account-preset-avatars-row');
    const homeGreetingEl = document.getElementById('home-greeting-name');

    const avatarUrl = (state.user && state.user.avatarDataUrl) ? state.user.avatarDataUrl : '';

    if (profNameEl) profNameEl.innerText = fullName;
    if (profSubjEl) profSubjEl.innerText = state.user.subjects || 'No courses listed yet';
    if (profAvatarEl) {
        if (avatarUrl) {
            profAvatarEl.innerHTML = `<img src="${avatarUrl}" alt="Profile Picture" class="w-full h-full object-cover rounded-full">`;
        } else {
            profAvatarEl.innerText = initials;
        }
    }
    if (headerAvatarEl) {
        if (avatarUrl) {
            headerAvatarEl.innerHTML = `<img src="${avatarUrl}" alt="" class="w-full h-full object-cover rounded-full">`;
        } else {
            headerAvatarEl.innerText = initials;
        }
    }
    if (botNavAvatarEl) {
        if (avatarUrl) {
            botNavAvatarEl.innerHTML = `<img src="${avatarUrl}" alt="" class="w-full h-full object-cover rounded-full border" style="border-color:var(--v-accent)">`;
        } else {
            botNavAvatarEl.innerHTML = `<i class="fa-solid fa-user-circle text-sm"></i>`;
        }
    }
    if (removeAvatarBtn) {
        removeAvatarBtn.classList.toggle('hidden', !avatarUrl);
    }
    if (presetAvatarsRow && Array.isArray(window.FP_PRESET_AVATARS)) {
        presetAvatarsRow.innerHTML = `<span class="text-[10px] font-bold mr-1" style="color:var(--v-fg2)">Presets:</span>` +
            window.FP_PRESET_AVATARS.map(av => {
                const isSel = avatarUrl === av.dataUrl;
                return `<button type="button" onclick="setProfileAvatar('${av.dataUrl}', false)"
                    class="w-7 h-7 rounded-full overflow-hidden border-2 transition hover:scale-110 shrink-0"
                    style="border-color:${isSel ? 'var(--v-accent)' : 'transparent'};transform:${isSel ? 'scale(1.12)' : 'scale(1)'};"
                    title="${escapeHtml(av.label)}">
                    <img src="${av.dataUrl}" alt="${escapeHtml(av.label)}" class="w-full h-full object-cover">
                </button>`;
            }).join('');
    }
    if (homeGreetingEl) homeGreetingEl.innerText = firstName;
    if (typeof window.updateOnboardingAccountStatusUI === 'function') {
        window.updateOnboardingAccountStatusUI();
    }

    // Sync subjects string from structured courses array
    const coursesList = Array.isArray(state.courses) ? state.courses : [];
    state.user.subjects = coursesList.map(c => c.name).join(', ');
    if (profSubjEl) profSubjEl.innerText = state.user.subjects || 'No courses listed yet';
    if (accSubjInput) accSubjInput.value = state.user.subjects || '';
    if (inlineAccSubj) inlineAccSubj.value = state.user.subjects || '';

    // Sidebar Active Courses list — shows custom 2-letter profile picture & separate pending tasks count per subject!
    const sideCoursesEl = document.getElementById('sidebar-courses-list');
    if (sideCoursesEl) {
        if (coursesList.length === 0) {
            sideCoursesEl.innerHTML = `<p class="text-[11px] px-3 py-2" style="color:var(--v-fg3)">No active courses. Click <strong>+ Manage</strong> to add courses.</p>`;
        } else {
            sideCoursesEl.innerHTML = coursesList.map((c) => {
                const col = c.color || '#5f5bf6';
                const twoLetters = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
                const coursePendingCount = getPendingTaskCountForCourse(c.name);
                const isSelectedCourse = (activeMainTab === 'tasks' && currentTaskCourseFilter === c.name);
                return `
                    <button onclick="filterTasksByCourseFromSidebar('${escapeHtml(c.name)}')" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-white/5 transition text-left border ${isSelectedCourse ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-transparent'}">
                        <span class="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black uppercase shrink-0" style="background:${col}22;color:${col};border:1.5px solid ${col}55;">
                            ${escapeHtml(twoLetters)}
                        </span>
                        <span class="flex-1 min-w-0">
                            <span class="block text-xs font-extrabold truncate" style="color:var(--v-fg)">${escapeHtml(c.name)}</span>
                            <span class="block text-[10px] font-semibold" style="color:${coursePendingCount > 0 ? col : 'var(--v-fg3)'}">
                                ${coursePendingCount} pending task${coursePendingCount === 1 ? '' : 's'}
                            </span>
                        </span>
                    </button>
                `;
            }).join('');
        }
    }

    // Hydration stats
    const pct = Math.min(100, Math.round(((state.waterIntakeMl || 0) / (state.dailyWaterGoalMl || 2500)) * 100));
    const waterBar = document.getElementById('water-progress-bar');
    const waterStat = document.getElementById('water-stat-text');
    const glassLbl = document.getElementById('glass-size-label');
    const intervalLbl = document.getElementById('water-interval-label');
    if (waterBar) waterBar.style.width = pct + '%';
    if (waterStat) waterStat.innerText = `${state.waterIntakeMl || 0} / ${state.dailyWaterGoalMl || 2500} ml`;
    if (glassLbl) glassLbl.innerText = `${state.glassSizeMl || 250} ml`;
    if (intervalLbl) intervalLbl.innerText = `${state.waterReminderIntervalMin || 90}m`;

    // Focus Time stats
    const hrs = Math.floor((state.timer.totalFocusSecs || 0) / 3600);
    const mins = Math.floor(((state.timer.totalFocusSecs || 0) % 3600) / 60);
    const focusStr = `${hrs}h ${mins}m`;

    const sessionCountEl = document.getElementById('timer-session-count');
    if (sessionCountEl) {
        sessionCountEl.innerText = `Session ${state.timer.sessionCount} of ${state.timerSettings.sessionsTotal || 4}`;
    }

    const countEl = document.getElementById('streak-count');
    if (countEl) countEl.innerText = state.streakCount || 0;

    // Home Quick Snapshot Cards & Account Stats Cards
    const allTasks = state.tasks || [];
    const doneTasksCount = allTasks.filter(t => t.completed).length;
    const pendingTasksCount = allTasks.length - doneTasksCount;
    const todayKey = formatDateKey(new Date());
    const allHabits = state.habits || [];
    const habitsDoneToday = allHabits.filter(h => h.logs && h.logs[todayKey]).length;

    const snapFocus = document.getElementById('home-snap-focus');
    const snapTasks = document.getElementById('home-snap-tasks');
    const snapHabits = document.getElementById('home-snap-habits');
    const snapWater = document.getElementById('home-snap-water');
    if (snapFocus) snapFocus.innerText = focusStr;
    if (snapTasks) snapTasks.innerText = `${pendingTasksCount} Pending`;
    if (snapHabits) snapHabits.innerText = `${habitsDoneToday}/${allHabits.length} Done`;
    if (snapWater) snapWater.innerText = `${pct}% (${state.waterIntakeMl || 0}ml)`;

    // Account View Counters & Stats Breakdown
    const statFocus = document.getElementById('account-stat-focus');
    const statTasks = document.getElementById('account-stat-tasks');
    const statHabits = document.getElementById('account-stat-habits');
    const statStreak = document.getElementById('account-stat-streak');
    if (statFocus) statFocus.innerText = focusStr;
    if (statTasks) statTasks.innerText = `${doneTasksCount}/${allTasks.length}`;
    if (statHabits) statHabits.innerText = `${habitsDoneToday}/${allHabits.length}`;
    if (statStreak) statStreak.innerText = `${state.streakCount || 0}d`;

    const taskRatePct = allTasks.length > 0 ? Math.round((doneTasksCount / allTasks.length) * 100) : 0;
    const accTaskBar = document.getElementById('account-task-rate-bar');
    const accTaskPct = document.getElementById('account-task-rate-pct');
    const accWaterBar = document.getElementById('account-water-rate-bar');
    const accWaterPct = document.getElementById('account-water-rate-pct');
    if (accTaskBar) accTaskBar.style.width = `${taskRatePct}%`;
    if (accTaskPct) accTaskPct.innerText = `${taskRatePct}% (${doneTasksCount} of ${allTasks.length} completed)`;
    if (accWaterBar) accWaterBar.style.width = `${pct}%`;
    if (accWaterPct) accWaterPct.innerText = `${pct}% (${state.waterIntakeMl || 0} / ${state.dailyWaterGoalMl || 2500} ml)`;

    const apiKeyInput = document.getElementById('settings-gemini-key');
    if (apiKeyInput && state.geminiApiKey) apiKeyInput.value = state.geminiApiKey;
    const pageApiKeyInput = document.getElementById('page-settings-gemini-key');
    if (pageApiKeyInput && state.geminiApiKey) pageApiKeyInput.value = state.geminiApiKey;

    const soundToggle = document.getElementById('sound-toggle-input');
    if (soundToggle) soundToggle.checked = state.soundEnabled !== false;
    const pageSoundToggle = document.getElementById('page-sound-toggle-input');
    if (pageSoundToggle) pageSoundToggle.checked = state.soundEnabled !== false;

    const pageStreakToggle = document.getElementById('page-streak-toggle-input');
    if (pageStreakToggle) pageStreakToggle.checked = state.showStreak !== false;

    const navTaskBadge = document.getElementById('nav-badge-tasks');
    if (navTaskBadge) {
        navTaskBadge.innerText = pendingTasksCount;
        if (pendingTasksCount > 0) navTaskBadge.classList.remove('hidden');
        else navTaskBadge.classList.add('hidden');
    }

    // Update Task History Corner Button Badge
    const histCount = (state.taskHistory || []).length;
    const histBadge = document.getElementById('task-history-count-badge');
    if (histBadge) {
        histBadge.innerText = histCount;
    }

    renderDashboardNextUpRow();
    renderTasksList();
    renderTaskHistoryList();
    renderTimerDisplay();
    renderSchedules();
    renderHabitsSection();
    updateCategoryDropdowns();
    renderCategoryManagerList();
    if (typeof renderCoursesSettingsManager === 'function') renderCoursesSettingsManager();
    if (typeof updateReturningUserHomeGreeting === 'function') updateReturningUserHomeGreeting();
    if (typeof updateNotificationSettingsUI === 'function') updateNotificationSettingsUI();
    if (typeof updateOnboardingAccountStatusUI === 'function') updateOnboardingAccountStatusUI();
    renderThemePalettes();
    if (typeof detectAndApplyPlatformUI === 'function') detectAndApplyPlatformUI();
};

function adjustAiCoachHeight() {}

function handleTaskSearchInput(val) {
    currentTaskSearch = (val || '').trim().toLowerCase();
    renderTasksList();
}

function setTaskFilter(filter) {
    currentTaskFilter = filter;
    renderTasksList();
}

// =========================================================================
// TASK TRACKER + 24-HOUR COMPLETED TASK HISTORY VIEW
// =========================================================================
function toggleTaskHistoryView(open) {
    isTaskHistoryOpen = Boolean(open);
    const stdView = document.getElementById('task-standard-view');
    const formView = document.getElementById('task-inline-form-view');
    const histView = document.getElementById('task-history-view');
    if (!stdView || !histView) return;

    if (isTaskHistoryOpen) {
        stdView.classList.add('hidden');
        if (formView) formView.classList.add('hidden');
        histView.classList.remove('hidden');
        renderTaskHistoryList();
    } else {
        histView.classList.add('hidden');
        stdView.classList.remove('hidden');
        renderTasksList();
    }
}

function archiveCompletedTaskNow(taskId) {
    const idx = (window.appState.tasks || []).findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const task = window.appState.tasks[idx];
    if (!Array.isArray(window.appState.taskHistory)) window.appState.taskHistory = [];
    window.appState.taskHistory.unshift({
        ...task,
        completed: true,
        completedAt: task.completedAt || Date.now() - (24 * 3600 * 1000),
        archivedAt: Date.now()
    });
    window.appState.tasks.splice(idx, 1);
    saveState();
    window.updateUI();
    showNotification("Moved to Task History", `"${task.title}" was archived to Task History.`, "info");
}

function restoreTaskFromHistory(histId) {
    const idx = (window.appState.taskHistory || []).findIndex(t => t.id === histId);
    if (idx === -1) return;
    const item = window.appState.taskHistory[idx];
    window.appState.taskHistory.splice(idx, 1);
    window.appState.tasks.unshift({
        ...item,
        completed: false,
        completedAt: null
    });
    saveState();
    window.updateUI();
    showNotification("Task Restored", `Restored "${item.title}" to active tasks.`, "success");
}

function deleteTaskFromHistory(histId) {
    window.appState.taskHistory = (window.appState.taskHistory || []).filter(t => t.id !== histId);
    saveState();
    window.updateUI();
    showNotification("History Item Deleted", "Removed task from history.", "info");
}

function clearAllTaskHistory() {
    window.appState.taskHistory = [];
    saveState();
    window.updateUI();
    showNotification("History Cleared", "Cleared all archived tasks from Task History.", "info");
}

function renderTaskHistoryList() {
    const container = document.getElementById('task-history-list-container');
    if (!container) return;
    const hist = window.appState.taskHistory || [];
    if (hist.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 space-y-2">
                <i class="fa-solid fa-clock-rotate-left text-2xl opacity-40" style="color:var(--v-fg2)"></i>
                <p class="text-xs font-bold" style="color:var(--v-fg)">No archived tasks in History yet</p>
                <p class="text-[11px]" style="color:var(--v-fg2)">Any task marked completed for 24 hours automatically moves here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = hist.map(item => {
        const completedDateStr = item.completedAt
            ? new Date(item.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : item.dueDate;
        return `
            <div class="glass-panel p-3.5 rounded-2xl flex items-center justify-between gap-3 border" style="border-color:var(--v-bdr2)">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <div class="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-check-double text-xs"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <h4 class="text-xs sm:text-sm font-bold line-through opacity-80 truncate" style="color:var(--v-fg)">${escapeHtml(item.title)}</h4>
                        <div class="flex items-center gap-2 mt-1 flex-wrap text-[10px]" style="color:var(--v-fg2)">
                            <span class="px-2 py-0.5 rounded bg-white/50 dark:bg-white/10 font-semibold">${escapeHtml(item.category)} (${escapeHtml(item.subcategory || 'General')})</span>
                            <span><i class="fa-regular fa-clock mr-1"></i>Completed: ${escapeHtml(completedDateStr)} (24h+ History)</span>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="restoreTaskFromHistory('${item.id}')" class="px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition hover:opacity-90" style="border-color:var(--v-bdr2);color:var(--v-fg);background:var(--v-bg3)" title="Restore to Active Tasks">
                        <i class="fa-solid fa-rotate-left mr-1"></i>Restore
                    </button>
                    <button onclick="deleteTaskFromHistory('${item.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 transition" title="Delete Permanently">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderTasksList() {
    const container = document.getElementById('task-list-container');
    if (!container) return;
    let filtered = sortTasksByDateLeftAndCompletion(window.appState.tasks || []);

    if (currentTaskFilter === 'due-soon') {
        filtered = filtered.filter(t => !t.completed && (new Date(t.dueDate) - new Date() <= 86400000 * 2));
    } else if (currentTaskFilter === 'pending') {
        filtered = filtered.filter(t => !t.completed);
    } else if (currentTaskFilter === 'completed') {
        filtered = filtered.filter(t => t.completed);
    }

    if (currentTaskCourseFilter && currentTaskCourseFilter !== 'all') {
        filtered = filtered.filter(t => t.category === 'Studies' && isTaskMatchingCourse(t, currentTaskCourseFilter));
    }

    if (currentTaskSearch) {
        filtered = filtered.filter(t =>
            (t.title || '').toLowerCase().includes(currentTaskSearch) ||
            (t.category || '').toLowerCase().includes(currentTaskSearch) ||
            (t.subcategory || '').toLowerCase().includes(currentTaskSearch) ||
            (t.course || '').toLowerCase().includes(currentTaskSearch)
        );
    }

    renderTaskCoursesFilterBar();

    ['all', 'due-soon', 'pending', 'completed'].forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (btn) {
            if (f === currentTaskFilter) {
                btn.className = "px-3 py-1.5 rounded-xl font-bold border transition whitespace-nowrap v-accent-btn";
            } else {
                btn.className = "px-3 py-1.5 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-white/50 transition whitespace-nowrap border border-transparent";
            }
        }
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-10 text-slate-500 dark:text-slate-400 text-xs font-medium">No tasks found matching this filter.</div>`;
        return;
    }

    const now = Date.now();
    container.innerHTML = filtered.map(t => {
        const isNearDeadline = !t.completed && (new Date(t.dueDate) - new Date() <= 86400000 * 2);
        const isHighlighted = highlightedTaskIdFromDashboard === t.id;
        let hoursLeftToArchive = 24;
        if (t.completed && t.completedAt) {
            const elapsedHrs = (now - t.completedAt) / (1000 * 3600);
            hoursLeftToArchive = Math.max(1, Math.ceil(24 - elapsedHrs));
        }

        return `
            <div id="task-row-${t.id}" onclick="highlightTaskRow(this)" class="glass-panel p-3 sm:p-3.5 rounded-2xl flex items-center justify-between gap-2 glass-panel-hover transition cursor-pointer outline-none ${isNearDeadline ? 'ring-1 ring-amber-500/50 bg-amber-500/5' : ''} ${isHighlighted ? 'ring-2 ring-indigo-500' : ''}">
                <!-- Expanded Tick-Box Hit Zone -->
                <div onclick="event.stopPropagation(); toggleTaskComplete('${t.id}'); highlightTaskRow(this.parentElement);"
                     title="Click anywhere here to mark/unmark task"
                     class="task-tick-zone flex items-center gap-3.5 flex-1 min-w-0 py-1.5 px-2.5 -my-1 -ml-1 rounded-xl hover:bg-indigo-500/10 dark:hover:bg-indigo-500/15 select-none">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-white/75 dark:bg-white/10 border border-indigo-500/30 shrink-0 shadow-sm">
                        <input type="checkbox" ${t.completed ? 'checked' : ''}
                               onclick="event.stopPropagation(); toggleTaskComplete('${t.id}');"
                               class="task-checkbox-visual w-5 h-5 rounded-md accent-indigo-600 cursor-pointer pointer-events-none">
                    </div>
                    <div class="truncate flex-1">
                        <h4 class="text-xs sm:text-sm font-bold truncate ${t.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}">${escapeHtml(t.title)}</h4>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <span class="text-[10px] bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold px-2 py-0.5 rounded">${escapeHtml(t.category)} (${escapeHtml(t.subcategory || 'General')})</span>${getTaskCourseBadgeHtml(t)}
                            <span class="text-[10px] ${isNearDeadline ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-600 dark:text-slate-400 font-medium'}"><i class="fa-regular fa-calendar mr-1"></i>${escapeHtml(getTaskDaysLeftLabel(t.dueDate))} ${isNearDeadline ? '⚡' : ''}</span>
                            ${t.completed ? `<span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-clock-rotate-left mr-1"></i>History in ~${hoursLeftToArchive}h</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 pl-1" onclick="event.stopPropagation()">
                    ${t.completed ? `<button onclick="archiveCompletedTaskNow('${t.id}')" class="px-2 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold border border-emerald-500/30" title="Archive to History now"><i class="fa-solid fa-box-archive"></i></button>` : ''}
                    <button onclick="viewTask('${t.id}')" class="px-2.5 py-1.5 bg-white/70 dark:bg-white/10 hover:bg-white text-slate-800 dark:text-slate-200 rounded-lg text-[10px] font-semibold border border-white/50">View</button>
                    <button onclick="editTask('${t.id}')" class="v-accent-btn px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-semibold">Edit</button>
                    <button onclick="deleteTask('${t.id}')" class="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

function highlightTaskRow(el) {
    document.querySelectorAll('#task-list-container > div').forEach(d => {
        d.classList.remove('ring-2', 'ring-indigo-500');
    });
    if (el) el.classList.add('ring-2', 'ring-indigo-500');
}

let taskBottomMoveTimers = {};

function toggleTaskComplete(id) {
    const task = (window.appState.tasks || []).find(t => t.id === id);
    if (task) {
        if (taskBottomMoveTimers[id]) {
            clearTimeout(taskBottomMoveTimers[id]);
            delete taskBottomMoveTimers[id];
        }
        task.completed = !task.completed;
        task.completedAt = task.completed ? Date.now() : null;
        saveState();
        window.updateUI();
        if (task.completed) {
            taskBottomMoveTimers[id] = setTimeout(() => {
                delete taskBottomMoveTimers[id];
                renderTasksList();
            }, 5050);
        }
        showNotification(
            task.completed ? "Task Completed! ✅" : "Task Reopened",
            task.completed
                ? `Marked "${task.title}" complete.`
                : `Unmarked "${task.title}".`,
            task.completed ? "task" : "info"
        );
    }
}

function deleteTask(id) {
    const task = (window.appState.tasks || []).find(t => t.id === id);
    window.appState.tasks = (window.appState.tasks || []).filter(t => t.id !== id);
    saveState();
    window.updateUI();
    if (task) showNotification("Task Deleted", `Removed "${task.title}".`, "info");
}

function viewTask(id) {
    const t = (window.appState.tasks || []).find(x => x.id === id);
    if (!t) return;
    document.getElementById('view-task-title').innerText = t.title;
    document.getElementById('view-task-cat').innerText = t.category;
    document.getElementById('view-task-subcat').innerText = t.subcategory || 'General';
    const courseRowEl = document.getElementById('view-task-course-row');
    const courseValEl = document.getElementById('view-task-course');
    if (courseRowEl && courseValEl) {
        if (t.category === 'Studies' && t.course) {
            courseRowEl.classList.remove('hidden');
            courseValEl.innerText = t.course;
        } else {
            courseRowEl.classList.add('hidden');
        }
    }
    document.getElementById('view-task-due').innerText = t.dueDate;
    document.getElementById('view-task-desc').innerText = t.description || 'No description provided.';
    document.getElementById('task-view-modal').classList.remove('hidden');
}

function toggleTaskInlineForm(open, isEdit = false, taskId = null) {
    const std = document.getElementById('task-standard-view');
    const frm = document.getElementById('task-inline-form-view');
    const hist = document.getElementById('task-history-view');
    if (hist) hist.classList.add('hidden');
    isTaskHistoryOpen = false;

    if (open) {
        std.classList.add('hidden');
        frm.classList.remove('hidden');
        updateCategoryDropdowns();
        if (isEdit && taskId) {
            editingTaskId = taskId;
            document.getElementById('inline-task-modal-title').innerText = 'Edit Task';
            const t = window.appState.tasks.find(x => x.id === taskId);
            if (t) {
                document.getElementById('inline-task-title').value = t.title;
                document.getElementById('inline-task-cat').value = t.category || 'Not Selected';
                selectedInlineTaskCourse = t.course || ((window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : '');
                updateInlineSubcatDropdown();
                document.getElementById('inline-task-subcat').value = t.subcategory || 'Not Selected';
                document.getElementById('inline-task-due').value = t.dueDate;
                document.getElementById('inline-task-desc').value = t.description || '';
            }
        } else {
            editingTaskId = null;
            document.getElementById('inline-task-modal-title').innerText = 'Add New Task';
            document.getElementById('inline-task-title').value = '';
            // Set Category & Sub-Category to "Not Selected" by default when adding a new task
            const catSelect = document.getElementById('inline-task-cat');
            if (catSelect) catSelect.value = 'Not Selected';
            selectedInlineTaskCourse = (currentTaskCourseFilter && currentTaskCourseFilter !== 'all')
                ? currentTaskCourseFilter
                : ((window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : '');
            updateInlineSubcatDropdown();
            const subSelect = document.getElementById('inline-task-subcat');
            if (subSelect) subSelect.value = 'Not Selected';
            document.getElementById('inline-task-due').value = formatDateKey(new Date());
            document.getElementById('inline-task-desc').value = '';
        }
        syncAllCustomSelects();
    } else {
        frm.classList.add('hidden');
        std.classList.remove('hidden');
    }
}

function updateInlineSubcatDropdown() {
    const catSelect = document.getElementById('inline-task-cat');
    const subSelect = document.getElementById('inline-task-subcat');
    if (!catSelect || !subSelect) return;
    const catVal = catSelect.value || 'Not Selected';
    const rawSubs = (catVal !== 'Not Selected' && window.appState.subcategories && window.appState.subcategories[catVal])
        ? window.appState.subcategories[catVal]
        : [];
    const optionsList = ['Not Selected', ...rawSubs.filter(s => s !== 'Not Selected')];
    subSelect.innerHTML = optionsList.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    subSelect.value = 'Not Selected';
    renderInlineTaskCourseSquareButtons();
    if (typeof syncCustomSelect === 'function') {
        syncCustomSelect('inline-task-subcat', 'fa-solid fa-tag');
    }
}

function handleInlineTaskSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('inline-task-title').value.trim();
    const rawCat = document.getElementById('inline-task-cat').value;
    const rawSubcat = document.getElementById('inline-task-subcat').value;
    const category = (!rawCat || rawCat === 'Not Selected') ? 'Not Selected' : rawCat;
    const subcategory = (!rawSubcat || rawSubcat === 'Not Selected') ? 'Not Selected' : rawSubcat;
    const dueDate = document.getElementById('inline-task-due').value || formatDateKey(new Date());
    const description = document.getElementById('inline-task-desc').value;

    const assignedCourse = (category === 'Studies')
        ? (selectedInlineTaskCourse || ((window.appState.courses && window.appState.courses[0]) ? window.appState.courses[0].name : ''))
        : '';

    if (editingTaskId) {
        const t = window.appState.tasks.find(x => x.id === editingTaskId);
        if (t) {
            t.title = title;
            t.category = category;
            t.subcategory = subcategory;
            t.course = assignedCourse;
            t.dueDate = dueDate;
            t.description = description;
        }
        editingTaskId = null;
        showNotification("Task Updated", `Saved changes to "${title}"${assignedCourse ? ' (' + assignedCourse + ')' : ''}.`, "success");
    } else {
        window.appState.tasks.unshift({
            id: Date.now().toString(),
            title,
            category,
            subcategory,
            course: assignedCourse,
            dueDate,
            description,
            completed: false,
            completedAt: null
        });
        showNotification("Task Added", `Added "${title}"${assignedCourse ? ' under ' + assignedCourse : ''} to Smart Task Tracker.`, "success");
    }
    saveState();
    toggleTaskInlineForm(false);
    window.updateUI();
}

function editTask(id) {
    toggleTaskInlineForm(true, true, id);
}

function updateCategoryDropdowns() {
    const catSelect = document.getElementById('inline-task-cat');
    if (!catSelect) return;
    const currentVal = catSelect.value;
    const cats = ['Not Selected', ...(window.appState.categories || []).filter(c => c !== 'Not Selected')];
    catSelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (currentVal && cats.includes(currentVal)) {
        catSelect.value = currentVal;
    } else {
        catSelect.value = 'Not Selected';
    }
    updateInlineSubcatDropdown();
}

function addNewCategory() {
    const input = document.getElementById('new-category-name');
    const name = (input ? input.value : '').trim();
    if (!name || window.appState.categories.includes(name)) return;
    window.appState.categories.push(name);
    window.appState.subcategories[name] = ['General'];
    input.value = '';
    saveState();
    window.updateUI();
    showNotification("Category Added", `Created category "${name}".`, "success");
}

function addNewSubcategory() {
    const cat = document.getElementById('manage-cat-select').value;
    const input = document.getElementById('new-subcategory-name');
    const sub = (input ? input.value : '').trim();
    if (!sub || !cat) return;
    if (!window.appState.subcategories[cat]) window.appState.subcategories[cat] = [];
    if (!window.appState.subcategories[cat].includes(sub)) window.appState.subcategories[cat].push(sub);
    input.value = '';
    saveState();
    window.updateUI();
    showNotification("Subcategory Added", `Added "${sub}" under ${cat}.`, "success");
}

function deleteCategory(cat) {
    window.appState.categories = window.appState.categories.filter(c => c !== cat);
    delete window.appState.subcategories[cat];
    saveState();
    window.updateUI();
}

function deleteSubcategory(cat, sub) {
    if (window.appState.subcategories[cat]) {
        window.appState.subcategories[cat] = window.appState.subcategories[cat].filter(s => s !== sub);
        saveState();
        window.updateUI();
    }
}

function renderCategoryManagerList() {
    const manageList = document.getElementById('category-structure-list');
    const manageCatSelect = document.getElementById('manage-cat-select');
    if (!manageList || !manageCatSelect) return;

    manageCatSelect.innerHTML = (window.appState.categories || []).map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

    manageList.innerHTML = (window.appState.categories || []).map(c => `
        <div class="bg-white/40 dark:bg-white/5 p-2.5 rounded-xl border border-white/20 space-y-1">
            <div class="flex justify-between items-center font-bold text-slate-800 dark:text-slate-200">
                <span>${escapeHtml(c)}</span>
                <button onclick="deleteCategory('${escapeHtml(c)}')" class="text-red-500 hover:underline text-[10px]">Delete Cat</button>
            </div>
            <div class="pl-3 flex flex-wrap gap-1">
                ${(window.appState.subcategories[c] || []).map(s => `
                    <span class="inline-flex items-center gap-1 bg-white/60 dark:bg-white/10 px-2 py-0.5 rounded text-[10px] text-slate-800 dark:text-slate-200 font-medium">
                        ${escapeHtml(s)} <button onclick="deleteSubcategory('${escapeHtml(c)}', '${escapeHtml(s)}')" class="text-red-400 hover:text-red-600">×</button>
                    </span>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Hydration Module
function logWaterGlass() {
    const added = window.appState.glassSizeMl || 250;
    window.appState.waterIntakeMl = (window.appState.waterIntakeMl || 0) + added;
    window.appState.lastWaterReminderAt = Date.now();
    saveState();
    window.updateUI();
    showNotification("Hydration Logged 💧", `+${added} ml added! Total: ${window.appState.waterIntakeMl} ml.`, "success");
}

function resetWaterIntake() {
    window.appState.waterIntakeMl = 0;
    saveState();
    window.updateUI();
    showNotification("Hydration Reset", "Daily water counter reset to 0 ml.", "info");
}

function toggleWaterInlineSettings(open) {
    const std = document.getElementById('hydration-standard-view');
    const inl = document.getElementById('hydration-inline-settings');
    if (open) {
        std.classList.add('hidden');
        inl.classList.remove('hidden');
        document.getElementById('inline-water-goal').value = window.appState.dailyWaterGoalMl || 2500;
        document.getElementById('inline-water-size').value = window.appState.glassSizeMl || 250;
        const intervalEl = document.getElementById('inline-water-interval');
        if (intervalEl) intervalEl.value = window.appState.waterReminderIntervalMin || 90;
    } else {
        inl.classList.add('hidden');
        std.classList.remove('hidden');
    }
}

function saveInlineWaterSettings(e) {
    e.preventDefault();
    window.appState.dailyWaterGoalMl = parseInt(document.getElementById('inline-water-goal').value) || 2500;
    window.appState.glassSizeMl = parseInt(document.getElementById('inline-water-size').value) || 250;
    const intervalInput = document.getElementById('inline-water-interval');
    if (intervalInput) {
        window.appState.waterReminderIntervalMin = Math.max(5, Math.min(360, parseInt(intervalInput.value) || 90));
    }
    window.appState.lastWaterReminderAt = Date.now();
    toggleWaterInlineSettings(false);
    saveState();
    window.updateUI();
    showNotification("Hydration Updated", `Goal set to ${window.appState.dailyWaterGoalMl}ml (${window.appState.glassSizeMl}ml glass, reminder every ${window.appState.waterReminderIntervalMin || 90}m).`, "success");
}

// Motivation Hub
function rotateQuote() {
    const quotes = motivationalQuotes;
    const box = document.getElementById('motivation-quote-box');
    if (box) {
        box.innerText = `"${quotes[Math.floor(Math.random() * quotes.length)]}"`;
    }
}

function copyQuote(btn) {
    const quoteText = document.getElementById('motivation-quote-box').innerText;
    const textToCopy = `${quoteText}\n-FocusPulse`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(() => {});
    } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
    }
    const span = btn.querySelector('.copy-text');
    if (span) {
        const orig = span.innerText;
        span.innerText = "Copied...";
        span.style.color = "#10b981";
        setTimeout(() => { span.innerText = orig; span.style.color = ""; }, 1500);
    }
    showNotification("Quote Copied", "Motivational quote copied to clipboard!", "success");
}

// Active Plans / Schedules
function renderSchedules() {
    const container = document.getElementById('schedules-container');
    if (!container) return;
    if (!window.appState.schedules || window.appState.schedules.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-600 dark:text-slate-400 font-semibold text-center py-4">No active plans.</p>';
        return;
    }
    container.innerHTML = window.appState.schedules.map(s => `
        <div class="bg-white/50 dark:bg-white/[0.04] border border-white/60 dark:border-white/10 p-3.5 rounded-2xl text-xs space-y-1 relative group">
            <div class="absolute top-2.5 right-2.5 flex gap-1.5 opacity-80 group-hover:opacity-100 transition">
                <button onclick="editSchedule('${s.id}')" class="text-indigo-500 hover:text-indigo-700 p-1" title="Edit Plan"><i class="fa-solid fa-pen text-[10px]"></i></button>
                <button onclick="deleteSchedule('${s.id}')" class="text-red-500 hover:text-red-700 p-1" title="Delete Plan"><i class="fa-solid fa-trash text-[10px]"></i></button>
            </div>
            <p class="font-bold" style="color:var(--v-accent)">${escapeHtml(s.presetName)}</p>
            <p class="text-slate-800 dark:text-slate-200 font-semibold">${s.hours} Hours / ${s.sessions} Sessions (${escapeHtml(s.days || 'Mon - Fri')})</p>
        </div>
    `).join('');
}

function openScheduleModal(isEdit = false, schedId = null) {
    editingScheduleId = schedId;
    const titleEl = document.getElementById('sched-modal-title');
    if (isEdit && schedId) {
        titleEl.innerText = 'Edit Active Plan';
        const s = window.appState.schedules.find(x => x.id === schedId);
        if (s) {
            document.getElementById('sched-name-input').value = s.presetName;
            document.getElementById('sched-hours-input').value = s.hours;
            document.getElementById('sched-sessions-input').value = s.sessions;
        }
    } else {
        titleEl.innerText = 'Add Active Plan';
        document.getElementById('sched-name-input').value = 'Balanced Weekdays';
        document.getElementById('sched-hours-input').value = '3';
        document.getElementById('sched-sessions-input').value = '3';
    }
    document.getElementById('schedule-modal').classList.remove('hidden');
}

function editSchedule(id) {
    openScheduleModal(true, id);
}

function handleScheduleSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('sched-name-input').value.trim();
    const hours = parseInt(document.getElementById('sched-hours-input').value) || 3;
    const sessions = parseInt(document.getElementById('sched-sessions-input').value) || 3;
    const checkedDays = Array.from(document.querySelectorAll('input[name="sched-day"]:checked')).map(el => el.value);
    const days = checkedDays.length > 0 ? checkedDays.join(', ') : 'Mon - Fri';

    if (editingScheduleId) {
        const s = window.appState.schedules.find(x => x.id === editingScheduleId);
        if (s) { s.presetName = name; s.hours = hours; s.sessions = sessions; s.days = days; }
        editingScheduleId = null;
        showNotification("Plan Updated", `Updated "${name}" study schedule.`, "success");
    } else {
        window.appState.schedules.push({ id: Date.now().toString(), presetName: name, hours, sessions, days });
        showNotification("Plan Added", `Added "${name}" to Active Plans.`, "success");
    }
    saveState();
    closeScheduleModal();
    window.updateUI();
}

function deleteSchedule(id) {
    window.appState.schedules = window.appState.schedules.filter(s => s.id !== id);
    saveState();
    window.updateUI();
    showNotification("Plan Removed", "Study schedule removed.", "info");
}

// Account & Profile Update
async function handleAccountSubmit(e) {
    e.preventDefault();
    const newName = document.getElementById('account-name-input').value.trim();
    const newSubjects = document.getElementById('account-subjects-input').value.trim();
    if (!newName) return;

    window.appState.user.name = newName;
    window.appState.user.subjects = newSubjects;
    if (typeof syncCoursesFromSubjectsString === 'function') syncCoursesFromSubjectsString(newSubjects);
    window.appState.user.isCustomName = true;
    window.appState.updatedAt = Date.now();

    try {
        localStorage.setItem('focuspulse_guest_name', newName);
        localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));
    } catch (err) {}

    saveState(true);
    if (window.firebaseUpdateProfileName) {
        await window.firebaseUpdateProfileName(newName, newSubjects);
    }
    closeAccountModal();
    window.updateUI();
    showNotification("Profile Saved", `Display name updated to "${newName}" and synced to database!`, "success");
}

async function handleInlineProfileSave(e) {
    e.preventDefault();
    const nameEl = document.getElementById('inline-profile-name-input');
    const subjEl = document.getElementById('inline-profile-subjects-input');
    const newName = (nameEl ? nameEl.value : '').trim();
    const newSubjects = (subjEl ? subjEl.value : '').trim();
    if (!newName) return;

    window.appState.user.name = newName;
    window.appState.user.subjects = newSubjects;
    if (typeof syncCoursesFromSubjectsString === 'function') syncCoursesFromSubjectsString(newSubjects);
    window.appState.user.isCustomName = true;
    window.appState.updatedAt = Date.now();

    try {
        localStorage.setItem('focuspulse_guest_name', newName);
        localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));
    } catch (err) {}

    saveState(true);
    if (window.firebaseUpdateProfileName) {
        await window.firebaseUpdateProfileName(newName, newSubjects);
    }
    window.updateUI();
    showNotification("Account Updated", `Your name "${newName}" is saved locally and synced to cloud!`, "success");
}

function toggleWorkspace() {
    isWorkspaceOpen = !isWorkspaceOpen;
    const panel = document.getElementById('workspace-panel');
    if (isWorkspaceOpen) panel.classList.remove('hidden');
    else panel.classList.add('hidden');
}

function addWorkspaceTodo() {
    const container = document.getElementById('workspace-todos');
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2';
    div.innerHTML = `<input type="checkbox" class="w-4 h-4 rounded text-amber-500 shrink-0"><input type="text" placeholder="Quick task..." class="flex-1 bg-white/50 dark:bg-[#050508] border border-white/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-medium">`;
    container.appendChild(div);
}

function toggleLiquidGlassEffect() {
    window.appState.liquidEffect = !window.appState.liquidEffect;
    applyLiquidGlass(window.appState.liquidEffect);
    applyThemeVariables();
    saveState();
    renderThemePalettes();
    showNotification(
        window.appState.liquidEffect ? "Liquid Glass Mode: ON" : "Solid Theme Mode: ON (Liquid OFF)",
        window.appState.liquidEffect
            ? "Restored original FocusPulse frosted glass & gradient aesthetics!"
            : "Activated solid theme & custom palette engine (zero gradients/transparency).",
        "info"
    );
}

function applyLiquidGlass(isLiquid) {
    const enabled = Boolean(isLiquid);
    document.documentElement.classList.toggle('liquid-off', !enabled);
    document.documentElement.classList.toggle('liquid-on', enabled);

    const pomo = document.getElementById('section-pomodoro');
    if (pomo) {
        if (enabled) {
            pomo.classList.add('liquid-panel');
            pomo.classList.remove('glass-panel');
        } else {
            pomo.classList.remove('liquid-panel');
            pomo.classList.add('glass-panel');
        }
    }

    ['liquid-toggle-btn-label', 'side-liquid-btn-label', 'page-liquid-btn-label'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = enabled ? 'Liquid: ON' : 'Liquid: OFF';
    });
}

function toggleDarkMode() {
    const nextMode = (window.appState.theme === 'light') ? 'dark' : 'light';
    setSurfaceMode(nextMode);
}

function openBetaModal() { document.getElementById('beta-modal').classList.remove('hidden'); }
function closeBetaModal() { document.getElementById('beta-modal').classList.add('hidden'); }
function openGuideModal() { document.getElementById('guide-modal').classList.remove('hidden'); }
function closeGuideModal() { document.getElementById('guide-modal').classList.add('hidden'); }
function closeTaskViewModal() { document.getElementById('task-view-modal').classList.add('hidden'); }
function openCategoryManagerModal() { document.getElementById('category-manage-modal').classList.remove('hidden'); }
function closeCategoryManagerModal() { document.getElementById('category-manage-modal').classList.add('hidden'); }
function openSettingsModal() {
    renderThemePalettes();
    document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettingsModal() { document.getElementById('settings-modal').classList.add('hidden'); }
function closeScheduleModal() { document.getElementById('schedule-modal').classList.add('hidden'); }
function openAccountModal() { document.getElementById('account-modal').classList.remove('hidden'); }
function closeAccountModal() { document.getElementById('account-modal').classList.add('hidden'); }

function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
}


// =========================================================================
// CUSTOM UI SELECTION DROPDOWNS (Category & Sub-Category Same as App UI)
// =========================================================================
const CUSTOM_SELECT_IDS = [
    { selectId: 'inline-task-cat', icon: 'fa-solid fa-folder-tree' },
    { selectId: 'inline-task-subcat', icon: 'fa-solid fa-tag' },
    { selectId: 'manage-cat-select', icon: 'fa-solid fa-layer-group' },
    { selectId: 'new-habit-category-input', icon: 'fa-solid fa-fire-flame-curved' }
];

function syncCustomSelect(selectId, iconClass = 'fa-solid fa-folder') {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;

    let wrapper = document.getElementById(`fp-custom-wrap-${selectId}`);
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = `fp-custom-wrap-${selectId}`;
        wrapper.className = 'fp-custom-select-wrapper';
        selectEl.parentNode.insertBefore(wrapper, selectEl);
        wrapper.appendChild(selectEl);
        selectEl.classList.add('fp-select-native-hidden');

        const triggerBtn = document.createElement('button');
        triggerBtn.type = 'button';
        triggerBtn.id = `fp-custom-btn-${selectId}`;
        triggerBtn.className = 'fp-custom-select-trigger';
        triggerBtn.onclick = function(e) {
            e.stopPropagation();
            toggleCustomSelectMenu(selectId);
        };
        wrapper.appendChild(triggerBtn);

        const menuDiv = document.createElement('div');
        menuDiv.id = `fp-custom-menu-${selectId}`;
        menuDiv.className = 'fp-custom-select-menu';
        wrapper.appendChild(menuDiv);
    }

    const triggerBtn = document.getElementById(`fp-custom-btn-${selectId}`);
    const menuDiv = document.getElementById(`fp-custom-menu-${selectId}`);
    const options = Array.from(selectEl.options || []);
    const selectedValue = selectEl.value || (options[0] ? options[0].value : '');
    const selectedOpt = options.find(o => o.value === selectedValue) || options[0];
    const selectedLabel = selectedOpt ? selectedOpt.textContent : 'Select...';

    if (triggerBtn) {
        triggerBtn.innerHTML = `
            <span class="flex items-center gap-2 truncate">
                <i class="${iconClass} text-[11px]" style="color:var(--v-accent)"></i>
                <span class="truncate">${escapeHtml(selectedLabel)}</span>
            </span>
            <i class="fa-solid fa-chevron-down fp-select-chevron"></i>
        `;
    }

    if (menuDiv) {
        menuDiv.innerHTML = options.map(opt => {
            const isSel = opt.value === selectedValue;
            return `
                <button type="button"
                    onclick="event.stopPropagation(); chooseCustomSelectOption('${selectId}', '${escapeHtml(opt.value)}')"
                    class="fp-custom-select-option ${isSel ? 'selected' : ''}">
                    <span class="truncate">${escapeHtml(opt.textContent)}</span>
                    ${isSel ? '<i class="fa-solid fa-check text-[10px]" style="color:var(--v-accent)"></i>' : ''}
                </button>
            `;
        }).join('');
    }
}

function syncAllCustomSelects() {
    CUSTOM_SELECT_IDS.forEach(item => syncCustomSelect(item.selectId, item.icon));
}

function toggleCustomSelectMenu(selectId) {
    const targetWrap = document.getElementById(`fp-custom-wrap-${selectId}`);
    if (!targetWrap) return;
    const isOpen = targetWrap.classList.contains('open');
    closeAllCustomSelectMenus();
    if (!isOpen) {
        syncCustomSelect(
            selectId,
            (CUSTOM_SELECT_IDS.find(x => x.selectId === selectId) || {}).icon || 'fa-solid fa-folder'
        );
        targetWrap.classList.add('open');
    }
}

function closeAllCustomSelectMenus() {
    document.querySelectorAll('.fp-custom-select-wrapper.open').forEach(el => {
        el.classList.remove('open');
    });
}

function chooseCustomSelectOption(selectId, val) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    selectEl.value = val;
    closeAllCustomSelectMenus();
    if (typeof selectEl.onchange === 'function') {
        selectEl.onchange(new Event('change'));
    } else {
        selectEl.dispatchEvent(new Event('change'));
    }
    syncAllCustomSelects();
}

document.addEventListener('click', () => {
    closeAllCustomSelectMenus();
});

// =========================================================================
// SETTINGS -> UPDATES, LIVE GITHUB VERSION REPORT & CREDITS (azmee7 (Azmi))
// =========================================================================
function renderUpdatesAndCreditsUI() {
    const state = window.appState || {};
    const autoCheck = state.autoCheckUpdates !== false;
    const toggleBtn = document.getElementById('auto-update-switch-btn');
    if (toggleBtn) {
        if (autoCheck) toggleBtn.classList.add('active');
        else toggleBtn.classList.remove('active');
        toggleBtn.setAttribute('aria-checked', autoCheck ? 'true' : 'false');
    }

    const installedVer = state.installedVersion || 'v1.0';
    const latestVer = state.latestVersion || installedVer;

    const topBadge = document.getElementById('topbar-installed-version-badge');
    if (topBadge) topBadge.innerText = installedVer;

    const installedEl = document.getElementById('fp-installed-version-text');
    const latestEl = document.getElementById('fp-latest-version-text');
    if (installedEl) installedEl.innerText = installedVer;
    if (latestEl) latestEl.innerText = latestVer;

    const bannerHeading = document.getElementById('fp-banner-heading');
    const bannerSubtext = document.getElementById('fp-banner-subtext');
    const bannerBtnLabel = document.getElementById('fp-banner-btn-label');

    if (installedVer !== latestVer) {
        if (bannerHeading) {
            bannerHeading.innerHTML = `Update available: <span id="fp-banner-version">${escapeHtml(latestVer)}</span>`;
        }
        if (bannerSubtext) {
            bannerSubtext.innerText = `A new version of FocusPulse (${latestVer}) is reported on GitHub Releases. Your installed version is ${installedVer}.`;
        }
        if (bannerBtnLabel) {
            bannerBtnLabel.innerText = `Download ${latestVer}`;
        }
    } else {
        if (bannerHeading) {
            bannerHeading.innerHTML = `Current Installed: <span id="fp-banner-version">${escapeHtml(installedVer)}</span>`;
        }
        if (bannerSubtext) {
            bannerSubtext.innerText = `Latest version reported on GitHub Releases: ${latestVer}. You are running the latest build.`;
        }
        if (bannerBtnLabel) {
            bannerBtnLabel.innerText = `GitHub Releases (${latestVer})`;
        }
    }
}

async function fetchLatestGitHubReleaseVersion(silent = true) {
    const repo = (window.appState && window.appState.githubRepo) ? window.appState.githubRepo : 'azmee7/focuspulse';
    let reportedVersion = null;
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.tag_name) {
                reportedVersion = String(data.tag_name).trim();
            }
        } else {
            const tagsRes = await fetch(`https://api.github.com/repos/${repo}/tags`, {
                headers: { 'Accept': 'application/vnd.github+json' }
            });
            if (tagsRes.ok) {
                const tags = await tagsRes.json();
                if (Array.isArray(tags) && tags.length > 0 && tags[0].name) {
                    reportedVersion = String(tags[0].name).trim();
                }
            }
        }
    } catch (e) {}

    if (reportedVersion) {
        window.appState.latestVersion = reportedVersion;
    } else if (!window.appState.latestVersion) {
        window.appState.latestVersion = window.appState.installedVersion || 'v1.0';
    }
    saveState();
    renderUpdatesAndCreditsUI();

    if (!silent) {
        const installed = window.appState.installedVersion || 'v1.0';
        const latest = window.appState.latestVersion || installed;
        if (latest !== installed) {
            showNotification(
                `Update Available: ${latest} 🚀`,
                `GitHub Releases reports version ${latest} (Installed: ${installed}).`,
                "success"
            );
        } else {
            showNotification(
                `Up to Date (${installed}) ✅`,
                `Installed version (${installed}) matches the latest GitHub report (${latest}).`,
                "success"
            );
        }
    }
}

function toggleAutoUpdateOnStartup() {
    window.appState.autoCheckUpdates = !(window.appState.autoCheckUpdates !== false);
    saveState();
    renderUpdatesAndCreditsUI();
    showNotification(
        window.appState.autoCheckUpdates ? "Auto-Update Check Enabled" : "Auto-Update Check Disabled",
        window.appState.autoCheckUpdates
            ? "FocusPulse will automatically check GitHub Releases on startup."
            : "Startup release checks paused.",
        "info"
    );
}

async function triggerManualUpdateCheck() {
    const btn = document.getElementById('fp-manual-check-btn');
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate fa-spin mr-1.5"></i> Checking...`;
    }
    await fetchLatestGitHubReleaseVersion(false);
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate mr-1.5"></i> Check Now`;
    }
}

window.openExternalUrl = function(url, labelHint = '') {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) return;

    // 1. Prioritize Tauri v2 official plugin-opener (Chrome/Edge/Safari default browser)
    try {
        if (window.__TAURI__ && window.__TAURI__.opener && typeof window.__TAURI__.opener.openUrl === 'function') {
            window.__TAURI__.opener.openUrl(cleanUrl).catch(() => {});
            return;
        }
        if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
            window.__TAURI_INTERNALS__.invoke('plugin:opener|open_url', { url: cleanUrl }).catch(() => {
                window.__TAURI_INTERNALS__.invoke('open_external_url', { url: cleanUrl }).catch(() => {});
            });
            return;
        }
        if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
            window.__TAURI__.core.invoke('open_external_url', { url: cleanUrl }).catch(() => {});
            return;
        }
    } catch (e) {}

    // 2. Standard Web / PWA / Capacitor fallback
    try {
        const a = document.createElement('a');
        a.href = cleanUrl;
        if (!cleanUrl.startsWith('mailto:')) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
        }
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (e) {
        try { window.open(cleanUrl, '_blank', 'noopener,noreferrer'); } catch (err) {}
    }
};

// Global click interceptor so ANY external link (<a href="https://..."> or mailto:) in EXE opens in default browser
document.addEventListener('click', (e) => {
    const anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!anchor) return;
    const href = (anchor.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        const hasTauri = Boolean(
            (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) ||
            (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke)
        );
        if (hasTauri) {
            e.preventDefault();
            window.openExternalUrl(href);
        }
    }
});

function downloadLatestFocusPulseRelease() {
    const latest = window.appState.latestVersion || 'v1.0';
    window.openExternalUrl('https://github.com/foc-it/FocusPulse/releases/latest');
    showNotification(
        `Opening GitHub Releases (${latest})`,
        "Opened github.com/foc-it/FocusPulse/releases/latest in your default browser!",
        "success"
    );
}

function openFocItGitHub() {
    window.openExternalUrl('https://github.com/foc-it');
    showNotification("Opening GitHub (Foc-It)", "Opened github.com/foc-it in your default browser.", "info");
}

function openCreatorGitHub() {
    window.openExternalUrl('https://github.com/azmee7');
    showNotification("Opening GitHub (azmee7)", "Opened github.com/azmee7 in your default browser.", "info");
}

// =========================================================================
// INSTALL FOCUSPULSE MODAL CONTROLLER (FP-17)
// =========================================================================
let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
});

async function probeGitHubReleaseAssetsStatus() {
    const winBadge = document.getElementById('install-win-status-badge');
    const apkBadge = document.getElementById('install-apk-status-badge');
    const winBtnText = document.getElementById('install-win-btn-label');
    const apkBtnText = document.getElementById('install-apk-btn-label');
    try {
        const res = await fetch('https://api.github.com/repos/foc-it/FocusPulse/releases/latest', {
            headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (res.ok) {
            const data = await res.json();
            const assets = Array.isArray(data.assets) ? data.assets : [];
            const exeAsset = assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
            const signedApkAsset = assets.find(a => a.name && a.name.toLowerCase().endsWith('.apk') && !a.name.toLowerCase().includes('unsigned'));
            if (exeAsset) {
                if (winBadge) {
                    winBadge.innerText = 'Release Ready (.EXE)';
                    winBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30';
                }
                if (winBtnText) winBtnText.innerText = 'Download Windows Installer (.EXE)';
            } else {
                if (winBadge) {
                    winBadge.innerText = 'View on GitHub Releases';
                    winBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30';
                }
            }
            if (signedApkAsset) {
                if (apkBadge) {
                    apkBadge.innerText = 'Signed APK Ready';
                    apkBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30';
                }
                if (apkBtnText) apkBtnText.innerText = 'Download Signed Android APK';
            } else {
                if (apkBadge) {
                    apkBadge.innerText = 'Signed Release Pending • View Releases';
                    apkBadge.className = 'text-[10px] px-2 py-0.5 rounded-full font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30';
                }
            }
            return;
        }
    } catch (e) {}
    if (winBadge) {
        winBadge.innerText = 'GitHub Releases (v1.0.0)';
    }
    if (apkBadge) {
        apkBadge.innerText = 'Signed APK via GitHub Releases';
    }
}

function openInstallAppModal() {
    const modal = document.getElementById('install-app-modal');
    if (modal) {
        modal.classList.remove('hidden');
        probeGitHubReleaseAssetsStatus();
    }
}

function closeInstallAppModal() {
    const modal = document.getElementById('install-app-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function triggerInstallPlatformAction(platform) {
    if (platform === 'windows') {
        window.openExternalUrl('https://github.com/foc-it/FocusPulse/releases/latest');
        showNotification('Windows Installer (.EXE)', 'Opening official FocusPulse GitHub Releases page.', 'info');
    } else if (platform === 'android') {
        window.openExternalUrl('https://github.com/foc-it/FocusPulse/releases/latest');
        showNotification('Android Signed APK', 'Opening official FocusPulse GitHub Releases page. Remember to allow installing from this source if prompted by Android.', 'info');
    } else if (platform === 'web') {
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
            deferredPwaPrompt.userChoice.finally(() => {
                deferredPwaPrompt = null;
            });
        }
        closeInstallAppModal();
        showNotification('FocusPulse Web Suite Active ⚡', 'You are running the full FocusPulse Web Application right here!', 'success');
    }
}

// =========================================================================
// AUTOMATIC PLATFORM UI & MOBILE CONTAINER OVERFLOW ENGINE (FP-08, FP-09)
// - Windows .exe (Tauri / WebView2 / Electron) -> desk-ui (shows window & history controls)
// - Web Browser -> hides desktop window controls & < > ↻ history buttons, shows Install FocusPulse button
// - Android .apk / Mobile -> mobile-ui (single container per row, zero desktop controls)
// =========================================================================
function isNativeAndroidApkRuntime() {
    const ua = navigator.userAgent || '';
    const isCapacitorAndroid = Boolean(window.Capacitor && (!window.Capacitor.getPlatform || window.Capacitor.getPlatform() === 'android'));
    const isTauriAndroid = Boolean((window.__TAURI__ || window.__TAURI_INTERNALS__) && /Android/i.test(ua));
    const isAndroidWebView = /Android.*(wv|Version\/\d+\.\d+)/i.test(ua);
    return isCapacitorAndroid || isTauriAndroid || isAndroidWebView;
}

function isAndroidOrMobileRuntime() {
    const ua = navigator.userAgent || '';
    const isMobileUA = /Android|wv|Adr|Mobile|iPhone|iPad|iPod/i.test(ua);
    const isMobileViewport = window.innerWidth < 768;
    return isNativeAndroidApkRuntime() || isMobileUA || isMobileViewport;
}

function isWindowsDesktopExeRuntime() {
    if (isNativeAndroidApkRuntime()) return false;
    const ua = navigator.userAgent || '';
    const isTauriDesktop = Boolean((window.__TAURI__ || window.__TAURI_INTERNALS__) && !/Android|iPhone|iPad/i.test(ua));
    const isElectronOrHostBridge = Boolean(/Electron/i.test(ua) || window.focusPulseDesktop);
    return isTauriDesktop || isElectronOrHostBridge;
}

function detectAndApplyPlatformUI() {
    const isApk = isNativeAndroidApkRuntime();
    const isMobile = isAndroidOrMobileRuntime();
    const isWinDesktop = isWindowsDesktopExeRuntime();
    const isWebBrowser = !isWinDesktop && !isApk;

    const root = document.documentElement;
    root.classList.remove('apk-mobile-view');
    root.classList.toggle('android-apk', isApk);
    root.classList.toggle('mobile-ui', isMobile);
    root.classList.toggle('desk-ui', isWinDesktop);
    root.classList.toggle('web-ui', isWebBrowser);
    root.setAttribute('data-ui-mode', isMobile ? 'mobile' : (isWinDesktop ? 'desktop-exe' : 'web'));

    // Hide desktop-only controls (Minimize, Maximize, Fullscreen, Close, < > ↻ history nav, Windows Settings) on Web & Android APK (FP-08, FP-09)
    document.querySelectorAll('.fp-exe-only-card, .fp-titlebar-nav, #fp-titlebar-nav-divider').forEach(el => {
        if (!isWinDesktop) {
            el.classList.add('hidden');
            el.style.display = 'none';
        } else {
            el.classList.remove('hidden');
            el.style.display = '';
        }
    });

    // Show the "Install FocusPulse" button in the topbar on Web (FP-17)
    document.querySelectorAll('.fp-web-install-trigger').forEach(btn => {
        if (isWebBrowser) {
            btn.classList.remove('hidden');
            btn.style.display = 'inline-flex';
        } else {
            btn.classList.add('hidden');
            btn.style.display = 'none';
        }
    });

    autoAdjustMobileContainers();
}

function autoAdjustMobileContainers() {
    const isMobile = window.innerWidth < 768 || isAndroidOrMobileRuntime();

    // 1. Inspect multi-column grids: on mobile or if any grid child overflows/overrides, force single container in a row
    const grids = document.querySelectorAll(
        '#main-focus-grid .grid:not(#habit-weekly-bar-chart):not(#habit-emoji-picker):not(#sched-days-checkboxes), .fp-auto-grid'
    );
    grids.forEach(grid => {
        grid.classList.remove('fp-single-col-stack');
        if (isMobile) {
            grid.classList.add('fp-single-col-stack');
            return;
        }
        // Even on wider screens, if any child overflows horizontally or collides, collapse to single container per row
        if (grid.clientWidth > 0 && grid.scrollWidth > grid.clientWidth + 4) {
            grid.classList.add('fp-single-col-stack');
        }
    });

    // 2. Inspect flex button rows & headers: if buttons or contents override/overflow their row on mobile, stack or wrap cleanly
    const flexRows = document.querySelectorAll(
        '#main-focus-grid .flex.items-center.justify-between, #main-focus-grid .fp-auto-btn-grid'
    );
    flexRows.forEach(row => {
        row.classList.remove('fp-btn-row-stack');
        if (row.clientWidth > 0 && row.scrollWidth > row.clientWidth + 6) {
            row.style.flexWrap = 'wrap';
            if (window.innerWidth < 420) {
                row.classList.add('fp-btn-row-stack');
            }
        }
    });
}

window.addEventListener('resize', () => {
    detectAndApplyPlatformUI();
});


// =========================================================================
// COURSES & 2-LETTER PROFILE BADGES MANAGER + SQUARE COURSE TASK BUTTONS
// =========================================================================
const COURSE_BADGE_COLORS = ['#8b5cf6', '#5f5bf6', '#10b981', '#f97316', '#d946ef', '#06b6d4', '#eab308', '#ef4444', '#3b82f6', '#f43f5e'];

function isTaskMatchingCourse(task, courseName) {
    if (!task || task.category !== 'Studies' || !courseName) return false;
    const target = courseName.trim().toLowerCase();
    if (task.course && task.course.trim().toLowerCase() === target) return true;
    if (!task.course && (task.title || '').toLowerCase().includes(target)) return true;
    return false;
}

function getPendingTaskCountForCourse(courseName) {
    const allTasks = (window.appState && window.appState.tasks) ? window.appState.tasks : [];
    return allTasks.filter(t => !t.completed && isTaskMatchingCourse(t, courseName)).length;
}

function getTaskCourseBadgeHtml(task) {
    if (!task || task.category !== 'Studies' || !task.course) return '';
    const courses = (window.appState && window.appState.courses) ? window.appState.courses : [];
    const found = courses.find(c => c.name.toLowerCase() === task.course.toLowerCase());
    const col = found ? (found.color || '#5f5bf6') : '#5f5bf6';
    const code = found ? (found.code || found.name.slice(0, 2)).toUpperCase() : task.course.slice(0, 2).toUpperCase();
    return `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded inline-flex items-center gap-1" style="background:${col}22;color:${col};border:1px solid ${col}44;"><span class="font-mono">${escapeHtml(code)}</span><span>• ${escapeHtml(task.course)}</span></span>`;
}

function renderInlineTaskCourseSquareButtons() {
    const catSelect = document.getElementById('inline-task-cat');
    const rowEl = document.getElementById('inline-task-course-row');
    const containerEl = document.getElementById('inline-task-course-buttons');
    if (!rowEl || !containerEl || !catSelect) return;

    const isStudies = (catSelect.value === 'Studies');
    if (!isStudies) {
        rowEl.classList.add('hidden');
        return;
    }
    rowEl.classList.remove('hidden');

    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    if (courses.length === 0) {
        containerEl.innerHTML = `
            <div class="text-xs py-2 px-3 rounded-xl border" style="border-color:var(--v-bdr2);color:var(--v-fg2);">
                No courses added yet. <button type="button" onclick="openCourseSettingsSection()" class="font-extrabold underline" style="color:var(--v-accent)">Add courses in Settings</button>
            </div>
        `;
        return;
    }

    if (!selectedInlineTaskCourse || !courses.some(c => c.name === selectedInlineTaskCourse)) {
        selectedInlineTaskCourse = courses[0].name;
    }

    containerEl.innerHTML = courses.map(c => {
        const isSel = (c.name === selectedInlineTaskCourse);
        const col = c.color || '#5f5bf6';
        const twoLetters = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
        const pendingCnt = getPendingTaskCountForCourse(c.name);
        return `
            <button type="button"
                onclick="selectInlineTaskCourse('${escapeHtml(c.name)}')"
                class="fp-course-sq-btn ${isSel ? 'active' : ''}">
                <div class="fp-course-sq-avatar" style="background:${col}24;color:${col};border:1.5px solid ${col}66;">
                    ${escapeHtml(twoLetters)}
                </div>
                <span class="text-[11px] font-extrabold truncate w-full" style="color:var(--v-fg)">${escapeHtml(c.name)}</span>
                <span class="text-[9px] font-bold" style="color:${pendingCnt > 0 ? col : 'var(--v-fg3)'}">${pendingCnt} pending</span>
            </button>
        `;
    }).join('');
}

function selectInlineTaskCourse(courseName) {
    selectedInlineTaskCourse = courseName;
    renderInlineTaskCourseSquareButtons();
}

function filterTasksByCourseFromSidebar(courseName) {
    if (activeMainTab === 'tasks' && currentTaskCourseFilter === courseName) {
        currentTaskCourseFilter = 'all';
    } else {
        currentTaskCourseFilter = courseName;
    }
    isTaskHistoryOpen = false;
    switchAppView('tasks');
    window.updateUI();
}

function setTaskCourseFilter(courseName) {
    currentTaskCourseFilter = courseName || 'all';
    renderTasksList();
    // Also refresh sidebar active highlight
    const sideCoursesEl = document.getElementById('sidebar-courses-list');
    if (sideCoursesEl && typeof window.updateUI === 'function') {
        renderTaskCoursesFilterBar();
    }
}

function renderTaskCoursesFilterBar() {
    const barEl = document.getElementById('task-courses-filter-bar');
    if (!barEl) return;
    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];
    if (courses.length === 0) {
        barEl.innerHTML = '';
        return;
    }
    const allStudiesPending = (window.appState.tasks || []).filter(t => !t.completed && t.category === 'Studies').length;
    const allActive = (currentTaskCourseFilter === 'all');

    const pillsHtml = [
        `<button type="button" onclick="setTaskCourseFilter('all')" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition whitespace-nowrap flex items-center gap-1.5 border ${allActive ? 'v-accent-btn' : ''}" style="${allActive ? '' : 'border-color:var(--v-bdr2);background:var(--v-bg0);color:var(--v-fg2);'}">
            <i class="fa-solid fa-layer-group text-[10px]"></i>
            <span>All Courses (${allStudiesPending})</span>
        </button>`
    ].concat(courses.map(c => {
        const col = c.color || '#5f5bf6';
        const twoLetters = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
        const cnt = getPendingTaskCountForCourse(c.name);
        const isActive = (currentTaskCourseFilter === c.name);
        return `
            <button type="button" onclick="setTaskCourseFilter('${escapeHtml(c.name)}')"
                class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition whitespace-nowrap flex items-center gap-2 border ${isActive ? 'v-accent-btn' : ''}"
                style="${isActive ? '' : `border-color:var(--v-bdr2);background:var(--v-bg0);color:var(--v-fg);`}">
                <span class="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black uppercase" style="background:${isActive ? 'rgba(255,255,255,0.2)' : col + '25'};color:${isActive ? '#fff' : col};">
                    ${escapeHtml(twoLetters)}
                </span>
                <span>${escapeHtml(c.name)}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[9px] font-black" style="background:${isActive ? 'rgba(255,255,255,0.22)' : col + '22'};color:${isActive ? '#fff' : col};">${cnt}</span>
            </button>
        `;
    })).join('');

    barEl.innerHTML = pillsHtml;
}

function openCourseSettingsSection() {
    switchAppView('settings');
    switchSettingsTab('courses');
    renderCoursesSettingsManager();
}

function updateCourseFormAvatarPreview() {
    const codeInput = document.getElementById('course-form-code-input');
    const nameInput = document.getElementById('course-form-name-input');
    const previewEl = document.getElementById('course-form-avatar-preview');
    if (!previewEl) return;

    let rawCode = (codeInput ? codeInput.value : '').trim().toUpperCase();
    if (!rawCode && nameInput && nameInput.value.trim()) {
        rawCode = nameInput.value.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
    }
    const displayCode = (rawCode || 'CS').slice(0, 2);
    const col = selectedCourseFormColor || '#5f5bf6';
    previewEl.innerText = displayCode;
    previewEl.style.background = `${col}22`;
    previewEl.style.color = col;
    previewEl.style.borderColor = `${col}66`;
}

function selectCourseFormColor(col) {
    selectedCourseFormColor = col;
    updateCourseFormAvatarPreview();
    renderCourseFormColorSwatches();
}

function renderCourseFormColorSwatches() {
    const container = document.getElementById('course-form-color-swatches');
    if (!container) return;
    container.innerHTML = COURSE_BADGE_COLORS.map(col => {
        const isSel = (selectedCourseFormColor.toLowerCase() === col.toLowerCase());
        return `
            <button type="button" onclick="selectCourseFormColor('${col}')"
                style="width:24px;height:24px;border-radius:8px;background:${col};border:${isSel ? '2px solid var(--v-fg)' : '1px solid rgba(255,255,255,0.2)'};transform:${isSel ? 'scale(1.12)' : 'scale(1)'};transition:all 0.15s ease;"
                title="Badge Color ${col}"></button>
        `;
    }).join('');
}

function resetCourseManagerForm() {
    editingCourseId = null;
    selectedCourseFormColor = COURSE_BADGE_COLORS[(window.appState.courses || []).length % COURSE_BADGE_COLORS.length] || '#5f5bf6';
    const codeInput = document.getElementById('course-form-code-input');
    const nameInput = document.getElementById('course-form-name-input');
    const headingEl = document.getElementById('course-form-heading');
    const submitBtn = document.getElementById('course-form-submit-btn');
    const cancelBtn = document.getElementById('course-form-cancel-btn');

    if (codeInput) codeInput.value = '';
    if (nameInput) nameInput.value = '';
    if (headingEl) headingEl.innerHTML = `<i class="fa-solid fa-graduation-cap" style="color:var(--v-accent)"></i><span>Add New Course</span>`;
    if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i><span>Add Course</span>`;
    if (cancelBtn) cancelBtn.classList.add('hidden');

    renderCourseFormColorSwatches();
    updateCourseFormAvatarPreview();
}

function startEditCourse(courseId) {
    const courses = window.appState.courses || [];
    const found = courses.find(c => c.id === courseId);
    if (!found) return;

    editingCourseId = courseId;
    selectedCourseFormColor = found.color || '#5f5bf6';

    const codeInput = document.getElementById('course-form-code-input');
    const nameInput = document.getElementById('course-form-name-input');
    const headingEl = document.getElementById('course-form-heading');
    const submitBtn = document.getElementById('course-form-submit-btn');
    const cancelBtn = document.getElementById('course-form-cancel-btn');

    if (codeInput) codeInput.value = (found.code || found.name.slice(0, 2)).slice(0, 2).toUpperCase();
    if (nameInput) nameInput.value = found.name;
    if (headingEl) headingEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color:var(--v-accent)"></i><span>Editing Course: ${escapeHtml(found.name)}</span>`;
    if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-check text-[10px]"></i><span>Update Course</span>`;
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    renderCourseFormColorSwatches();
    updateCourseFormAvatarPreview();
}

function deleteCourseById(courseId) {
    const courses = window.appState.courses || [];
    const target = courses.find(c => c.id === courseId);
    if (!target) return;

    window.appState.courses = courses.filter(c => c.id !== courseId);
    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
    if (currentTaskCourseFilter === target.name) {
        currentTaskCourseFilter = 'all';
    }
    if (editingCourseId === courseId) {
        resetCourseManagerForm();
    }
    saveState(true);
    window.updateUI();
    showNotification("Course Deleted", `Removed "${target.name}" from your active courses.`, "info");
}

function handleCourseManagerSubmit(e) {
    e.preventDefault();
    const codeInput = document.getElementById('course-form-code-input');
    const nameInput = document.getElementById('course-form-name-input');
    const name = (nameInput ? nameInput.value : '').trim();
    if (!name) return;

    let code = (codeInput ? codeInput.value : '').trim().toUpperCase();
    if (!code) {
        code = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
    } else {
        code = code.slice(0, 2).toUpperCase();
    }

    if (!Array.isArray(window.appState.courses)) window.appState.courses = [];

    if (editingCourseId) {
        const courseObj = window.appState.courses.find(c => c.id === editingCourseId);
        if (courseObj) {
            const oldName = courseObj.name;
            courseObj.name = name;
            courseObj.code = code;
            courseObj.color = selectedCourseFormColor || '#5f5bf6';
            // Update tasks linked to the old course name
            (window.appState.tasks || []).forEach(t => {
                if (t.course === oldName) t.course = name;
            });
            showNotification("Course Updated", `Updated "${name}" with 2-letter profile badge [${code}].`, "success");
        }
    } else {
        window.appState.courses.push({
            id: 'course-' + Date.now(),
            name,
            code,
            color: selectedCourseFormColor || '#5f5bf6'
        });
        showNotification("Course Added", `Added "${name}" with 2-letter profile badge [${code}]!`, "success");
    }

    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
    resetCourseManagerForm();
    saveState(true);
    window.updateUI();
}

function syncCoursesFromSubjectsString(subjectsStr) {
    const names = (subjectsStr || '').split(',').map(s => s.trim()).filter(Boolean);
    const existing = Array.isArray(window.appState.courses) ? window.appState.courses : [];
    window.appState.courses = names.map((nm, idx) => {
        const match = existing.find(c => c.name.toLowerCase() === nm.toLowerCase());
        if (match) return { ...match, name: nm };
        return {
            id: 'course-' + Date.now() + '-' + idx,
            name: nm,
            code: nm.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR',
            color: COURSE_BADGE_COLORS[idx % COURSE_BADGE_COLORS.length]
        };
    });
}

function updateAccountCourseFormAvatarPreview() {
    const codeInput = document.getElementById('account-course-code-input');
    const nameInput = document.getElementById('account-course-name-input');
    const previewEl = document.getElementById('account-course-avatar-preview');
    if (!previewEl) return;

    let rawCode = (codeInput ? codeInput.value : '').trim().toUpperCase();
    if (!rawCode && nameInput && nameInput.value.trim()) {
        rawCode = nameInput.value.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
    }
    const displayCode = (rawCode || 'CS').slice(0, 2);
    const col = selectedCourseFormColor || '#5f5bf6';
    previewEl.innerText = displayCode;
    previewEl.style.background = `${col}22`;
    previewEl.style.color = col;
    previewEl.style.borderColor = `${col}66`;
}

function renderAccountCourseColorSwatches() {
    const container = document.getElementById('account-course-color-swatches');
    if (!container) return;
    container.innerHTML = COURSE_BADGE_COLORS.map(col => {
        const isSel = (selectedCourseFormColor.toLowerCase() === col.toLowerCase());
        return `
            <button type="button" onclick="selectCourseFormColor('${col}'); renderAccountCourseColorSwatches(); updateAccountCourseFormAvatarPreview();"
                style="width:22px;height:22px;border-radius:7px;background:${col};border:${isSel ? '2px solid var(--v-fg)' : '1px solid rgba(255,255,255,0.2)'};transform:${isSel ? 'scale(1.12)' : 'scale(1)'};transition:all 0.15s ease;"
                title="Badge Color ${col}"></button>
        `;
    }).join('');
}

function startEditCourseFromAccount(courseId) {
    const courses = window.appState.courses || [];
    const found = courses.find(c => c.id === courseId);
    if (!found) return;

    editingCourseId = courseId;
    selectedCourseFormColor = found.color || '#5f5bf6';

    const codeInput = document.getElementById('account-course-code-input');
    const nameInput = document.getElementById('account-course-name-input');
    const submitBtn = document.getElementById('account-course-submit-btn');
    const cancelBtn = document.getElementById('account-course-cancel-btn');

    if (codeInput) codeInput.value = (found.code || found.name.slice(0, 2)).slice(0, 2).toUpperCase();
    if (nameInput) nameInput.value = found.name;
    if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-check text-[10px]"></i><span>Update Course</span>`;
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    renderAccountCourseColorSwatches();
    updateAccountCourseFormAvatarPreview();
}

function resetAccountCourseForm() {
    editingCourseId = null;
    const codeInput = document.getElementById('account-course-code-input');
    const nameInput = document.getElementById('account-course-name-input');
    const submitBtn = document.getElementById('account-course-submit-btn');
    const cancelBtn = document.getElementById('account-course-cancel-btn');

    if (codeInput) codeInput.value = '';
    if (nameInput) nameInput.value = '';
    if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-plus text-[10px]"></i><span>Save Course</span>`;
    if (cancelBtn) cancelBtn.classList.add('hidden');

    renderAccountCourseColorSwatches();
    updateAccountCourseFormAvatarPreview();
}

function handleAccountCourseSubmit(e) {
    e.preventDefault();
    const codeInput = document.getElementById('account-course-code-input');
    const nameInput = document.getElementById('account-course-name-input');
    const name = (nameInput ? nameInput.value : '').trim();
    if (!name) return;

    let code = (codeInput ? codeInput.value : '').trim().toUpperCase();
    if (!code) {
        code = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR';
    } else {
        code = code.slice(0, 2).toUpperCase();
    }

    if (!Array.isArray(window.appState.courses)) window.appState.courses = [];

    if (editingCourseId) {
        const courseObj = window.appState.courses.find(c => c.id === editingCourseId);
        if (courseObj) {
            const oldName = courseObj.name;
            courseObj.name = name;
            courseObj.code = code;
            courseObj.color = selectedCourseFormColor || '#5f5bf6';
            (window.appState.tasks || []).forEach(t => {
                if (t.course === oldName) t.course = name;
            });
            showNotification("Course Updated", `Updated "${name}" [${code}] in Account & Settings.`, "success");
        }
    } else {
        window.appState.courses.push({
            id: 'course-' + Date.now(),
            name,
            code,
            color: selectedCourseFormColor || '#5f5bf6'
        });
        showNotification("Course Added", `Added "${name}" [${code}] to Active Courses!`, "success");
    }

    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
    resetAccountCourseForm();
    resetCourseManagerForm();
    saveState(true);
    window.updateUI();
}

function renderCoursesSettingsManager() {
    renderCourseFormColorSwatches();
    updateCourseFormAvatarPreview();
    renderAccountCourseColorSwatches();
    updateAccountCourseFormAvatarPreview();

    const courses = (window.appState && Array.isArray(window.appState.courses)) ? window.appState.courses : [];

    ['settings-courses-count-badge', 'account-courses-count-badge'].forEach(badgeId => {
        const countBadge = document.getElementById(badgeId);
        if (countBadge) {
            countBadge.innerText = `${courses.length} Course${courses.length === 1 ? '' : 's'}`;
        }
    });

    const renderListInto = (listEl, isAccountView) => {
        if (!listEl) return;
        if (courses.length === 0) {
            listEl.innerHTML = `<p class="text-xs text-center py-6" style="color:var(--v-fg2)">No courses added yet. Use the form above to add your first course and 2-letter subject profile!</p>`;
            return;
        }
        listEl.innerHTML = courses.map(c => {
            const col = c.color || '#5f5bf6';
            const code = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
            const pendingCnt = getPendingTaskCountForCourse(c.name);
            const editFn = isAccountView ? `startEditCourseFromAccount('${c.id}')` : `startEditCourse('${c.id}')`;
            return `
                <div class="p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition" style="border-color:var(--v-bdr2);background:var(--v-bg2);">
                    <div class="flex items-center gap-3.5 min-w-0">
                        <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black uppercase shrink-0 shadow-sm" style="background:${col}24;color:${col};border:1.5px solid ${col}66;">
                            ${escapeHtml(code)}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate">${escapeHtml(c.name)}</h4>
                                <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border" style="border-color:var(--v-bdr3);background:var(--v-bg0);color:var(--v-fg2);">Badge: ${escapeHtml(code)}</span>
                            </div>
                            <p class="text-[11px] font-semibold mt-0.5" style="color:${pendingCnt > 0 ? col : 'var(--v-fg3)'}">
                                ${pendingCnt} pending task${pendingCnt === 1 ? '' : 's'} in Active Courses
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" onclick="${editFn}" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold border transition hover:opacity-90 flex items-center gap-1.5" style="border-color:var(--v-bdr3);background:var(--v-bg0);color:var(--v-fg);">
                            <i class="fa-solid fa-pen text-[10px]" style="color:var(--v-accent)"></i>
                            <span>Edit</span>
                        </button>
                        <button type="button" onclick="deleteCourseById('${c.id}')" class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition flex items-center gap-1">
                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    };

    renderListInto(document.getElementById('settings-courses-list'), false);
    renderListInto(document.getElementById('account-courses-list'), true);
}

