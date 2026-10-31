// ==========================================
// FocusPulse - Dedicated Habit Flow Section (habits.js)
// ==========================================

const HABIT_CATEGORIES = ['All', 'Health', 'Fitness', 'Productivity', 'Mindfulness', 'Learning'];
const HABIT_EMOJIS = ['💧', '📚', '💪', '⚡', '🧘', '🥗', '🏃', '🎸', '💻', '💤', '🎨', '🍵'];
const HABIT_COLOR_THEMES = {
    emerald: {
        bg: 'bg-emerald-500',
        lightBg: 'bg-emerald-500/15',
        border: 'border-emerald-500/30',
        text: 'text-emerald-600 dark:text-emerald-400',
        bar: 'from-emerald-500 to-teal-400'
    },
    blue: {
        bg: 'bg-blue-500',
        lightBg: 'bg-blue-500/15',
        border: 'border-blue-500/30',
        text: 'text-blue-600 dark:text-blue-400',
        bar: 'from-blue-500 to-cyan-400'
    },
    violet: {
        bg: 'bg-violet-500',
        lightBg: 'bg-violet-500/15',
        border: 'border-violet-500/30',
        text: 'text-violet-600 dark:text-violet-400',
        bar: 'from-violet-500 to-purple-400'
    },
    amber: {
        bg: 'bg-amber-500',
        lightBg: 'bg-amber-500/15',
        border: 'border-amber-500/30',
        text: 'text-amber-600 dark:text-amber-400',
        bar: 'from-amber-500 to-yellow-400'
    },
    rose: {
        bg: 'bg-rose-500',
        lightBg: 'bg-rose-500/15',
        border: 'border-rose-500/30',
        text: 'text-rose-600 dark:text-rose-400',
        bar: 'from-rose-500 to-pink-400'
    }
};

let habitWeekOffset = 0;
let selectedHabitCategory = 'All';
let selectedNewHabitEmoji = '💧';
let selectedNewHabitColor = 'emerald';
let habitPendingDeleteId = null;

function getHabitWeekDays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatDateKey(today);
    const startOfCurrentWeek = getStartOfWeek(today);
    const startOfSelectedWeek = addDays(startOfCurrentWeek, habitWeekOffset * 7);

    return Array.from({ length: 7 }, (_, i) => {
        const date = addDays(startOfSelectedWeek, i);
        const key = formatDateKey(date);
        return {
            date,
            key,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            dayNumber: date.getDate(),
            monthDay: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isToday: key === todayKey,
            isFuture: date > today
        };
    });
}

function calcHabitCurrentStreak(logs) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let checkDate = new Date(today);
    if (!logs || !logs[formatDateKey(checkDate)]) {
        checkDate = addDays(checkDate, -1);
    }
    while (logs && logs[formatDateKey(checkDate)]) {
        streak++;
        checkDate = addDays(checkDate, -1);
    }
    return streak;
}

function calcHabitBestStreak(logs, currentStreak) {
    if (!logs) return 0;
    const dates = Object.keys(logs).filter(k => logs[k]).sort();
    if (dates.length === 0) return 0;
    let maxStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1] + 'T00:00:00');
        const curr = new Date(dates[i] + 'T00:00:00');
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
            tempStreak++;
            if (tempStreak > maxStreak) maxStreak = tempStreak;
        } else if (diffDays > 1) {
            tempStreak = 1;
        }
    }
    return Math.max(maxStreak, currentStreak);
}

function toggleHabitDayCheck(habitId, dateKey, isFuture) {
    if (isFuture) {
        showNotification("Future Date", "Cannot log habit completion for future dates!", "warning");
        return;
    }
    const habit = (window.appState.habits || []).find(h => h.id === habitId);
    if (!habit) return;
    if (!habit.logs) habit.logs = {};
    if (habit.logs[dateKey]) {
        delete habit.logs[dateKey];
        showNotification("Habit Unmarked", `Unchecked "${habit.name}" for ${dateKey}.`, "info");
    } else {
        habit.logs[dateKey] = true;
        showNotification("Habit Logged!", `Great job completing "${habit.name}"!`, "habit");
    }
    saveState();
    window.updateUI();
}

function setHabitCategoryFilter(category) {
    selectedHabitCategory = category;
    renderHabitsSection();
}

function changeHabitWeekOffset(delta) {
    if (delta === 0) {
        habitWeekOffset = 0;
    } else {
        habitWeekOffset = Math.min(0, habitWeekOffset + delta);
    }
    renderHabitsSection();
}

function markAllHabitsToday() {
    const todayKey = formatDateKey(new Date());
    (window.appState.habits || []).forEach(h => {
        if (!h.logs) h.logs = {};
        h.logs[todayKey] = true;
    });
    saveState();
    window.updateUI();
    showNotification("All Habits Completed!", "Awesome! Every habit for today is marked complete.", "success");
}

function resetSampleHabitsData() {
    window.appState.habits = generateSampleHabits();
    habitWeekOffset = 0;
    selectedHabitCategory = 'All';
    saveState();
    window.updateUI();
    showNotification("Sample Habits Restored", "Habit tracker has been reset to sample routines.", "info");
}

function openAddHabitModal() {
    const modal = document.getElementById('habit-add-modal');
    if (!modal) return;
    document.getElementById('new-habit-name-input').value = '';
    document.getElementById('new-habit-target-input').value = 5;
    document.getElementById('new-habit-target-label').innerText = '5 days';
    selectedNewHabitEmoji = '💧';
    selectedNewHabitColor = 'emerald';
    renderHabitModalPickers();
    modal.classList.remove('hidden');
}

function closeAddHabitModal() {
    const modal = document.getElementById('habit-add-modal');
    if (modal) modal.classList.add('hidden');
}

function selectHabitEmoji(emoji) {
    selectedNewHabitEmoji = emoji;
    renderHabitModalPickers();
}

function selectHabitColor(color) {
    selectedNewHabitColor = color;
    renderHabitModalPickers();
}

function updateHabitTargetLabel(val) {
    const lbl = document.getElementById('new-habit-target-label');
    if (lbl) lbl.innerText = `${val} day${Number(val) > 1 ? 's' : ''}`;
}

function renderHabitModalPickers() {
    const emojiContainer = document.getElementById('habit-emoji-picker');
    if (emojiContainer) {
        emojiContainer.innerHTML = HABIT_EMOJIS.map(emoji => `
            <button type="button" onclick="selectHabitEmoji('${emoji}')" class="h-10 rounded-xl text-lg flex items-center justify-center border transition ${
                selectedNewHabitEmoji === emoji
                    ? 'border-indigo-500 bg-indigo-500/25 scale-105 shadow-sm'
                    : 'border-white/50 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-white/80'
            }">${emoji}</button>
        `).join('');
    }
    const colorContainer = document.getElementById('habit-color-picker');
    if (colorContainer) {
        colorContainer.innerHTML = Object.keys(HABIT_COLOR_THEMES).map(colorKey => {
            const theme = HABIT_COLOR_THEMES[colorKey];
            const isSelected = selectedNewHabitColor === colorKey;
            return `
                <button type="button" onclick="selectHabitColor('${colorKey}')" class="w-8 h-8 rounded-full ${theme.bg} flex items-center justify-center transition ${
                    isSelected ? 'ring-4 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-70 hover:opacity-100'
                }">
                    ${isSelected ? '<i class="fa-solid fa-check text-white text-xs"></i>' : ''}
                </button>
            `;
        }).join('');
    }
}

function handleAddHabitSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-habit-name-input');
    const catInput = document.getElementById('new-habit-category-input');
    const targetInput = document.getElementById('new-habit-target-input');
    const name = (nameInput ? nameInput.value : '').trim();
    if (!name) return;

    const newHabit = {
        id: 'h-' + Date.now(),
        name,
        category: catInput ? catInput.value : 'Health',
        color: selectedNewHabitColor,
        icon: selectedNewHabitEmoji,
        targetPerWeek: Number(targetInput ? targetInput.value : 5) || 5,
        logs: {}
    };
    if (!Array.isArray(window.appState.habits)) window.appState.habits = [];
    window.appState.habits.unshift(newHabit);
    saveState();
    closeAddHabitModal();
    renderHabitsSection();
    showNotification("Habit Created", `Added "${newHabit.name}" to your Habit Flow tracker!`, "success");
}

function promptDeleteHabit(habitId) {
    const habit = (window.appState.habits || []).find(h => h.id === habitId);
    if (!habit) return;
    habitPendingDeleteId = habitId;
    const titleEl = document.getElementById('delete-habit-modal-name');
    if (titleEl) titleEl.innerText = `Delete "${habit.name}"?`;
    const modal = document.getElementById('habit-delete-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeDeleteHabitModal() {
    habitPendingDeleteId = null;
    const modal = document.getElementById('habit-delete-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmDeleteHabitAction() {
    if (!habitPendingDeleteId) return;
    const habit = (window.appState.habits || []).find(h => h.id === habitPendingDeleteId);
    window.appState.habits = (window.appState.habits || []).filter(h => h.id !== habitPendingDeleteId);
    saveState();
    closeDeleteHabitModal();
    renderHabitsSection();
    if (habit) showNotification("Habit Removed", `Deleted "${habit.name}".`, "info");
}

function renderHabitsSection() {
    const habits = window.appState.habits || [];
    const weekDays = getHabitWeekDays();
    const todayKey = formatDateKey(new Date());

    const enriched = habits.map(h => {
        const logs = h.logs || {};
        const currentStreak = calcHabitCurrentStreak(logs);
        const bestStreak = calcHabitBestStreak(logs, currentStreak);
        const weeklyCompletions = weekDays.reduce((acc, d) => acc + (logs[d.key] ? 1 : 0), 0);
        const target = h.targetPerWeek || 5;
        const weeklyProgress = Math.min(100, Math.round((weeklyCompletions / target) * 100));
        return { ...h, logs, currentStreak, bestStreak, weeklyCompletions, targetPerWeek: target, weeklyProgress };
    });

    const filtered = selectedHabitCategory === 'All'
        ? enriched
        : enriched.filter(h => h.category === selectedHabitCategory);

    // KPI Calculations
    const totalHabits = enriched.length;
    const completedToday = enriched.filter(h => h.logs[todayKey]).length;
    const todayPercent = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
    const longestActiveStreak = totalHabits > 0 ? Math.max(0, ...enriched.map(h => h.currentStreak)) : 0;

    const dailyBreakdown = weekDays.map(day => {
        const count = enriched.filter(h => h.logs[day.key]).length;
        const percent = totalHabits > 0 ? Math.round((count / totalHabits) * 100) : 0;
        return { ...day, count, total: totalHabits, percent };
    });

    const totalCheckinsThisWeek = dailyBreakdown.reduce((sum, d) => sum + d.count, 0);
    const totalTargetThisWeek = enriched.reduce((sum, h) => sum + h.targetPerWeek, 0);
    const weeklyRate = totalTargetThisWeek > 0 ? Math.min(100, Math.round((totalCheckinsThisWeek / totalTargetThisWeek) * 100)) : 0;

    // Update KPI DOM
    const elTodayCount = document.getElementById('habit-kpi-today-count');
    const elTodayTotal = document.getElementById('habit-kpi-today-total');
    const elTodayPct = document.getElementById('habit-kpi-today-pct');
    const elTodayBar = document.getElementById('habit-kpi-today-bar');
    if (elTodayCount) elTodayCount.innerText = completedToday;
    if (elTodayTotal) elTodayTotal.innerText = `/ ${totalHabits} completed`;
    if (elTodayPct) elTodayPct.innerText = `${todayPercent}%`;
    if (elTodayBar) elTodayBar.style.width = `${todayPercent}%`;

    const elWeeklyRate = document.getElementById('habit-kpi-weekly-rate');
    const elWeeklyBar = document.getElementById('habit-kpi-weekly-bar');
    if (elWeeklyRate) elWeeklyRate.innerText = `${weeklyRate}%`;
    if (elWeeklyBar) elWeeklyBar.style.width = `${weeklyRate}%`;

    const elBestStreak = document.getElementById('habit-kpi-best-streak');
    if (elBestStreak) elBestStreak.innerText = longestActiveStreak;

    const elCheckins = document.getElementById('habit-kpi-checkins');
    const elDateRange = document.getElementById('habit-kpi-date-range');
    const elWeekLabel = document.getElementById('habit-week-range-label');
    const elChartRange = document.getElementById('habit-chart-range-badge');
    const rangeStr = `${weekDays[0].monthDay} – ${weekDays[6].monthDay}`;
    if (elCheckins) elCheckins.innerText = totalCheckinsThisWeek;
    if (elDateRange) elDateRange.innerText = rangeStr;
    if (elWeekLabel) elWeekLabel.innerText = rangeStr;
    if (elChartRange) elChartRange.innerText = rangeStr;

    const btnJumpToday = document.getElementById('habit-jump-today-btn');
    if (btnJumpToday) {
        if (habitWeekOffset !== 0) btnJumpToday.classList.remove('hidden');
        else btnJumpToday.classList.add('hidden');
    }

    // Category filter pills
    const catContainer = document.getElementById('habit-category-pills');
    if (catContainer) {
        catContainer.innerHTML = HABIT_CATEGORIES.map(cat => {
            const active = selectedHabitCategory === cat;
            return `<button onclick="setHabitCategoryFilter('${cat}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                active
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-white/50 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-white/80'
            }">${cat}</button>`;
        }).join('');
    }

    // Table Header Days
    const theadRow = document.getElementById('habit-table-header-row');
    if (theadRow) {
        theadRow.innerHTML = `
            <th class="py-3.5 pl-5 pr-3 w-64 text-left">Habit & Weekly Target</th>
            ${weekDays.map(day => `
                <th class="py-2.5 px-1.5 text-center w-14">
                    <div class="inline-flex flex-col items-center justify-center px-2 py-1 rounded-xl ${
                        day.isToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : ''
                    }">
                        <span class="text-[9px] font-bold uppercase tracking-wider opacity-80">${day.dayName}</span>
                        <span class="text-xs font-extrabold mt-0.5">${day.dayNumber}</span>
                    </div>
                </th>
            `).join('')}
            <th class="py-3.5 px-3 text-center w-24">Streak</th>
            <th class="py-3.5 px-3 text-center w-32">Weekly Goal</th>
            <th class="py-3.5 pl-2 pr-5 text-right w-12"></th>
        `;
    }

    // Table Body Rows
    const tbody = document.getElementById('habit-table-body');
    if (tbody) {
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="py-10 text-center">
                        <div class="max-w-xs mx-auto space-y-2">
                            <p class="text-sm font-bold text-slate-800 dark:text-white">No habits in this view</p>
                            <p class="text-xs text-slate-600 dark:text-slate-400">Add a daily habit or switch category filters to track your consistency.</p>
                            <button onclick="openAddHabitModal()" class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3.5 py-2 rounded-xl hover:bg-indigo-500 transition">
                                <i class="fa-solid fa-plus"></i> Add First Habit
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = filtered.map(habit => {
                const theme = HABIT_COLOR_THEMES[habit.color] || HABIT_COLOR_THEMES.emerald;
                const goalMet = habit.weeklyCompletions >= habit.targetPerWeek;
                return `
                    <tr id="habit-row-${habit.id}" class="group hover:bg-white/40 dark:hover:bg-white/5 transition border-b border-white/30 dark:border-white/10 last:border-b-0">
                        <td class="py-3.5 pl-5 pr-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${theme.lightBg} ${theme.border}">
                                    ${habit.icon || '⚡'}
                                </div>
                                <div class="min-w-0">
                                    <p class="font-bold text-xs text-slate-900 dark:text-white truncate">${escapeHtml(habit.name)}</p>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/60 dark:bg-white/10 text-slate-700 dark:text-slate-300">${escapeHtml(habit.category)}</span>
                                        <span class="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Target: ${habit.targetPerWeek}d/wk</span>
                                    </div>
                                </div>
                            </div>
                        </td>
                        ${weekDays.map(day => {
                            const isCompleted = !!habit.logs[day.key];
                            return `
                                <td class="py-2.5 px-1.5 text-center">
                                    <button onclick="toggleHabitDayCheck('${habit.id}', '${day.key}', ${day.isFuture})"
                                        ${day.isFuture ? 'disabled' : ''}
                                        title="Mark ${escapeHtml(habit.name)} for ${day.dayName} (${day.key})"
                                        class="w-9 h-9 rounded-xl inline-flex items-center justify-center transition-all duration-200 ${
                                            day.isFuture
                                                ? 'bg-slate-200/40 dark:bg-white/5 border border-white/20 opacity-30 cursor-not-allowed'
                                                : isCompleted
                                                ? `${theme.bg} text-white shadow-md scale-100 hover:opacity-90 active:scale-90`
                                                : 'bg-white/70 dark:bg-white/10 border border-slate-300/70 dark:border-white/15 text-transparent hover:border-indigo-400 active:scale-95'
                                        }">
                                        <i class="fa-solid fa-check text-xs transition-transform ${isCompleted ? 'scale-100' : 'scale-0'}"></i>
                                    </button>
                                </td>
                            `;
                        }).join('')}
                        <td class="py-3.5 px-3 text-center">
                            <div class="inline-flex flex-col items-center">
                                <div class="flex items-center gap-1 font-extrabold text-xs ${habit.currentStreak > 0 ? 'text-amber-500' : 'text-slate-400'}">
                                    <i class="fa-solid fa-fire"></i>
                                    <span>${habit.currentStreak}d</span>
                                </div>
                                <span class="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">Best: ${habit.bestStreak}d</span>
                            </div>
                        </td>
                        <td class="py-3.5 px-3">
                            <div class="flex flex-col gap-1">
                                <div class="flex items-center justify-between text-[11px]">
                                    <span class="font-bold text-slate-800 dark:text-slate-200">${habit.weeklyCompletions}/${habit.targetPerWeek}</span>
                                    <span class="font-extrabold ${goalMet ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}">${habit.weeklyProgress}%</span>
                                </div>
                                <div class="w-full h-2 rounded-full overflow-hidden bg-white/60 dark:bg-white/10">
                                    <div class="h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-300" style="width: ${habit.weeklyProgress}%"></div>
                                </div>
                            </div>
                        </td>
                        <td class="py-3.5 pl-2 pr-5 text-right">
                            <button onclick="promptDeleteHabit('${habit.id}')" class="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition" title="Delete Habit">
                                <i class="fa-solid fa-trash-can text-xs"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Weekly Bar Chart
    const chartContainer = document.getElementById('habit-weekly-bar-chart');
    if (chartContainer) {
        chartContainer.innerHTML = dailyBreakdown.map(day => {
            const isPerfect = day.percent === 100 && day.total > 0;
            return `
                <div class="flex flex-col items-center h-full justify-end">
                    <div class="text-[11px] font-extrabold mb-1.5 ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}">${day.percent}%</div>
                    <div class="w-full max-w-[42px] h-32 rounded-2xl p-1 flex items-end bg-white/60 dark:bg-white/10 overflow-hidden shadow-inner">
                        <div class="w-full rounded-xl transition-all duration-500 ${
                            isPerfect
                                ? 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-md'
                                : day.isToday
                                ? 'bg-gradient-to-t from-indigo-600 to-violet-400'
                                : 'bg-gradient-to-t from-indigo-500/65 to-indigo-400/75'
                        }" style="height: ${Math.max(day.percent, 8)}%"></div>
                    </div>
                    <div class="mt-2 text-center">
                        <p class="text-[11px] font-bold ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}">${day.dayName}</p>
                        <p class="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">${day.count}/${day.total}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Streak Leaderboard
    const leaderboardEl = document.getElementById('habit-streak-leaderboard');
    if (leaderboardEl) {
        const sorted = [...enriched].sort((a, b) => b.currentStreak - a.currentStreak).slice(0, 5);
        if (sorted.length === 0) {
            leaderboardEl.innerHTML = `<p class="text-xs text-slate-500 text-center py-4">Add habits to see your streak leaderboard.</p>`;
        } else {
            leaderboardEl.innerHTML = sorted.map(habit => {
                const theme = HABIT_COLOR_THEMES[habit.color] || HABIT_COLOR_THEMES.emerald;
                const ratio = habit.bestStreak > 0 ? Math.min(100, Math.round((habit.currentStreak / habit.bestStreak) * 100)) : 0;
                return `
                    <div class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                            <span class="font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate pr-2">
                                <span>${habit.icon || '⚡'}</span>
                                <span class="truncate">${escapeHtml(habit.name)}</span>
                            </span>
                            <span class="font-extrabold text-amber-500 shrink-0 flex items-center gap-1">
                                <i class="fa-solid fa-fire"></i> ${habit.currentStreak}d
                            </span>
                        </div>
                        <div class="w-full h-2 rounded-full overflow-hidden bg-white/60 dark:bg-white/10">
                            <div class="h-full rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-500" style="width: ${Math.max(ratio, 8)}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                            <span>Active chain: ${habit.currentStreak}d</span>
                            <span>Personal record: ${habit.bestStreak}d</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}
