// ==========================================
// FocusPulse - State, Theme, Avatar & Storage Engine (state.js)
// ==========================================

function formatDateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Color Manipulation Utilities
function lightenColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return '#141212';
    const clean = hex.replace('#', '').trim();
    if (clean.length !== 6) return '#141212';
    const num = parseInt(clean, 16);
    if (isNaN(num)) return '#141212';
    const amt = Math.round(2.55 * percent);
    const r = (num >> 16) + amt;
    const g = ((num >> 8) & 0x00FF) + amt;
    const b = (num & 0x0000FF) + amt;
    return "#" + (
        0x1000000 +
        (r < 255 ? (r < 0 ? 0 : r) : 255) * 0x10000 +
        (g < 255 ? (g < 0 ? 0 : g) : 255) * 0x100 +
        (b < 255 ? (b < 0 ? 0 : b) : 255)
    ).toString(16).slice(1);
}

function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return "95, 91, 246";
    let cleaned = hex.replace('#', '').trim();
    if (cleaned.length === 3) {
        cleaned = cleaned.split('').map(c => c + c).join('');
    }
    if (cleaned.length !== 6) return "95, 91, 246";
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "95, 91, 246";
    return `${r}, ${g}, ${b}`;
}

function isHexLight(hex) {
    if (!hex || typeof hex !== 'string') return false;
    let cleaned = hex.replace('#', '').trim();
    if (cleaned.length === 3) cleaned = cleaned.split('').map(c => c + c).join('');
    if (cleaned.length !== 6) return false;
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.65;
}

const FP_THEMES = [
    { id: 'obsidian',  name: 'Obsidian',       desc: 'Deep carbon & slate',  bg: '#0c0b0b', cardBg: '#171515', lightBg: '#ffffff', lightCard: '#f8fafc', accent: '#64748b' },
    { id: 'midnight',  name: 'Midnight Navy',  desc: 'Deep navy & indigo',   bg: '#05070e', cardBg: '#0d1222', lightBg: '#f8faff', lightCard: '#eef2ff', accent: '#4f46e5' },
    { id: 'forest',    name: 'Forest Emerald', desc: 'Moss & emerald tones', bg: '#040806', cardBg: '#0b1510', lightBg: '#f7fdfa', lightCard: '#ecfdf5', accent: '#10b981' },
    { id: 'cyberpunk', name: 'Cyberpunk',      desc: 'Vibrant neon purple',  bg: '#0a0112', cardBg: '#1b032d', lightBg: '#fdfaff', lightCard: '#fae8ff', accent: '#d946ef' },
    { id: 'sunset',    name: 'Sunset Crimson', desc: 'Warm crimson tones',   bg: '#0a0505', cardBg: '#1b0c0c', lightBg: '#fffafa', lightCard: '#fef2f2', accent: '#ef4444' },
    { id: 'pureblack', name: 'Pure Black',     desc: 'OLED pitch black',     bg: '#000000', cardBg: '#0a0a0a', lightBg: '#ffffff', lightCard: '#f8fafc', accent: '#0f172a' },
    { id: 'purewhite', name: 'Pure White',     desc: 'Crisp white surface',  bg: '#ffffff', cardBg: '#f8fafc', lightBg: '#ffffff', lightCard: '#f8fafc', accent: '#4f46e5' }
];

const FP_ACCENTS = [
    { value: '#e2ddd9', lightValue: '#334155', label: 'Silver / Slate' },
    { value: '#5f5bf6', lightValue: '#4f46e5', label: 'Indigo' },
    { value: '#8b5cf6', lightValue: '#7c3aed', label: 'Violet' },
    { value: '#10b981', lightValue: '#059669', label: 'Emerald' },
    { value: '#d946ef', lightValue: '#c026d3', label: 'Magenta' },
    { value: '#f97316', lightValue: '#ea580c', label: 'Orange' },
    { value: '#ef4444', lightValue: '#dc2626', label: 'Crimson' },
    { value: '#06b6d4', lightValue: '#0891b2', label: 'Cyan' },
    { value: '#eab308', lightValue: '#ca8a04', label: 'Gold' }
];

// Built-in SVG Preset Profile Avatars for instant 1-tap selection alongside custom photo uploads
function createPresetAvatarSvgDataUrl(bg1, bg2, emojiText) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
        <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${bg1}"/>
                <stop offset="100%" stop-color="${bg2}"/>
            </linearGradient>
        </defs>
        <rect width="160" height="160" rx="80" fill="url(#g)"/>
        <circle cx="80" cy="80" r="74" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>
        <text x="80" y="98" font-size="68" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emojiText}</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const FP_PRESET_AVATARS = [
    { id: 'astronaut', label: 'Astronaut', emoji: '🧑‍🚀', dataUrl: createPresetAvatarSvgDataUrl('#5f5bf6', '#312e81', '🧑‍🚀') },
    { id: 'scholar',   label: 'Scholar',   emoji: '🎓', dataUrl: createPresetAvatarSvgDataUrl('#8b5cf6', '#4c1d95', '🎓') },
    { id: 'coder',     label: 'Developer', emoji: '💻', dataUrl: createPresetAvatarSvgDataUrl('#10b981', '#064e3b', '💻') },
    { id: 'rocket',    label: 'Rocket',    emoji: '🚀', dataUrl: createPresetAvatarSvgDataUrl('#06b6d4', '#164e63', '🚀') },
    { id: 'spark',     label: 'Lightning', emoji: '⚡', dataUrl: createPresetAvatarSvgDataUrl('#f59e0b', '#78350f', '⚡') },
    { id: 'zen',       label: 'Zen Lotus', emoji: '🧘', dataUrl: createPresetAvatarSvgDataUrl('#ec4899', '#831843', '🧘') }
];
window.FP_PRESET_AVATARS = FP_PRESET_AVATARS;

function getDefaultCourses() {
    // New users start with no courses pre-selected by default
    return [];
}

function generateSampleHabits() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const createLogs = (patternDaysAgo) => {
        const logs = {};
        patternDaysAgo.forEach(daysAgo => {
            const d = addDays(today, -daysAgo);
            logs[formatDateKey(d)] = true;
        });
        return logs;
    };
    return [
        {
            id: 'h-1',
            name: 'Morning Hydration (500ml)',
            category: 'Health',
            color: 'blue',
            icon: '💧',
            targetPerWeek: 7,
            logs: createLogs([0, 1, 2, 3, 4, 5, 6, 8, 9, 10])
        },
        {
            id: 'h-2',
            name: 'Read 20 Pages of Textbook',
            category: 'Learning',
            color: 'violet',
            icon: '📚',
            targetPerWeek: 5,
            logs: createLogs([1, 2, 4, 5, 7, 8])
        },
        {
            id: 'h-3',
            name: '45m Strength / Cardio',
            category: 'Fitness',
            color: 'emerald',
            icon: '💪',
            targetPerWeek: 4,
            logs: createLogs([0, 2, 4, 6, 8])
        },
        {
            id: 'h-4',
            name: 'Deep Work Session (No Phone)',
            category: 'Productivity',
            color: 'amber',
            icon: '⚡',
            targetPerWeek: 5,
            logs: createLogs([1, 2, 3, 4, 7, 8])
        },
        {
            id: 'h-5',
            name: '10m Evening Mindfulness',
            category: 'Mindfulness',
            color: 'rose',
            icon: '🧘',
            targetPerWeek: 7,
            logs: createLogs([1, 2, 3, 5, 6, 7])
        }
    ];
}

function generateSampleTaskHistory() {
    return [];
}

window.appState = {
    updatedAt: Date.now(),
    activeSection: 'home',
    // Startup, Authentication & Onboarding State Machine
    hasCompletedOnboarding: false,
    onboardingStep: 'welcome',
    userType: null, // 'guest' | 'authenticated' | null
    authUid: null,
    authEmail: '',
    waterRemindersEnabled: true,
    studyPlanEnabled: true,
    inAppPopupsEnabled: true,
    notificationsEnabled: true,
    soundEnabled: true,
    notificationPreference: 'enabled', // 'enabled' | 'later' | 'disabled'
    notificationChannels: {
        pomodoro: true,
        tasks: true,
        habits: true,
        hydration: true
    },
    onboardingSummary: {
        nameSet: false,
        coursesAdded: [],
        tasksAdded: [],
        habitsAdded: [],
        waterConfigured: true,
        studyPlanConfigured: true,
        notificationsConfigured: true
    },
    theme: 'dark',
    solidTheme: 'obsidian',
    accentColor: '#5f5bf6',
    logoColorMode: 'badge',
    customLogoDataUrl: '',
    customLogoInvert: false,
    customBgColor: '#0c0b0b',
    performanceMode: false,
    uiScale: 0,
    liquidEffect: false,
    showStreak: true,
    geminiApiKey: '',
    autoCheckUpdates: true,
    exeRunAtStartup: false,
    exeCloseToTray: true,
    installedVersion: 'v1.0',
    latestVersion: 'v1.0',
    githubUrl: 'https://github.com/foc-it',
    creatorGithubUrl: 'https://github.com/azmee7',
    contactEmail: 'info.focit@gmail.com',
    githubRepo: 'foc-it/focuspulse',
    user: { name: 'Guest', subjects: '', isCustomName: false, avatarDataUrl: '' },
    courses: [],
    waterIntakeMl: 750,
    dailyWaterGoalMl: 2500,
    glassSizeMl: 250,
    waterReminderIntervalMin: 90,
    lastWaterReminderAt: Date.now(),
    streakCount: 3,
    previousStreakCount: 0,
    lastActiveDate: null,
    lastCreditedStreakDate: null,
    streakRestoredThisWeek: false,
    categories: ['Studies', 'Fitness', 'Health', 'Personal'],
    subcategories: {
        'Studies': ['General', 'Exams', 'Assignments'],
        'Fitness': ['Cardio', 'Strength'],
        'Health': ['Hydration', 'Sleep'],
        'Personal': ['Reading', 'Projects']
    },
    schedules: [
        { id: '1', presetName: 'Balanced Weekdays', hours: 3, sessions: 3, days: 'Mon, Tue, Wed, Thu, Fri' },
        { id: '2', presetName: 'Weekend Deep Review', hours: 4, sessions: 4, days: 'Sat, Sun' }
    ],
    tasks: [
        {
            id: '1',
            title: "Plan today's top priorities",
            category: 'Personal',
            subcategory: 'Projects',
            course: '',
            dueDate: formatDateKey(new Date()),
            description: 'Review upcoming deadlines and schedule a focus session before evening.',
            completed: false,
            completedAt: null
        }
    ],
    taskHistory: [],
    habits: generateSampleHabits(),
    timerSettings: { pomodoro: 25, short: 5, long: 15, sessionsTotal: 4 },
    timer: { mode: 'pomodoro', secondsLeft: 25 * 60, isRunning: false, targetEndTimeMs: null, lastTickTimestampMs: null, sessionCount: 1, totalFocusSecs: 3600 }
};

// Profile Picture / Avatar Management Helpers
window.setProfileAvatar = function(dataUrl, silent = false) {
    if (!window.appState) return;
    if (!window.appState.user) {
        window.appState.user = { name: 'Guest', subjects: '', isCustomName: false, avatarDataUrl: '' };
    }
    window.appState.user.avatarDataUrl = dataUrl || '';
    try {
        if (dataUrl) {
            localStorage.setItem('focuspulse_guest_avatar', dataUrl);
        } else {
            localStorage.removeItem('focuspulse_guest_avatar');
        }
        localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));
    } catch (e) {}

    saveState(true);
    if (typeof window.firebaseUpdateProfileAvatar === 'function') {
        window.firebaseUpdateProfileAvatar(dataUrl || '');
    }
    if (typeof window.updateUI === 'function') {
        window.updateUI();
    }
    if (typeof window.refreshOnboardingStepAAvatarUI === 'function') {
        window.refreshOnboardingStepAAvatarUI();
    }
    if (!silent && typeof showNotification === 'function') {
        if (dataUrl) {
            showNotification("Profile Picture Saved 📸", "Your profile picture has been updated and synced.", "success");
        } else {
            showNotification("Profile Picture Removed", "Reverted to your 2-letter initials badge.", "info");
        }
    }
};

window.clearProfileAvatar = function() {
    window.setProfileAvatar('', false);
};

window.triggerProfileAvatarFilePicker = function() {
    const fileInput = document.getElementById('profile-avatar-file-input');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
};

window.handleProfileAvatarUpload = function(event) {
    const file = event && event.target && event.target.files ? event.target.files[0] : null;
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
        if (typeof showNotification === 'function') {
            showNotification("Invalid File Type", "Please select a valid image file (PNG, JPG, WEBP, or GIF).", "warning");
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = function(loadEvt) {
        const rawDataUrl = loadEvt.target ? loadEvt.target.result : '';
        if (!rawDataUrl) return;
        const img = new Image();
        img.onload = function() {
            try {
                const targetSize = 160;
                const canvas = document.createElement('canvas');
                canvas.width = targetSize;
                canvas.height = targetSize;
                const ctx = canvas.getContext('2d');
                // Center-crop square
                const minSide = Math.min(img.width, img.height);
                const sx = Math.max(0, (img.width - minSide) / 2);
                const sy = Math.max(0, (img.height - minSide) / 2);
                ctx.clearRect(0, 0, targetSize, targetSize);
                ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, targetSize, targetSize);
                const compressed = canvas.toDataURL('image/jpeg', 0.86);
                window.setProfileAvatar(compressed, false);
            } catch (err) {
                window.setProfileAvatar(rawDataUrl, false);
            }
        };
        img.onerror = function() {
            window.setProfileAvatar(rawDataUrl, false);
        };
        img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    if (event.target) event.target.value = '';
};

// Automatically move tasks that have remained completed for >= 24 hours into taskHistory
function sweepCompletedTasksToHistory() {
    if (!window.appState || !Array.isArray(window.appState.tasks)) return false;
    if (!Array.isArray(window.appState.taskHistory)) {
        window.appState.taskHistory = [];
    }
    const now = Date.now();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
    const remainingTasks = [];
    let movedCount = 0;

    window.appState.tasks.forEach(task => {
        if (task.completed) {
            if (!task.completedAt) {
                task.completedAt = now;
            }
            if (now - task.completedAt >= TWENTY_FOUR_HOURS_MS) {
                window.appState.taskHistory.unshift({
                    ...task,
                    archivedAt: now
                });
                movedCount++;
                return;
            }
        } else {
            task.completedAt = null;
        }
        remainingTasks.push(task);
    });

    if (movedCount > 0) {
        window.appState.tasks = remainingTasks;
        saveState();
        if (typeof showNotification === 'function') {
            showNotification(
                "Task Archived to History",
                `${movedCount} completed task${movedCount > 1 ? 's' : ''} (24h+) moved to Task History.`,
                "info"
            );
        }
        return true;
    }
    return false;
}

function applyThemeVariables() {
    const sTheme = window.appState.solidTheme || 'obsidian';
    let accent = window.appState.accentColor || '#5f5bf6';
    const customBg = window.appState.customBgColor || '#0c0b0b';

    // Determine whether White / Light Surface Mode is active
    const isLightSurface = (window.appState.theme === 'light') || (sTheme === 'purewhite') || (sTheme === 'custom' && isHexLight(customBg));

    document.documentElement.setAttribute('data-theme', sTheme);
    document.documentElement.setAttribute('data-surface', isLightSurface ? 'light' : 'dark');

    if (isLightSurface) {
        document.documentElement.classList.remove('dark');
        if (isHexLight(accent)) {
            const themeObj = FP_THEMES.find(t => t.id === sTheme);
            accent = (themeObj && !isHexLight(themeObj.accent)) ? themeObj.accent : '#334155';
        }
    } else {
        document.documentElement.classList.add('dark');
    }

    const customProps = [
        '--v-bg0', '--v-bg0-rgb', '--v-bg1', '--v-bg2', '--v-bg2-rgb',
        '--v-bg3', '--v-bg4', '--v-bg5', '--v-fg', '--v-fg2', '--v-fg3',
        '--v-bdr', '--v-bdr2', '--v-bdr3'
    ];

    if (sTheme === 'custom') {
        const bgBase = isLightSurface && !isHexLight(customBg) ? lightenColor(customBg, 82) : customBg;
        const lightSurface = isHexLight(bgBase);
        const step = lightSurface ? -3 : 2;
        const bg0 = bgBase;
        const bg0Rgb = hexToRgb(bg0);
        const bg1 = lightenColor(bg0, step);
        const bg2 = lightenColor(bg0, step * 2);
        const bg2Rgb = hexToRgb(bg2);
        const bg3 = lightenColor(bg0, step * 3);
        const bg4 = lightenColor(bg0, step * 4);
        const bg5 = lightenColor(bg0, step * 5);
        const bdr = lightenColor(bg0, step * 2.5);
        const bdr2 = lightenColor(bg0, step * 4);
        const bdr3 = lightenColor(bg0, step * 6);

        document.documentElement.style.setProperty('--v-bg0', bg0);
        document.documentElement.style.setProperty('--v-bg0-rgb', bg0Rgb);
        document.documentElement.style.setProperty('--v-bg1', bg1);
        document.documentElement.style.setProperty('--v-bg2', bg2);
        document.documentElement.style.setProperty('--v-bg2-rgb', bg2Rgb);
        document.documentElement.style.setProperty('--v-bg3', bg3);
        document.documentElement.style.setProperty('--v-bg4', bg4);
        document.documentElement.style.setProperty('--v-bg5', bg5);
        document.documentElement.style.setProperty('--v-bdr', bdr);
        document.documentElement.style.setProperty('--v-bdr2', bdr2);
        document.documentElement.style.setProperty('--v-bdr3', bdr3);
        document.documentElement.style.setProperty('--v-fg', lightSurface ? '#0f172a' : '#dedad7');
        document.documentElement.style.setProperty('--v-fg2', lightSurface ? '#475569' : '#9c9794');
        document.documentElement.style.setProperty('--v-fg3', lightSurface ? '#64748b' : '#6f6966');
    } else {
        customProps.forEach(p => document.documentElement.style.removeProperty(p));
    }

    document.documentElement.style.setProperty('--v-accent', accent);
    document.documentElement.style.setProperty('--v-accent-rgb', hexToRgb(accent));
    document.documentElement.style.setProperty('--v-accent-fg', isHexLight(accent) ? '#0c0b0b' : '#ffffff');
    updateDynamicLogoAccent(accent, isHexLight(accent) ? '#0c0b0b' : '#ffffff');

    const isPerf = Boolean(window.appState.performanceMode);
    if (isPerf) {
        document.documentElement.classList.add('v-perf-mode');
        document.documentElement.setAttribute('data-perf-mode', 'on');
    } else {
        document.documentElement.classList.remove('v-perf-mode');
        document.documentElement.setAttribute('data-perf-mode', 'off');
    }

    const scale = Math.max(-5, Math.min(5, Number(window.appState.uiScale) || 0));
    window.appState.uiScale = scale;
    const scalePct = 100 + (scale * 5);
    const scaleFactor = Number((scalePct / 100).toFixed(2));
    document.documentElement.style.fontSize = `${scalePct}%`;
    document.documentElement.style.setProperty('--fp-ui-scale', String(scaleFactor));
    document.documentElement.setAttribute('data-ui-scale', String(scale));
    const mainGrid = document.getElementById('main-focus-grid');
    if (mainGrid) {
        mainGrid.style.fontSize = '';
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem('focuspulse_launch_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            window.appState = {
                ...window.appState,
                ...parsed,
                user: { ...window.appState.user, ...(parsed.user || {}) },
                timerSettings: { ...window.appState.timerSettings, ...(parsed.timerSettings || {}) },
                timer: { ...window.appState.timer, ...(parsed.timer || {}) },
                notificationChannels: {
                    pomodoro: true,
                    tasks: true,
                    habits: true,
                    hydration: true,
                    ...(parsed.notificationChannels || {})
                },
                onboardingSummary: {
                    ...window.appState.onboardingSummary,
                    ...(parsed.onboardingSummary || {})
                }
            };
            if (typeof parsed.hasCompletedOnboarding === 'boolean') {
                window.appState.hasCompletedOnboarding = parsed.hasCompletedOnboarding;
            }
            if (!Array.isArray(window.appState.habits) || window.appState.habits.length === 0) {
                window.appState.habits = generateSampleHabits();
            }
            if (!Array.isArray(window.appState.taskHistory)) {
                window.appState.taskHistory = [];
            }
            // Always open to Home (Dashboard) on application startup (never restore last closed section)
            window.appState.activeSection = 'home';
        }
        const savedCustomUser = localStorage.getItem('focuspulse_custom_user');
        if (savedCustomUser) {
            const customUser = JSON.parse(savedCustomUser);
            if (customUser && customUser.name && customUser.name !== 'Student Scholar') {
                window.appState.user.name = customUser.name;
                if (typeof customUser.subjects === 'string') {
                    window.appState.user.subjects = customUser.subjects;
                }
                if (customUser.avatarDataUrl && !window.appState.user.avatarDataUrl) {
                    window.appState.user.avatarDataUrl = customUser.avatarDataUrl;
                }
                window.appState.user.isCustomName = true;
            }
        }
        const savedGuestName = (localStorage.getItem('focuspulse_guest_name') || localStorage.getItem('focuspulse_guest_profile_name') || '').trim();
        if (savedGuestName && savedGuestName !== 'Student Scholar' && savedGuestName !== 'Guest') {
            window.appState.user.name = savedGuestName;
            window.appState.user.isCustomName = true;
        }
        const savedGuestAvatar = localStorage.getItem('focuspulse_guest_avatar') || '';
        if (savedGuestAvatar && !window.appState.user.avatarDataUrl) {
            window.appState.user.avatarDataUrl = savedGuestAvatar;
        }
        const obKey = window.appState.authUid ? `focuspulse_onboarding_${window.appState.authUid}` : 'focuspulse_onboarding_local';
        const savedOb = localStorage.getItem(obKey);
        if (savedOb) {
            const obData = JSON.parse(savedOb);
            if (typeof obData.hasCompletedOnboarding === 'boolean') {
                window.appState.hasCompletedOnboarding = obData.hasCompletedOnboarding;
            }
            if (obData.onboardingStep) {
                window.appState.onboardingStep = obData.onboardingStep;
            }
            if (obData.userType) {
                window.appState.userType = obData.userType;
            }
        }
    } catch (e) {}

    // Ensure defaults for sound, popups, water, and study plans
    if (typeof window.appState.soundEnabled !== 'boolean') window.appState.soundEnabled = true;
    if (typeof window.appState.inAppPopupsEnabled !== 'boolean') window.appState.inAppPopupsEnabled = true;
    if (typeof window.appState.notificationsEnabled !== 'boolean') window.appState.notificationsEnabled = true;
    if (typeof window.appState.waterRemindersEnabled !== 'boolean') window.appState.waterRemindersEnabled = true;
    if (typeof window.appState.studyPlanEnabled !== 'boolean') window.appState.studyPlanEnabled = true;
    if (!window.appState.notificationChannels) {
        window.appState.notificationChannels = { pomodoro: true, tasks: true, habits: true, hydration: true };
    }
    if (!window.appState.user) {
        window.appState.user = { name: 'Guest', subjects: '', isCustomName: false, avatarDataUrl: '' };
    }
    if (typeof window.appState.user.avatarDataUrl !== 'string') {
        window.appState.user.avatarDataUrl = '';
    }

    if (!window.appState.installedVersion || window.appState.installedVersion.startsWith('v0.')) {
        window.appState.installedVersion = 'v1.0';
    }
    if (!window.appState.latestVersion || window.appState.latestVersion.startsWith('v0.')) {
        window.appState.latestVersion = 'v1.0';
    }
    window.appState.githubUrl = 'https://github.com/foc-it';
    window.appState.creatorGithubUrl = 'https://github.com/azmee7';
    window.appState.contactEmail = 'info.focit@gmail.com';
    window.appState.githubRepo = 'foc-it/focuspulse';
    if (!window.appState.solidTheme) window.appState.solidTheme = 'obsidian';
    if (!window.appState.accentColor) window.appState.accentColor = '#5f5bf6';
    if (!window.appState.customBgColor) window.appState.customBgColor = '#0c0b0b';
    if (!window.appState.geminiApiKey) {
        window.appState.geminiApiKey = (window.FP_PRIVATE_CONFIG && window.FP_PRIVATE_CONFIG.geminiApiKey) || '';
    }

    // Do NOT select any default courses for new users — keep courses empty unless explicitly added
    if (!Array.isArray(window.appState.courses)) {
        window.appState.courses = [];
    }
    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');

    if (Array.isArray(window.appState.tasks)) {
        window.appState.tasks.forEach(t => {
            if (t.category === 'Studies' && !t.course) {
                const lowerTitle = (t.title || '').toLowerCase();
                const matched = (window.appState.courses || []).find(c => lowerTitle.includes(c.name.toLowerCase()));
                if (matched) t.course = matched.name;
                else if (window.appState.courses[0]) t.course = window.appState.courses[0].name;
            }
        });
    }
    sweepCompletedTasksToHistory();
    applyLiquidGlass(window.appState.liquidEffect === true);
    applyThemeVariables();
    if (typeof syncExeDesktopBridge === 'function') syncExeDesktopBridge();
    const toggle = document.getElementById('streak-toggle-input');
    if (toggle) toggle.checked = window.appState.showStreak !== false;
    toggleStreakBadgeVisibility(window.appState.showStreak !== false);
}

function saveState(immediateCloudSync = false) {
    window.appState.updatedAt = Date.now();
    try {
        if (window.appState.user) {
            if (
                window.appState.user.name &&
                window.appState.user.name.trim() &&
                window.appState.user.name.trim() !== 'Guest' &&
                window.appState.user.name.trim() !== 'Student Scholar'
            ) {
                window.appState.user.isCustomName = true;
                localStorage.setItem('focuspulse_guest_name', window.appState.user.name.trim());
                localStorage.setItem('focuspulse_guest_profile_name', window.appState.user.name.trim());
            }
            if (window.appState.user.avatarDataUrl) {
                localStorage.setItem('focuspulse_guest_avatar', window.appState.user.avatarDataUrl);
            }
            localStorage.setItem('focuspulse_custom_user', JSON.stringify(window.appState.user));
        }
        localStorage.setItem('focuspulse_launch_state', JSON.stringify(window.appState));
        const obKey = window.appState.authUid ? `focuspulse_onboarding_${window.appState.authUid}` : 'focuspulse_onboarding_local';
        localStorage.setItem(obKey, JSON.stringify({
            hasCompletedOnboarding: Boolean(window.appState.hasCompletedOnboarding),
            onboardingStep: window.appState.onboardingStep || 'welcome',
            userType: window.appState.userType || null,
            updatedAt: window.appState.updatedAt
        }));
        // Per-account local backup snapshot for instant restore on re-login
        if (window.appState.userType === 'authenticated' && window.appState.authEmail) {
            const emailKey = window.appState.authEmail.trim().toLowerCase();
            localStorage.setItem(`focuspulse_account_cache_${emailKey}`, JSON.stringify(window.appState));
        }
        if (window.appState.userType === 'authenticated' && window.appState.authUid) {
            localStorage.setItem(`focuspulse_account_uid_${window.appState.authUid}`, JSON.stringify(window.appState));
        }
    } catch (e) {}

    if (window.firebaseSyncToCloud) {
        clearTimeout(window.syncTimeout);
        if (immediateCloudSync) {
            window.firebaseSyncToCloud(window.appState);
        } else {
            window.syncTimeout = setTimeout(() => {
                window.firebaseSyncToCloud(window.appState);
            }, 250);
        }
    }
}

function exportData() {
    const dataStr = JSON.stringify(window.appState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FocusPulse_Backup_${formatDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification("Backup Exported", "Your FocusPulse data has been downloaded as JSON.", "success");
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            window.appState = {
                ...window.appState,
                ...imported,
                user: { ...(window.appState.user || {}), ...(imported.user || {}) }
            };
            if (!Array.isArray(window.appState.courses)) {
                window.appState.courses = [];
            }
            window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
            if (Array.isArray(window.appState.tasks)) {
                window.appState.tasks.forEach(t => {
                    if (t.category === 'Studies' && !t.course) {
                        const lowerTitle = (t.title || '').toLowerCase();
                        const matched = (window.appState.courses || []).find(c => lowerTitle.includes(c.name.toLowerCase()));
                        if (matched) t.course = matched.name;
                        else if (window.appState.courses[0]) t.course = window.appState.courses[0].name;
                    }
                });
            }
            sweepCompletedTasksToHistory();
            saveState(true);
            applyLiquidGlass(window.appState.liquidEffect === true);
            applyThemeVariables();
            window.updateUI();
            showNotification("Data Restored", "Your backup file was imported and synced!", "success");
        } catch (err) {
            showNotification("Import Error", "The selected backup file could not be parsed. Please verify that it is a valid FocusPulse JSON file.", "warning");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}


function hexToNormalizedRgb(hex) {
    let cleaned = (hex || '#5f5bf6').replace('#', '').trim();
    if (cleaned.length === 3) cleaned = cleaned.split('').map(c => c + c).join('');
    if (cleaned.length !== 6) return [0.373, 0.357, 0.965];
    const r = parseInt(cleaned.substring(0, 2), 16) / 255;
    const g = parseInt(cleaned.substring(2, 4), 16) / 255;
    const b = parseInt(cleaned.substring(4, 6), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return [0.373, 0.357, 0.965];
    return [Number(r.toFixed(3)), Number(g.toFixed(3)), Number(b.toFixed(3))];
}

function updateDynamicLogoAccent(accentHex, accentFgHex) {
    const [ar, ag, ab] = hexToNormalizedRgb(accentHex || '#5f5bf6');
    const [fr, fg, fb] = hexToNormalizedRgb(accentFgHex || '#ffffff');
    let mode = (window.appState && window.appState.logoColorMode) ? window.appState.logoColorMode : 'badge';
    if (mode !== 'badge' && mode !== 'icon-tint') {
        mode = 'badge';
        if (window.appState) window.appState.logoColorMode = 'badge';
    }

    const funcR = document.getElementById('fp-logo-func-r');
    const funcG = document.getElementById('fp-logo-func-g');
    const funcB = document.getElementById('fp-logo-func-b');

    if (funcR && funcG && funcB) {
        if (mode === 'icon-tint') {
            funcR.setAttribute('tableValues', `${ar} ${ar} ${ar}`);
            funcG.setAttribute('tableValues', `${ag} ${ag} ${ag}`);
            funcB.setAttribute('tableValues', `${ab} ${ab} ${ab}`);
        } else {
            funcR.setAttribute('tableValues', `${ar} ${ar} ${fr}`);
            funcG.setAttribute('tableValues', `${ag} ${ag} ${fg}`);
            funcB.setAttribute('tableValues', `${ab} ${ab} ${fb}`);
        }
    }

    document.querySelectorAll('.fp-logo-box').forEach(box => {
        box.setAttribute('data-logo-mode', mode);
    });

    const modeLbl = document.getElementById('logo-color-mode-label');
    if (modeLbl) {
        const labelMap = {
            'badge': 'Mode: Accent Badge',
            'icon-tint': 'Mode: Accent Icon'
        };
        modeLbl.innerText = labelMap[mode] || 'Mode: Accent Badge';
    }
}

function cycleLogoColorMode() {
    const modes = ['badge', 'icon-tint'];
    const current = (window.appState.logoColorMode === 'icon-tint') ? 'icon-tint' : 'badge';
    const next = modes[(modes.indexOf(current) + 1) % modes.length];
    window.appState.logoColorMode = next;
    applyThemeVariables();
    saveState();
    const descMap = {
        'badge': 'Accent Badge Mode: Logo badge & background dynamically follow your Theme & Accent Palette.',
        'icon-tint': 'Accent Icon Mode: The logo icon itself is tinted with your active Accent Color.'
    };
    if (typeof showNotification === 'function') {
        showNotification('Logo Color Mode Updated', descMap[next], 'info');
    }
}


function syncExeDesktopBridge() {
    if (!window.appState) return;
    const runAtStartup = Boolean(window.appState.exeRunAtStartup);
    const closeToTray = window.appState.exeCloseToTray !== false;
    try {
        if (window.focusPulseDesktop && typeof window.focusPulseDesktop.syncExeSettings === 'function') {
            window.focusPulseDesktop.syncExeSettings({
                runAtStartup,
                closeToTray
            });
        }
        if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
            window.__TAURI__.core.invoke('sync_exe_settings', { runAtStartup, closeToTray }).catch(() => {});
        }
    } catch (e) {}
}
