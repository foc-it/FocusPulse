// ==========================================
// FocusPulse - Animated Startup, Auth & Casual Personal Onboarding Engine (onboarding.js)
// ==========================================

const ONBOARDING_STEPS_ORDER = ['step_a', 'step_b', 'step_c', 'step_d', 'step_e', 'step_f'];

const QUICK_SUBJECT_SUGGESTIONS = [
    { name: 'Mathematics', code: 'MA', color: '#5f5bf6' },
    { name: 'Programming', code: 'PR', color: '#10b981' },
    { name: 'Physics', code: 'PH', color: '#f97316' },
    { name: 'Digital Electronics', code: 'DE', color: '#8b5cf6' },
    { name: 'Data Structures', code: 'DS', color: '#06b6d4' },
    { name: 'AI & ML', code: 'AI', color: '#d946ef' },
    { name: 'Chemistry', code: 'CH', color: '#eab308' },
    { name: 'Literature', code: 'LI', color: '#ef4444' }
];

const QUICK_HABIT_SUGGESTIONS = [
    { name: 'Read for 20 minutes', category: 'Learning', icon: '📚', color: 'violet', targetPerWeek: 5 },
    { name: "Revise today's lessons", category: 'Learning', icon: '📝', color: 'amber', targetPerWeek: 5 },
    { name: 'Exercise / Stretch (30m)', category: 'Fitness', icon: '💪', color: 'emerald', targetPerWeek: 4 },
    { name: 'Sleep on time', category: 'Health', icon: '😴', color: 'blue', targetPerWeek: 7 },
    { name: 'Morning Hydration (500ml)', category: 'Health', icon: '💧', color: 'blue', targetPerWeek: 7 },
    { name: '10m Evening Mindfulness', category: 'Mindfulness', icon: '🧘', color: 'rose', targetPerWeek: 7 }
];

let startupSequenceTimers = [];
let startupCompletedThisSession = false;
let obSelectedCourseColor = '#5f5bf6';
let obLastTaskAddedFeedback = '';
let obLastHabitAddedFeedback = '';
let obSelectedStudyPreset = 'Balanced Weekdays';

function getSavedLocalGuestName() {
    try {
        const directGuest = (localStorage.getItem('focuspulse_guest_profile_name') || localStorage.getItem('focuspulse_guest_name') || '').trim();
        if (directGuest && directGuest !== 'Guest' && directGuest !== 'Student Scholar' && directGuest !== 'Student') {
            return directGuest;
        }
    } catch (e) {}
    return '';
}

function saveLocalGuestName(nameVal) {
    const clean = String(nameVal || '').trim();
    if (!clean || clean === 'Guest' || clean === 'Student Scholar') return;
    if (window.appState && window.appState.user) {
        window.appState.user.name = clean;
        window.appState.user.isCustomName = true;
    }
    try {
        localStorage.setItem('focuspulse_guest_profile_name', clean);
        localStorage.setItem('focuspulse_guest_name', clean);
        localStorage.setItem('focuspulse_custom_user', JSON.stringify({
            name: clean,
            subjects: (window.appState && window.appState.user && window.appState.user.subjects) || '',
            avatarDataUrl: (window.appState && window.appState.user && window.appState.user.avatarDataUrl) || '',
            isCustomName: true
        }));
    } catch (e) {}
}

function clearStartupTimers() {
    startupSequenceTimers.forEach(t => clearTimeout(t));
    startupSequenceTimers = [];
}

function isReducedMotionOrPerfActive() {
    const mediaReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const perfActive = Boolean(window.appState && window.appState.performanceMode);
    return mediaReduced || perfActive;
}

// =========================================================================
// 1. ANIMATED STARTUP SCREEN — RUNS ON EVERY APPLICATION LAUNCH (~1.5s)
// =========================================================================
function runEveryLaunchStartupSequence() {
    const overlay = document.getElementById('fp-startup-overlay');
    if (!overlay) {
        routeAfterStartupScreen();
        return;
    }

    clearStartupTimers();
    overlay.classList.remove('hidden', 'fp-startup-stage-logo', 'fp-startup-stage-reveal', 'fp-startup-stage-exit');

    const fastMode = isReducedMotionOrPerfActive();
    if (fastMode) {
        overlay.classList.add('fp-startup-stage-logo', 'fp-startup-stage-reveal');
        startupSequenceTimers.push(setTimeout(() => {
            finishStartupAnimationAndRoute();
        }, 320));
        return;
    }

    // Step 1 (30ms): Scale & fade in the existing FocusPulse logo with subtle glow
    startupSequenceTimers.push(setTimeout(() => {
        overlay.classList.add('fp-startup-stage-logo');
    }, 30));

    // Step 2 (400ms): Slide "FocusPulse" in from right to left while logo + text center together
    startupSequenceTimers.push(setTimeout(() => {
        overlay.classList.add('fp-startup-stage-reveal');
    }, 400));

    // Step 3 (1380ms): Hold centered lockup briefly, then transition smoothly to target screen
    startupSequenceTimers.push(setTimeout(() => {
        finishStartupAnimationAndRoute();
    }, 1380));
}

function finishStartupAnimationAndRoute() {
    clearStartupTimers();
    const overlay = document.getElementById('fp-startup-overlay');
    routeAfterStartupScreen();

    if (!overlay) return;
    overlay.classList.add('fp-startup-stage-exit');
    const exitDelay = isReducedMotionOrPerfActive() ? 40 : 280;
    setTimeout(() => {
        overlay.classList.add('hidden');
        startupCompletedThisSession = true;
    }, exitDelay);
}

function skipStartupAnimationNow() {
    finishStartupAnimationAndRoute();
}

// =========================================================================
// 2. SMART FIRST-LAUNCH & RETURNING-USER ROUTING ENGINE
// =========================================================================
function routeAfterStartupScreen() {
    if (!window.appState) return;
    const savedGuest = getSavedLocalGuestName();
    if (savedGuest && (!window.appState.user.name || window.appState.user.name === 'Guest' || window.appState.user.name === 'Student Scholar')) {
        window.appState.user.name = savedGuest;
        window.appState.user.isCustomName = true;
    }
    updateReturningUserHomeGreeting();
    updateOnboardingAccountStatusUI();

    const hasCompleted = Boolean(window.appState.hasCompletedOnboarding);
    const step = window.appState.onboardingStep || 'welcome';
    const userType = window.appState.userType;

    // Returning user (authenticated or guest) who has already completed onboarding -> Go straight to personalized Home screen
    if (hasCompleted || userType === 'authenticated') {
        window.appState.hasCompletedOnboarding = true;
        window.appState.onboardingStep = 'done';
        closeOnboardingShell();
        window.appState.activeSection = 'home';
        switchAppView('home', false);
        return;
    }

    // User with incomplete onboarding in progress -> Resume the unfinished step
    if (userType && ONBOARDING_STEPS_ORDER.includes(step)) {
        openOnboardingWizard(step, false);
        return;
    }
    if (userType && step === 'complete') {
        openOnboardingWizard('complete', false);
        return;
    }

    // First-time user -> Show Welcome & Authentication screen
    openOnboardingAuthScreen('welcome');
}

window.handlePostAuthRouting = function(user, isNewSignup = false) {
    if (!window.appState) return;
    const savedGuest = getSavedLocalGuestName();
    if (savedGuest && (!window.appState.user.name || window.appState.user.name === 'Guest' || window.appState.user.name === 'Student Scholar')) {
        window.appState.user.name = savedGuest;
        window.appState.user.isCustomName = true;
    }
    updateReturningUserHomeGreeting();
    updateOnboardingAccountStatusUI();

    // When signing into an existing account (!isNewSignup), NEVER ask landing onboarding questions — go straight to dashboard!
    if (!isNewSignup || window.appState.hasCompletedOnboarding) {
        window.appState.hasCompletedOnboarding = true;
        window.appState.onboardingStep = 'done';
        saveState(true);
        closeOnboardingShell();
        if (typeof window.updateUI === 'function') window.updateUI();
        window.appState.activeSection = 'home';
        switchAppView('home', false);
        return;
    }

    const resumeStep = ONBOARDING_STEPS_ORDER.includes(window.appState.onboardingStep)
        ? window.appState.onboardingStep
        : 'step_a';
    openOnboardingWizard(resumeStep, false);
};

function updateReturningUserHomeGreeting() {
    if (!window.appState) return;
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');

    const rawName = ((window.appState.user && window.appState.user.name && window.appState.user.name !== 'Guest' && window.appState.user.name !== 'Student Scholar')
        ? window.appState.user.name.trim()
        : getSavedLocalGuestName());
    const hasPersonalName = rawName && rawName !== 'Student Scholar' && rawName !== 'Student' && rawName !== 'Guest';
    const firstName = hasPersonalName ? rawName.split(' ')[0] : 'Guest';

    const eyebrowEl = document.getElementById('home-greeting-eyebrow');
    const titleEl = document.getElementById('home-greeting-heading');
    const nameSpan = document.getElementById('home-greeting-name');
    const subEl = document.getElementById('home-greeting-subtitle');

    if (eyebrowEl) {
        eyebrowEl.innerText = `${timeGreeting} • FocusPulse Studio`;
    }
    if (nameSpan) {
        nameSpan.innerText = firstName;
    }
    if (titleEl) {
        titleEl.innerHTML = `Welcome back, <span id="home-greeting-name">${escapeHtml(firstName)}</span>! 👋`;
    }
    if (subEl) {
        const pendingCnt = (window.appState.tasks || []).filter(t => !t.completed).length;
        const todayKey = typeof formatDateKey === 'function' ? formatDateKey(new Date()) : '';
        const habitsLeft = (window.appState.habits || []).filter(h => !(h.logs && h.logs[todayKey])).length;
        if (pendingCnt > 0 || habitsLeft > 0) {
            subEl.innerText = `Ready to pick up where you left off? You have ${pendingCnt} pending task${pendingCnt === 1 ? '' : 's'} and ${habitsLeft} habit${habitsLeft === 1 ? '' : 's'} queued for today.`;
        } else {
            subEl.innerText = `Ready to pick up where you left off? Start a deep focus session or review your study plan.`;
        }
    }
}

function updateOnboardingAccountStatusUI() {
    if (!window.appState) return;
    const isLoggedIn = Boolean(window.currentFirebaseUser || window.appState.userType === 'authenticated');
    const badgeEl = document.getElementById('account-mode-pill-badge');
    if (badgeEl) {
        const guestName = getSavedLocalGuestName();
        if (isLoggedIn) {
            const emailStr = window.currentFirebaseUser?.email || window.appState.authEmail || 'Cloud Synced';
            badgeEl.innerHTML = `<i class="fa-solid fa-cloud-check mr-1"></i> Signed In (${escapeHtml(emailStr)})`;
            badgeEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 mx-auto sm:mx-0 w-fit';
        } else {
            badgeEl.innerHTML = `<i class="fa-solid fa-user-astronaut mr-1"></i> Guest Mode${guestName ? ' (' + escapeHtml(guestName) + ')' : ''}`;
            badgeEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 mx-auto sm:mx-0 w-fit';
        }
    }

    // Morph "Sign In / Sign Up" button into "Logout" button when logged in
    const morphBtns = document.querySelectorAll('#profile-auth-action-btn, .fp-auth-morph-trigger');
    morphBtns.forEach(btn => {
        if (isLoggedIn) {
            btn.className = 'fp-auth-morph-trigger fp-auth-morph-btn fp-auth-morph-btn--logout px-4 py-2 rounded-full text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm';
            btn.innerHTML = `<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Logout</span>`;
            btn.title = 'Sync & Logout of Account';
            btn.onclick = () => {
                if (typeof window.firebaseLogout === 'function') window.firebaseLogout();
            };
        } else {
            btn.className = 'fp-auth-morph-trigger fp-auth-morph-btn v-accent-btn px-4 py-2 rounded-full text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm';
            btn.innerHTML = `<i class="fa-solid fa-user-shield"></i> <span>Sign In / Sign Up</span>`;
            btn.title = 'Sign In or Sign Up';
            btn.onclick = () => {
                openOnboardingAuthScreen('signin');
            };
        }
    });
}
window.updateOnboardingAccountStatusUI = updateOnboardingAccountStatusUI;

function closeOnboardingShell() {
    const shell = document.getElementById('fp-onboarding-shell');
    if (shell) shell.classList.add('hidden');
}

// =========================================================================
// 3. WELCOME & AUTHENTICATION SCREENS ('welcome', 'signin', 'signup', 'forgot')
// =========================================================================
let authScreenSource = null; // 'profile' | 'settings' | 'welcome' | null

window.handleAuthBackNavigation = function() {
    // If user opened Sign In / Sign Up from Profile (or already completed onboarding),
    // clicking Back closes the auth shell and returns directly to Profile (account view)
    if (authScreenSource === 'profile' || window.appState.hasCompletedOnboarding || (typeof activeMainTab !== 'undefined' && activeMainTab === 'account')) {
        authScreenSource = null;
        closeOnboardingShell();
        if (typeof switchAppView === 'function') {
            switchAppView('account', false);
        }
        return;
    }
    if (authScreenSource === 'settings' || (typeof activeMainTab !== 'undefined' && activeMainTab === 'settings')) {
        authScreenSource = null;
        closeOnboardingShell();
        if (typeof switchAppView === 'function') {
            switchAppView('settings', false);
        }
        return;
    }
    // Only open the starting wizard if user is a brand-new visitor who hasn't completed setup
    openOnboardingAuthScreen('welcome');
};

function openOnboardingAuthScreen(mode = 'welcome', source = null) {
    if (source) {
        authScreenSource = source;
    } else if (typeof activeMainTab !== 'undefined' && activeMainTab === 'account') {
        authScreenSource = 'profile';
    } else if (typeof activeMainTab !== 'undefined' && activeMainTab === 'settings') {
        authScreenSource = 'settings';
    }

    const proceedOpen = () => {
        const shell = document.getElementById('fp-onboarding-shell');
        if (!shell) return;
        shell.classList.remove('hidden');
        if (!window.appState.hasCompletedOnboarding) {
            window.appState.onboardingStep = mode;
            saveState();
        }
        renderOnboardingAuthView(mode);
    };

    // If user already has Guest data and clicks to open Sign In (Login), prompt them to Export Backup first!
    // (Whereas if they click Sign Up, do nothing special — keep their guest data!)
    if (
        mode === 'signin' &&
        typeof window.hasExistingGuestData === 'function' &&
        window.hasExistingGuestData() &&
        !window._guestLoginWarningAcknowledged
    ) {
        proceedOpen();
        if (typeof window.openGuestBackupPromptBeforeLogin === 'function') {
            window.openGuestBackupPromptBeforeLogin(() => {
                renderOnboardingAuthView('signin');
            });
        }
        return;
    }

    proceedOpen();
}

window.setOnboardingAuthLoading = function(isLoading, labelText = 'Working...') {
    const btn = document.getElementById('ob-auth-submit-btn');
    if (!btn) return;
    btn.disabled = Boolean(isLoading);
    if (isLoading) {
        btn.dataset.origHtml = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i><span>${escapeHtml(labelText)}</span>`;
    } else if (btn.dataset.origHtml) {
        btn.innerHTML = btn.dataset.origHtml;
    }
};

function toggleObPasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    if (icon) {
        icon.className = isPass ? 'fa-regular fa-eye-slash text-xs' : 'fa-regular fa-eye text-xs';
    }
}

function startGuestOnboardingFlow() {
    window.appState.userType = 'guest';
    const savedGuest = getSavedLocalGuestName();
    if (savedGuest) {
        window.appState.user.name = savedGuest;
        window.appState.user.isCustomName = true;
    }
    window.appState.hasCompletedOnboarding = false;
    window.appState.onboardingStep = 'step_a';
    saveState();
    openOnboardingWizard('step_a', false);
}

function skipSetupAndGoHomeNow() {
    if (!window.appState.userType) {
        window.appState.userType = 'guest';
    }
    const savedGuest = getSavedLocalGuestName();
    if (savedGuest) {
        window.appState.user.name = savedGuest;
        window.appState.user.isCustomName = true;
    }
    window.appState.hasCompletedOnboarding = true;
    window.appState.onboardingStep = 'done';
    saveState();
    closeOnboardingShell();
    updateReturningUserHomeGreeting();
    if (typeof window.updateUI === 'function') window.updateUI();
    switchAppView('home', false);
    showNotification("Welcome to FocusPulse! 👋", "Your workspace is ready.", "info");
}

function completeLocalAccountFallback(mode = 'signup') {
    const nameInput = document.getElementById('ob-signup-name');
    const emailInput = document.getElementById(mode === 'signup' ? 'ob-signup-email' : 'ob-signin-email');
    const enteredName = (nameInput ? nameInput.value : '').trim() || getSavedLocalGuestName();
    const enteredEmail = (emailInput ? emailInput.value : '').trim();

    window.appState.userType = 'authenticated';
    window.appState.authEmail = enteredEmail || 'local@focuspulse.app';
    window.appState.authUid = 'local_' + (enteredEmail ? enteredEmail.replace(/[^a-zA-Z0-9]/g, '_') : 'user');

    if (enteredName) {
        saveLocalGuestName(enteredName);
        window.appState.onboardingSummary = window.appState.onboardingSummary || {};
        window.appState.onboardingSummary.nameSet = true;
    }

    if (mode === 'signin' || window.appState.hasCompletedOnboarding) {
        window.appState.hasCompletedOnboarding = true;
        window.appState.onboardingStep = 'done';
        saveState(true);
        closeOnboardingShell();
        updateReturningUserHomeGreeting();
        updateOnboardingAccountStatusUI();
        if (typeof window.updateUI === 'function') window.updateUI();
        switchAppView('home', false);
        showNotification("Signed In! 👋", `Welcome back${enteredName ? ', ' + enteredName : ''}!`, "success");
        return;
    }

    window.appState.hasCompletedOnboarding = false;
    window.appState.onboardingStep = enteredName ? 'step_b' : 'step_a';
    saveState(true);
    openOnboardingWizard(window.appState.onboardingStep, false);
}

async function handleOnboardingSignInSubmit(e) {
    if (e) e.preventDefault();
    const email = (document.getElementById('ob-signin-email')?.value || '').trim();
    const pass = document.getElementById('ob-signin-password')?.value || '';
    const errEl = document.getElementById('ob-auth-error-banner');
    if (errEl) errEl.classList.add('hidden');

    if (!email || !pass) {
        if (errEl) {
            errEl.innerText = "Please enter both your email address and password.";
            errEl.classList.remove('hidden');
        }
        return;
    }

    // If user has existing profile or guest data and hasn't acknowledged the warning, pop up backup modal!
    if (typeof window.hasExistingGuestData === 'function' && window.hasExistingGuestData() && !window._guestLoginWarningAcknowledged) {
        if (typeof window.openGuestBackupPromptBeforeLogin === 'function') {
            window.openGuestBackupPromptBeforeLogin(async () => {
                if (typeof window.firebaseLoginEmail === 'function') {
                    const ok = await window.firebaseLoginEmail(email, pass, true);
                    if (!ok) {
                        const fallbackRow = document.getElementById('ob-auth-local-fallback-row');
                        if (fallbackRow) fallbackRow.classList.remove('hidden');
                    }
                } else {
                    completeLocalAccountFallback('signin');
                }
            });
            return;
        }
    }

    if (typeof window.firebaseLoginEmail === 'function') {
        const ok = await window.firebaseLoginEmail(email, pass, true);
        if (!ok) {
            const fallbackRow = document.getElementById('ob-auth-local-fallback-row');
            if (fallbackRow) fallbackRow.classList.remove('hidden');
        }
    } else {
        completeLocalAccountFallback('signin');
    }
}

async function handleOnboardingSignUpSubmit(e) {
    if (e) e.preventDefault();
    const name = (document.getElementById('ob-signup-name')?.value || '').trim();
    const email = (document.getElementById('ob-signup-email')?.value || '').trim();
    const pass = document.getElementById('ob-signup-password')?.value || '';
    const confirmPass = document.getElementById('ob-signup-confirm')?.value || '';
    const termsChecked = document.getElementById('ob-signup-terms')?.checked !== false;
    const errEl = document.getElementById('ob-auth-error-banner');
    if (errEl) errEl.classList.add('hidden');

    if (!email || !email.includes('@')) {
        if (errEl) {
            errEl.innerText = "Please enter a valid email address.";
            errEl.classList.remove('hidden');
        }
        return;
    }
    if (pass.length < 6) {
        if (errEl) {
            errEl.innerText = "Password should be at least 6 characters long.";
            errEl.classList.remove('hidden');
        }
        return;
    }
    if (pass !== confirmPass) {
        if (errEl) {
            errEl.innerText = "Passwords do not match. Please check both password fields.";
            errEl.classList.remove('hidden');
        }
        return;
    }
    if (!termsChecked) {
        if (errEl) {
            errEl.innerText = "Please acknowledge the local-first privacy & license terms to create an account.";
            errEl.classList.remove('hidden');
        }
        return;
    }

    if (name) {
        saveLocalGuestName(name);
        window.appState.onboardingSummary = window.appState.onboardingSummary || {};
        window.appState.onboardingSummary.nameSet = true;
        saveState();
        if (typeof window.updateUI === 'function') window.updateUI();
    }

    if (typeof window.firebaseSignupEmail === 'function') {
        const ok = await window.firebaseSignupEmail(name, email, pass, true);
        if (!ok) {
            const fallbackRow = document.getElementById('ob-auth-local-fallback-row');
            if (fallbackRow) fallbackRow.classList.remove('hidden');
        }
    } else {
        completeLocalAccountFallback('signup');
    }
}

async function handleOnboardingForgotSubmit(e) {
    if (e) e.preventDefault();
    const email = (document.getElementById('ob-forgot-email')?.value || '').trim();
    const errEl = document.getElementById('ob-auth-error-banner');
    if (errEl) errEl.classList.add('hidden');

    if (!email || !email.includes('@')) {
        if (errEl) {
            errEl.innerText = "Please enter the email address associated with your account.";
            errEl.classList.remove('hidden');
        }
        return;
    }

    if (typeof window.firebaseResetPassword === 'function') {
        const ok = await window.firebaseResetPassword(email);
        if (ok && errEl) {
            errEl.className = "p-3 rounded-xl text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30";
            errEl.innerText = `Password reset link sent to ${email}! Check your inbox and return to Sign In.`;
            errEl.classList.remove('hidden');
        }
    }
}

// Google authentication removed

function renderOnboardingAuthView(mode = 'welcome') {
    const stage = document.getElementById('fp-onboarding-stage');
    const topProgressWrap = document.getElementById('fp-onboarding-top-progress');
    if (!stage) return;
    if (topProgressWrap) topProgressWrap.classList.add('hidden');

    const savedGuestName = getSavedLocalGuestName();
    const guestHasData = typeof window.hasExistingGuestData === 'function' && window.hasExistingGuestData();

    if (mode === 'signin') {
        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="flex items-center justify-between">
                    <button type="button" onclick="handleAuthBackNavigation()" class="text-xs font-bold flex items-center gap-1.5 hover:opacity-80 transition" style="color:var(--v-fg2)">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i>
                        <span>Back</span>
                    </button>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);color:var(--v-accent);">Sign In</span>
                </div>

                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">Welcome back 👋</h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">Sign in to automatically fetch and restore your cloud-synced tasks, courses, habits, and profile.</p>
                </div>

                ${guestHasData ? `
                    <div class="p-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-2.5 text-xs">
                        <div class="flex items-start gap-2.5">
                            <i class="fa-solid fa-triangle-exclamation text-amber-500 text-sm mt-0.5 shrink-0"></i>
                            <div class="space-y-1">
                                <p class="font-extrabold text-amber-700 dark:text-amber-300">Guest Workspace Data Detected</p>
                                <p class="text-[11px] leading-relaxed" style="color:var(--v-fg2)">
                                    Signing in to an existing account will load that account's cloud data and may overwrite your current guest data. Export a backup first if you'd like to keep a copy (or switch to <strong>Sign Up</strong> to sync your current guest data into a new account).
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 pt-0.5">
                            <button type="button" onclick="exportData()" class="px-3.5 py-2 rounded-xl font-extrabold text-[11px] bg-amber-500 text-slate-950 hover:bg-amber-400 transition inline-flex items-center gap-1.5 shadow-sm">
                                <i class="fa-solid fa-download"></i>
                                <span>Export Backup (.json)</span>
                            </button>
                            <button type="button" onclick="openOnboardingAuthScreen('signup')" class="px-3 py-2 rounded-xl font-bold text-[11px] border transition hover:opacity-90" style="border-color:var(--v-bdr3);color:var(--v-fg);">
                                Switch to Sign Up (Keep Guest Data) →
                            </button>
                        </div>
                    </div>
                ` : ''}



                <form onsubmit="handleOnboardingSignInSubmit(event)" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-bold mb-1.5" style="color:var(--v-fg2)">Email Address</label>
                        <input type="email" id="ob-signin-email" required placeholder="you@example.com" class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
                    </div>
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <label class="font-bold" style="color:var(--v-fg2)">Password</label>
                            <button type="button" onclick="openOnboardingAuthScreen('forgot')" class="text-[11px] font-bold hover:underline" style="color:var(--v-accent)">Forgot password?</button>
                        </div>
                        <div class="relative">
                            <input type="password" id="ob-signin-password" required placeholder="Enter your password" class="w-full px-3.5 py-2.5 pr-10 rounded-xl font-semibold focus:outline-none">
                            <button type="button" onclick="toggleObPasswordVisibility('ob-signin-password', 'ob-signin-eye')" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-75 hover:opacity-100" style="color:var(--v-fg2)" aria-label="Show or hide password">
                                <i id="ob-signin-eye" class="fa-regular fa-eye text-xs"></i>
                            </button>
                        </div>
                    </div>

                    <div id="ob-auth-error-banner" class="hidden p-3 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30"></div>

                    <div id="ob-auth-local-fallback-row" class="hidden p-3 rounded-xl border space-y-2" style="background:var(--v-bg0);border-color:var(--v-bdr3);">
                        <p class="text-[11px] font-semibold" style="color:var(--v-fg2)">Working offline or restoring from device sync cache?</p>
                        <button type="button" onclick="completeLocalAccountFallback('signin')" class="w-full py-2 px-3 rounded-xl text-xs font-extrabold border transition hover:opacity-90" style="border-color:var(--v-accent);color:var(--v-accent);">
                            Restore Account &amp; Open Dashboard →
                        </button>
                    </div>

                    <button type="submit" id="ob-auth-submit-btn" class="v-accent-btn w-full py-3 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2">
                        <span>Sign In &amp; Sync Data</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                </form>

                <div class="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="openOnboardingAuthScreen('signup')" class="font-bold hover:underline" style="color:var(--v-accent)">
                        New to FocusPulse? Sign Up →
                    </button>
                    <button type="button" onclick="startGuestOnboardingFlow()" class="font-semibold hover:underline" style="color:var(--v-fg2)">
                        Continue as ${savedGuestName ? escapeHtml(savedGuestName) + ' (Guest)' : 'Guest'}
                    </button>
                </div>
            </div>
        `;
        return;
    }

    if (mode === 'signup') {
        stage.innerHTML = `
            <div class="fp-ob-card space-y-4">
                <div class="flex items-center justify-between">
                    <button type="button" onclick="handleAuthBackNavigation()" class="text-xs font-bold flex items-center gap-1.5 hover:opacity-80 transition" style="color:var(--v-fg2)">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i>
                        <span>Back</span>
                    </button>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);color:var(--v-accent);">Sign Up</span>
                </div>

                <div class="space-y-1">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">Create your space ✨</h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">${guestHasData ? "Your current guest courses, tasks, and habits will be automatically synced into your new account." : "Set up your account, then we'll personalize your courses, tasks, habits, and reminders in a quick 1-minute walkthrough."}</p>
                </div>



                <form onsubmit="handleOnboardingSignUpSubmit(event)" class="space-y-3 text-xs">
                    <div>
                        <label class="block font-bold mb-1" style="color:var(--v-fg2)">Your Name <span class="font-normal opacity-75">(saved locally &amp; synced to cloud)</span></label>
                        <input type="text" id="ob-signup-name" value="${escapeHtml(savedGuestName)}" oninput="saveLocalGuestName(this.value)" placeholder="Enter your name..." class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
                    </div>
                    <div>
                        <label class="block font-bold mb-1" style="color:var(--v-fg2)">Email Address *</label>
                        <input type="email" id="ob-signup-email" required placeholder="you@example.com" class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block font-bold mb-1" style="color:var(--v-fg2)">Password *</label>
                            <div class="relative">
                                <input type="password" id="ob-signup-password" required minlength="6" placeholder="Min. 6 characters" class="w-full px-3.5 py-2.5 pr-9 rounded-xl font-semibold focus:outline-none">
                                <button type="button" onclick="toggleObPasswordVisibility('ob-signup-password', 'ob-signup-eye')" class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 opacity-75 hover:opacity-100" style="color:var(--v-fg2)" aria-label="Show or hide password">
                                    <i id="ob-signup-eye" class="fa-regular fa-eye text-xs"></i>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block font-bold mb-1" style="color:var(--v-fg2)">Confirm Password *</label>
                            <input type="password" id="ob-signup-confirm" required minlength="6" placeholder="Repeat password" class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
                        </div>
                    </div>

                    <label class="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                        <input type="checkbox" id="ob-signup-terms" checked class="mt-0.5 w-4 h-4 rounded accent-indigo-600">
                        <span class="text-[11px] leading-snug" style="color:var(--v-fg2)">I agree to the FocusPulse license terms (contact info.focit@gmail.com for copy/reuse) and privacy-first storage.</span>
                    </label>

                    <div id="ob-auth-error-banner" class="hidden p-3 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30"></div>

                    <div id="ob-auth-local-fallback-row" class="hidden p-3 rounded-xl border space-y-2" style="background:var(--v-bg0);border-color:var(--v-bdr3);">
                        <p class="text-[11px] font-semibold" style="color:var(--v-fg2)">Offline or Firebase Console Auth not enabled yet? Create your synced account profile immediately:</p>
                        <button type="button" onclick="completeLocalAccountFallback('signup')" class="w-full py-2 px-3 rounded-xl text-xs font-extrabold border transition hover:opacity-90" style="border-color:var(--v-accent);color:var(--v-accent);">
                            Create Account Profile &amp; Continue →
                        </button>
                    </div>

                    <button type="submit" id="ob-auth-submit-btn" class="v-accent-btn w-full py-3 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2">
                        <span>Sign Up &amp; Sync</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                </form>

                <div class="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="openOnboardingAuthScreen('signin')" class="font-bold hover:underline" style="color:var(--v-accent)">
                        Already have an account? Sign In →
                    </button>
                    <button type="button" onclick="startGuestOnboardingFlow()" class="font-semibold hover:underline" style="color:var(--v-fg2)">
                        Continue as ${savedGuestName ? escapeHtml(savedGuestName) + ' (Guest)' : 'Guest'}
                    </button>
                </div>
            </div>
        `;
        return;
    }

    if (mode === 'forgot') {
        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="flex items-center justify-between">
                    <button type="button" onclick="openOnboardingAuthScreen('signin')" class="text-xs font-bold flex items-center gap-1.5 hover:opacity-80 transition" style="color:var(--v-fg2)">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i>
                        <span>Back to Sign In</span>
                    </button>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);color:var(--v-accent);">Password Recovery</span>
                </div>

                <div class="space-y-1.5">
                    <h2 class="text-2xl font-black tracking-tight" style="color:var(--v-fg)">Reset your password 🔑</h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">Enter your account email and we'll send you a password reset link right away.</p>
                </div>

                <form onsubmit="handleOnboardingForgotSubmit(event)" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-bold mb-1.5" style="color:var(--v-fg2)">Email Address</label>
                        <input type="email" id="ob-forgot-email" required placeholder="you@example.com" class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
                    </div>
                    <div id="ob-auth-error-banner" class="hidden p-3 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30"></div>
                    <button type="submit" id="ob-auth-submit-btn" class="v-accent-btn w-full py-3 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition">
                        Send Reset Email
                    </button>
                </form>
            </div>
        `;
        return;
    }

    // Default: Welcome Screen ('welcome')
    stage.innerHTML = `
        <div class="fp-ob-card text-center space-y-6">
            <div class="flex flex-col items-center gap-3 pt-1">
                <div class="fp-logo-box w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border" style="background:var(--v-accent);color:var(--v-accent-fg);border-color:rgba(255,255,255,0.22);">
                    <img src="assets/logo.png" alt="FocusPulse Logo" class="fp-logo-img w-full h-full object-contain p-2">
                </div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold border" style="background:rgba(var(--v-accent-rgb),0.12);border-color:rgba(var(--v-accent-rgb),0.3);color:var(--v-accent);">
                    <i class="fa-solid fa-sparkles text-[10px]"></i>
                    <span>FocusPulse • Deep Work &amp; Study Suite</span>
                </span>
            </div>

            <div class="space-y-2.5 max-w-md mx-auto">
                <h1 class="text-3xl sm:text-4xl font-black tracking-tight leading-tight" style="color:var(--v-fg)">
                    Your day, your way.
                </h1>
                <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">
                    Let's make a little space for your goals, your habits, and everything you want to get done.
                </p>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold" style="color:var(--v-fg2)">
                <span class="px-3 py-1.5 rounded-xl border" style="background:var(--v-bg0);border-color:var(--v-bdr2);">⏱️ Smart Pomodoro</span>
                <span class="px-3 py-1.5 rounded-xl border" style="background:var(--v-bg0);border-color:var(--v-bdr2);">📚 Courses &amp; Tasks</span>
                <span class="px-3 py-1.5 rounded-xl border" style="background:var(--v-bg0);border-color:var(--v-bdr2);">🌱 7-Day Habit Flow</span>
                <span class="px-3 py-1.5 rounded-xl border" style="background:var(--v-bg0);border-color:var(--v-bdr2);">💧 Hydration &amp; AI Coach</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button type="button" onclick="openOnboardingAuthScreen('signin')" class="py-3.5 px-5 rounded-2xl font-extrabold text-xs sm:text-sm border transition hover:opacity-90 flex items-center justify-center gap-2 shadow-sm" style="background:var(--v-bg0);border-color:var(--v-bdr3);color:var(--v-fg);">
                    <i class="fa-solid fa-right-to-bracket" style="color:var(--v-accent)"></i>
                    <span>Sign In</span>
                </button>
                <button type="button" onclick="openOnboardingAuthScreen('signup')" class="v-accent-btn py-3.5 px-5 rounded-2xl font-extrabold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-lg">
                    <i class="fa-solid fa-user-plus"></i>
                    <span>Sign Up</span>
                </button>
            </div>

            <div class="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style="border-color:var(--v-bdr)">
                <button type="button" onclick="startGuestOnboardingFlow()" class="font-extrabold hover:underline flex items-center gap-1.5 py-1" style="color:var(--v-accent)">
                    <span>Just exploring? Continue as Guest</span>
                    <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
                <button type="button" onclick="skipSetupAndGoHomeNow()" class="text-[11px] font-semibold hover:underline opacity-75 hover:opacity-100" style="color:var(--v-fg3)">
                    Jump straight to dashboard →
                </button>
            </div>
        </div>
    `;
}

// =========================================================================
// 4. CASUAL 6-STEP PERSONAL ONBOARDING WIZARD (Steps A to F + Completion)
// =========================================================================
function openOnboardingWizard(stepKey = 'step_a', isManualReopen = false) {
    const shell = document.getElementById('fp-onboarding-shell');
    if (!shell) return;
    shell.classList.remove('hidden');

    if (!window.appState.userType) {
        window.appState.userType = 'guest';
    }
    if (!isManualReopen) {
        window.appState.onboardingStep = stepKey;
        saveState();
    }
    renderOnboardingWizardStep(stepKey);
}

function updateWizardTopProgressBar(stepKey) {
    const wrap = document.getElementById('fp-onboarding-top-progress');
    const stepText = document.getElementById('fp-ob-step-counter');
    const fillBar = document.getElementById('fp-ob-progress-fill');
    if (!wrap) return;

    if (stepKey === 'complete') {
        wrap.classList.remove('hidden');
        if (stepText) stepText.innerText = 'Setup Complete 🎉';
        if (fillBar) fillBar.style.width = '100%';
        return;
    }

    const idx = ONBOARDING_STEPS_ORDER.indexOf(stepKey);
    if (idx === -1) {
        wrap.classList.add('hidden');
        return;
    }
    wrap.classList.remove('hidden');
    const stepNum = idx + 1;
    const total = ONBOARDING_STEPS_ORDER.length;
    const pct = Math.round((stepNum / total) * 100);
    if (stepText) stepText.innerText = `Step ${stepNum} of ${total}`;
    if (fillBar) fillBar.style.width = `${pct}%`;
}

function goOnboardingNext(currentStep, skipped = false) {
    if (!skipped) {
        commitCurrentStepInputs(currentStep);
    }
    const idx = ONBOARDING_STEPS_ORDER.indexOf(currentStep);
    if (idx >= 0 && idx < ONBOARDING_STEPS_ORDER.length - 1) {
        const nextStep = ONBOARDING_STEPS_ORDER[idx + 1];
        window.appState.onboardingStep = nextStep;
        saveState();
        renderOnboardingWizardStep(nextStep);
    } else {
        window.appState.onboardingStep = 'complete';
        saveState();
        renderOnboardingWizardStep('complete');
    }
}

function goOnboardingBack(currentStep) {
    if (currentStep === 'complete') {
        openOnboardingWizard('step_f');
        return;
    }
    const idx = ONBOARDING_STEPS_ORDER.indexOf(currentStep);
    if (idx > 0) {
        const prevStep = ONBOARDING_STEPS_ORDER[idx - 1];
        window.appState.onboardingStep = prevStep;
        saveState();
        renderOnboardingWizardStep(prevStep);
    } else {
        openOnboardingAuthScreen('welcome');
    }
}

function commitCurrentStepInputs(stepKey) {
    if (!window.appState) return;
    window.appState.onboardingSummary = window.appState.onboardingSummary || {};

    if (stepKey === 'step_a') {
        const nameEl = document.getElementById('ob-step-a-name');
        const val = (nameEl ? nameEl.value : '').trim();
        if (val) {
            saveLocalGuestName(val);
            window.appState.onboardingSummary.nameSet = true;
            if (window.firebaseUpdateProfileName) {
                window.firebaseUpdateProfileName(val, window.appState.user.subjects || '');
            }
        }
        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
    } else if (stepKey === 'step_b') {
        const pendingCourseInput = document.getElementById('ob-course-name-input');
        if (pendingCourseInput && pendingCourseInput.value.trim()) {
            addCourseFromOnboarding(true);
        }
        window.appState.user.subjects = (window.appState.courses || []).map(c => c.name).join(', ');
        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
    } else if (stepKey === 'step_c') {
        const pendingTaskInput = document.getElementById('ob-task-title-input');
        if (pendingTaskInput && pendingTaskInput.value.trim()) {
            addTaskFromOnboarding(true);
        }
        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
    } else if (stepKey === 'step_d') {
        const pendingHabitInput = document.getElementById('ob-habit-name-input');
        if (pendingHabitInput && pendingHabitInput.value.trim()) {
            addHabitFromOnboarding(true);
        }
        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
    } else if (stepKey === 'step_e') {
        const goalEl = document.getElementById('ob-water-goal-input');
        const glassEl = document.getElementById('ob-water-glass-select');
        const intervalEl = document.getElementById('ob-water-interval-select');
        const pomoEl = document.getElementById('ob-pomo-duration-select');

        if (goalEl) window.appState.dailyWaterGoalMl = Math.max(500, parseInt(goalEl.value) || 2500);
        if (glassEl) window.appState.glassSizeMl = parseInt(glassEl.value) || 250;
        if (intervalEl) window.appState.waterReminderIntervalMin = parseInt(intervalEl.value) || 90;
        if (pomoEl) {
            const pMins = parseInt(pomoEl.value) || 25;
            window.appState.timerSettings.pomodoro = pMins;
            if (!window.appState.timer.isRunning && window.appState.timer.mode === 'pomodoro') {
                window.appState.timer.secondsLeft = pMins * 60;
            }
        }
        window.appState.onboardingSummary.waterConfigured = true;
        window.appState.onboardingSummary.studyPlanConfigured = true;
        saveState(true);
        if (typeof window.updateUI === 'function') window.updateUI();
    }
}

window.refreshOnboardingStepAAvatarUI = function() {
    if (window.appState && window.appState.onboardingStep === 'step_a') {
        const shell = document.getElementById('fp-onboarding-shell');
        if (shell && !shell.classList.contains('hidden')) {
            renderOnboardingWizardStep('step_a');
        }
    }
};

// Step B Helpers: Courses & Subjects
function toggleQuickSubjectChip(name, code, color) {
    if (!Array.isArray(window.appState.courses)) window.appState.courses = [];
    const existingIdx = window.appState.courses.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if (existingIdx !== -1) {
        window.appState.courses.splice(existingIdx, 1);
    } else {
        window.appState.courses.push({
            id: 'course-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name,
            code: (code || name.slice(0, 2)).toUpperCase(),
            color: color || '#5f5bf6'
        });
    }
    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
    saveState();
    renderOnboardingWizardStep('step_b');
}

function addCourseFromOnboarding(silent = false) {
    const nameInput = document.getElementById('ob-course-name-input');
    const codeInput = document.getElementById('ob-course-code-input');
    const rawText = (nameInput ? nameInput.value : '').trim();
    if (!rawText) return;

    const customCode = (codeInput ? codeInput.value : '').trim().toUpperCase();
    const entries = rawText.split(',').map(s => s.trim()).filter(Boolean);
    if (!Array.isArray(window.appState.courses)) window.appState.courses = [];

    const palette = ['#5f5bf6', '#10b981', '#f97316', '#8b5cf6', '#06b6d4', '#d946ef', '#eab308', '#ef4444'];
    entries.forEach((entryName, idx) => {
        const exists = window.appState.courses.some(c => c.name.toLowerCase() === entryName.toLowerCase());
        if (!exists) {
            const badgeCode = (entries.length === 1 && customCode)
                ? customCode.slice(0, 2)
                : (entryName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'CR');
            const badgeColor = (entries.length === 1 && obSelectedCourseColor)
                ? obSelectedCourseColor
                : palette[(window.appState.courses.length + idx) % palette.length];
            window.appState.courses.push({
                id: 'course-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 4),
                name: entryName,
                code: badgeCode,
                color: badgeColor
            });
        }
    });

    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';
    saveState();
    if (!silent) {
        renderOnboardingWizardStep('step_b');
    }
}

function removeCourseFromOnboarding(courseId) {
    window.appState.courses = (window.appState.courses || []).filter(c => c.id !== courseId);
    window.appState.user.subjects = window.appState.courses.map(c => c.name).join(', ');
    saveState();
    renderOnboardingWizardStep('step_b');
}

function clearSampleCoursesInOnboarding() {
    window.appState.courses = [];
    window.appState.user.subjects = '';
    saveState();
    renderOnboardingWizardStep('step_b');
}

// Step C Helpers: First Pending Task
function addTaskFromOnboarding(silent = false) {
    const titleEl = document.getElementById('ob-task-title-input');
    const dueEl = document.getElementById('ob-task-due-input');
    const catEl = document.getElementById('ob-task-cat-select');
    const courseEl = document.getElementById('ob-task-course-select');

    const title = (titleEl ? titleEl.value : '').trim();
    if (!title) return;

    const dueDate = (dueEl && dueEl.value) ? dueEl.value : formatDateKey(new Date());
    const category = (catEl && catEl.value) ? catEl.value : 'Studies';
    const course = (category === 'Studies' && courseEl && courseEl.value) ? courseEl.value : '';

    if (!Array.isArray(window.appState.tasks)) window.appState.tasks = [];

    const alreadyExists = window.appState.tasks.some(
        t => !t.completed && t.title.trim().toLowerCase() === title.toLowerCase() && t.dueDate === dueDate
    );

    if (!alreadyExists) {
        const newTask = {
            id: 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            title,
            category,
            subcategory: category === 'Studies' ? 'Assignments' : 'General',
            course,
            dueDate,
            description: '',
            completed: false,
            completedAt: null
        };
        window.appState.tasks.unshift(newTask);
        window.appState.onboardingSummary = window.appState.onboardingSummary || {};
        if (!Array.isArray(window.appState.onboardingSummary.tasksAdded)) {
            window.appState.onboardingSummary.tasksAdded = [];
        }
        window.appState.onboardingSummary.tasksAdded.push(title);
    }

    obLastTaskAddedFeedback = title;
    if (titleEl) titleEl.value = '';
    saveState();
    if (!silent) {
        renderOnboardingWizardStep('step_c');
    }
}

function removeTaskFromOnboarding(taskId) {
    window.appState.tasks = (window.appState.tasks || []).filter(t => t.id !== taskId);
    saveState();
    renderOnboardingWizardStep('step_c');
}

// Step D Helpers: First Habit
function toggleQuickHabitSuggestion(idx) {
    const item = QUICK_HABIT_SUGGESTIONS[idx];
    if (!item) return;
    if (!Array.isArray(window.appState.habits)) window.appState.habits = [];

    const existing = window.appState.habits.find(h => h.name.trim().toLowerCase() === item.name.toLowerCase());
    if (existing) {
        obLastHabitAddedFeedback = item.name;
        renderOnboardingWizardStep('step_d');
        return;
    }

    window.appState.habits.unshift({
        id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        name: item.name,
        category: item.category || 'Learning',
        color: item.color || 'violet',
        icon: item.icon || '🌱',
        targetPerWeek: item.targetPerWeek || 5,
        logs: {}
    });
    obLastHabitAddedFeedback = item.name;
    saveState();
    renderOnboardingWizardStep('step_d');
}

function addHabitFromOnboarding(silent = false) {
    const nameEl = document.getElementById('ob-habit-name-input');
    const freqEl = document.getElementById('ob-habit-freq-select');
    const name = (nameEl ? nameEl.value : '').trim();
    if (!name) return;

    const targetPerWeek = freqEl ? (parseInt(freqEl.value) || 7) : 7;
    if (!Array.isArray(window.appState.habits)) window.appState.habits = [];

    const exists = window.appState.habits.some(h => h.name.trim().toLowerCase() === name.toLowerCase());
    if (!exists) {
        window.appState.habits.unshift({
            id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
            name,
            category: 'Personal',
            color: 'emerald',
            icon: '🌱',
            targetPerWeek,
            logs: {}
        });
        window.appState.onboardingSummary = window.appState.onboardingSummary || {};
        if (!Array.isArray(window.appState.onboardingSummary.habitsAdded)) {
            window.appState.onboardingSummary.habitsAdded = [];
        }
        window.appState.onboardingSummary.habitsAdded.push(name);
    }

    obLastHabitAddedFeedback = name;
    if (nameEl) nameEl.value = '';
    saveState();
    if (!silent) {
        renderOnboardingWizardStep('step_d');
    }
}

function removeHabitFromOnboarding(habitId) {
    window.appState.habits = (window.appState.habits || []).filter(h => h.id !== habitId);
    saveState();
    renderOnboardingWizardStep('step_d');
}

// Step E Helpers: Water & Study Plans
function toggleOnboardingWaterReminders() {
    window.appState.waterRemindersEnabled = !(window.appState.waterRemindersEnabled !== false);
    if (!window.appState.notificationChannels) {
        window.appState.notificationChannels = { pomodoro: true, tasks: true, habits: true, hydration: true };
    }
    window.appState.notificationChannels.hydration = window.appState.waterRemindersEnabled;
    saveState();
    renderOnboardingWizardStep('step_e');
}

function setOnboardingWaterGoalQuick(goalMl) {
    window.appState.dailyWaterGoalMl = goalMl;
    saveState();
    renderOnboardingWizardStep('step_e');
}

function toggleOnboardingStudyPlan() {
    window.appState.studyPlanEnabled = !(window.appState.studyPlanEnabled !== false);
    saveState();
    renderOnboardingWizardStep('step_e');
}

function selectOnboardingStudyPlanPreset(presetName, hours, sessions, days) {
    obSelectedStudyPreset = presetName;
    window.appState.studyPlanEnabled = true;
    if (!Array.isArray(window.appState.schedules)) window.appState.schedules = [];
    const existing = window.appState.schedules.find(s => s.presetName === presetName);
    if (!existing) {
        window.appState.schedules[0] = {
            id: 'sched-ob-1',
            presetName,
            hours,
            sessions,
            days
        };
    }
    saveState();
    renderOnboardingWizardStep('step_e');
}

// Step F Helpers: Notifications, App Sound & Popups (ON by default)
function toggleOnboardingSoundSwitch() {
    window.appState.soundEnabled = !(window.appState.soundEnabled !== false);
    saveState();
    if (window.appState.soundEnabled && typeof playNotificationChime === 'function') {
        playNotificationChime('success');
    }
    renderOnboardingWizardStep('step_f');
}

function toggleOnboardingPopupSwitch() {
    window.appState.inAppPopupsEnabled = !(window.appState.inAppPopupsEnabled !== false);
    saveState();
    renderOnboardingWizardStep('step_f');
}

function toggleOnboardingNotifChannel(channelKey) {
    if (!window.appState.notificationChannels) {
        window.appState.notificationChannels = { pomodoro: true, tasks: true, habits: true, hydration: true };
    }
    window.appState.notificationChannels[channelKey] = !(window.appState.notificationChannels[channelKey] !== false);
    if (channelKey === 'hydration') {
        window.appState.waterRemindersEnabled = window.appState.notificationChannels.hydration;
    }
    saveState();
    renderOnboardingWizardStep('step_f');
}

async function handleOnboardingGrantNotifications() {
    window.appState.notificationsEnabled = true;
    window.appState.notificationPreference = 'enabled';
    saveState();
    await requestBrowserNotificationPermission(true);
    goOnboardingNext('step_f', false);
}

function handleOnboardingSkipNotifications() {
    window.appState.notificationPreference = 'later';
    saveState();
    goOnboardingNext('step_f', true);
}

function finishOnboardingAndEnterApp() {
    window.appState.hasCompletedOnboarding = true;
    window.appState.onboardingStep = 'done';
    saveState(true);
    closeOnboardingShell();
    updateReturningUserHomeGreeting();
    updateOnboardingAccountStatusUI();
    if (typeof window.updateUI === 'function') window.updateUI();
    switchAppView('home', false);
    const greetName = getSavedLocalGuestName() || (window.appState.user?.name || 'Friend');
    showNotification(
        `You're all set, ${greetName.split(' ')[0]}! 🎉`,
        "Your personalized space is ready. Let's make today count — one little step at a time.",
        "success"
    );
}

// Render any of the 6 Wizard Steps or Final Completion Screen
function renderOnboardingWizardStep(stepKey = 'step_a') {
    const stage = document.getElementById('fp-onboarding-stage');
    if (!stage) return;
    updateWizardTopProgressBar(stepKey);

    const state = window.appState;

    // -------------------------------------------------------------------------
    // STEP A: Preferred Name, Profile Picture & Quick Theme Vibe
    // -------------------------------------------------------------------------
    if (stepKey === 'step_a') {
        const currentName = (state.onboardingSummary && state.onboardingSummary.nameSet)
            ? getSavedLocalGuestName()
            : ((state.user && state.user.isCustomName && state.user.name !== 'Guest') ? state.user.name : '');
        const currentAvatar = (state.user && state.user.avatarDataUrl) ? state.user.avatarDataUrl : '';
        const initials = (currentName || 'FP').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'FP';
        const isLight = state.theme === 'light' || state.solidTheme === 'purewhite';
        const presetAvatars = window.FP_PRESET_AVATARS || [];

        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="p-3.5 rounded-2xl border flex items-start gap-3" style="background:rgba(var(--v-accent-rgb),0.1);border-color:rgba(var(--v-accent-rgb),0.28);">
                    <span class="text-lg shrink-0">👋</span>
                    <p class="text-xs font-semibold leading-relaxed" style="color:var(--v-fg)">
                        Hey, welcome aboard! Let's set things up so your space feels like yours. This will only take a minute, and you can skip anything you don't feel like doing now.
                    </p>
                </div>

                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                        First things first — what should we call you?
                    </h2>
                    <p class="text-xs sm:text-sm font-medium" style="color:var(--v-fg2)">
                        A name and profile picture make things feel a little more personal.
                    </p>
                </div>

                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold mb-1.5" style="color:var(--v-fg2)">Your Preferred Name or Nickname</label>
                        <input type="text" id="ob-step-a-name" value="${escapeHtml(currentName)}" placeholder="Enter your name..."
                            oninput="saveLocalGuestName(this.value)"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();goOnboardingNext('step_a', false);}"
                            class="w-full px-4 py-3 rounded-2xl text-sm font-bold focus:outline-none">
                    </div>

                    <!-- Profile Picture Upload & Preset Picker -->
                    <div class="p-4 rounded-2xl border space-y-3" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div class="flex items-center gap-3.5">
                                <div onclick="triggerProfileAvatarFilePicker()" class="relative w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-lg shadow-lg cursor-pointer overflow-hidden border-2 shrink-0 group" style="background:var(--v-accent);color:var(--v-accent-fg);border-color:rgba(255,255,255,0.3);" title="Click to upload profile picture">
                                    ${currentAvatar
                                        ? `<img src="${currentAvatar}" alt="Profile Picture" class="w-full h-full object-cover">`
                                        : `<span>${escapeHtml(initials)}</span>`
                                    }
                                    <div class="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs">
                                        <i class="fa-solid fa-camera"></i>
                                    </div>
                                </div>
                                <div>
                                    <span class="text-xs font-extrabold block" style="color:var(--v-fg)">Profile Picture <span class="font-normal opacity-75">(optional)</span></span>
                                    <span class="text-[11px]" style="color:var(--v-fg2)">Upload a custom photo or pick an avatar badge</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" onclick="triggerProfileAvatarFilePicker()" class="px-3.5 py-2 rounded-xl text-xs font-extrabold border transition hover:opacity-90 flex items-center gap-1.5" style="border-color:var(--v-accent);color:var(--v-accent);background:rgba(var(--v-accent-rgb),0.1);">
                                    <i class="fa-solid fa-camera text-[11px]"></i>
                                    <span>Upload Photo</span>
                                </button>
                                ${currentAvatar ? `
                                    <button type="button" onclick="clearProfileAvatar()" class="px-2.5 py-2 rounded-xl text-xs font-bold border text-rose-400 border-rose-500/30 hover:bg-rose-500/10" title="Remove photo">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        <div class="flex items-center gap-2 flex-wrap pt-1">
                            <span class="text-[11px] font-bold" style="color:var(--v-fg2)">Quick Avatars:</span>
                            ${presetAvatars.map(av => {
                                const isSel = currentAvatar === av.dataUrl;
                                return `<button type="button" onclick="setProfileAvatar('${av.dataUrl}', true)"
                                    class="w-9 h-9 rounded-full overflow-hidden border-2 transition hover:scale-110 flex items-center justify-center"
                                    style="border-color:${isSel ? 'var(--v-accent)' : 'transparent'};transform:${isSel ? 'scale(1.12)' : 'scale(1)'};"
                                    title="${escapeHtml(av.label)}">
                                    <img src="${av.dataUrl}" alt="${escapeHtml(av.label)}" class="w-full h-full object-cover">
                                </button>`;
                            }).join('')}
                        </div>
                    </div>

                    <div class="p-4 rounded-2xl border space-y-3" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                        <div class="flex items-center justify-between gap-2 flex-wrap">
                            <span class="text-xs font-extrabold" style="color:var(--v-fg)">Pick your workspace vibe <span class="font-normal opacity-75">(optional)</span></span>
                            <div class="flex items-center gap-1.5">
                                <button type="button" onclick="setSurfaceMode('dark'); renderOnboardingWizardStep('step_a');" class="px-3 py-1 rounded-xl text-[11px] font-extrabold border transition ${!isLight ? 'v-accent-btn' : ''}" style="${!isLight ? '' : 'border-color:var(--v-bdr3);color:var(--v-fg2);'}">
                                    🌙 Dark
                                </button>
                                <button type="button" onclick="setSurfaceMode('light'); renderOnboardingWizardStep('step_a');" class="px-3 py-1 rounded-xl text-[11px] font-extrabold border transition ${isLight ? 'v-accent-btn' : ''}" style="${isLight ? '' : 'border-color:var(--v-bdr3);color:var(--v-fg2);'}">
                                    ☀️ Light
                                </button>
                            </div>
                        </div>
                        <div class="flex items-center gap-2.5 flex-wrap pt-1">
                            <span class="text-[11px] font-bold" style="color:var(--v-fg2)">Accent:</span>
                            ${FP_ACCENTS.slice(0, 7).map(acc => {
                                const isSel = (state.accentColor || '').toLowerCase() === acc.value.toLowerCase();
                                return `<button type="button" onclick="setAccentColor('${acc.value}'); renderOnboardingWizardStep('step_a');"
                                    style="width:24px;height:24px;border-radius:9999px;background:${acc.value};border:${isSel ? '2.5px solid var(--v-fg)' : '1px solid rgba(255,255,255,0.25)'};transform:${isSel ? 'scale(1.15)' : 'scale(1)'};"
                                    title="${escapeHtml(acc.label)}"></button>`;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <div class="pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="goOnboardingBack('step_a')" class="px-4 py-2.5 rounded-xl text-xs font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                        ← Back
                    </button>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="goOnboardingNext('step_a', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold transition hover:underline" style="color:var(--v-fg2)">
                            Skip for now
                        </button>
                        <button type="button" onclick="goOnboardingNext('step_a', false)" class="v-accent-btn px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5">
                            <span>Continue</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // STEP B: Courses / Subjects (Skippable — None pre-selected by default)
    // -------------------------------------------------------------------------
    if (stepKey === 'step_b') {
        const courses = Array.isArray(state.courses) ? state.courses : [];
        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                        What are you studying these days? 📚
                    </h2>
                    <p class="text-xs sm:text-sm font-medium" style="color:var(--v-fg2)">
                        Add your courses or subjects so we can help organize your study life.
                    </p>
                </div>

                <div class="space-y-2">
                    <p class="text-[11px] font-extrabold uppercase tracking-wider" style="color:var(--v-fg3)">Quick-Add Popular Subjects</p>
                    <div class="flex flex-wrap gap-2">
                        ${QUICK_SUBJECT_SUGGESTIONS.map(s => {
                            const active = courses.some(c => c.name.toLowerCase() === s.name.toLowerCase());
                            return `
                                <button type="button" onclick="toggleQuickSubjectChip('${escapeHtml(s.name)}', '${escapeHtml(s.code)}', '${s.color}')"
                                    class="fp-ob-chip ${active ? 'active' : ''}">
                                    <span class="w-4 h-4 rounded text-[9px] font-black flex items-center justify-center" style="background:${s.color}28;color:${s.color};">${escapeHtml(s.code)}</span>
                                    <span>${escapeHtml(s.name)}</span>
                                    ${active ? '<i class="fa-solid fa-check text-[10px]" style="color:var(--v-accent)"></i>' : '<i class="fa-solid fa-plus text-[9px] opacity-60"></i>'}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="p-4 rounded-2xl border space-y-3" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <label class="block text-xs font-bold" style="color:var(--v-fg)">Add Your Own Course or Subject</label>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <input type="text" id="ob-course-code-input" maxlength="2" placeholder="2-Letter (e.g. MA)"
                            oninput="this.value=this.value.toUpperCase()"
                            class="w-full sm:w-28 px-3 py-2.5 rounded-xl text-xs font-mono font-extrabold uppercase text-center focus:outline-none">
                        <input type="text" id="ob-course-name-input" placeholder="e.g. Mathematics, Programming, Digital Electronics"
                            onkeydown="if(event.key==='Enter'){event.preventDefault();addCourseFromOnboarding(false);}"
                            class="flex-1 px-3.5 py-2.5 rounded-xl text-xs font-bold focus:outline-none">
                        <button type="button" onclick="addCourseFromOnboarding(false)" class="v-accent-btn px-4 py-2.5 rounded-xl text-xs font-extrabold shrink-0">
                            + Add Course
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-extrabold" style="color:var(--v-fg)">Your Active Courses (${courses.length})</span>
                        ${courses.length > 0 ? `<button type="button" onclick="clearSampleCoursesInOnboarding()" class="text-[11px] font-bold hover:underline" style="color:var(--v-fg3)">Clear all</button>` : ''}
                    </div>
                    ${courses.length === 0 ? `
                        <p class="text-xs py-4 text-center rounded-2xl border" style="background:var(--v-bg0);border-color:var(--v-bdr2);color:var(--v-fg3);">
                            No courses selected yet. Tap any subject chip above, type your own, or skip for now.
                        </p>
                    ` : `
                        <div class="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                            ${courses.map(c => {
                                const col = c.color || '#5f5bf6';
                                const code = (c.code || c.name.slice(0, 2)).slice(0, 2).toUpperCase();
                                return `
                                    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold" style="background:var(--v-bg0);border-color:var(--v-bdr3);color:var(--v-fg);">
                                        <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black" style="background:${col}24;color:${col};border:1px solid ${col}55;">${escapeHtml(code)}</span>
                                        <span>${escapeHtml(c.name)}</span>
                                        <button type="button" onclick="removeCourseFromOnboarding('${c.id}')" class="opacity-60 hover:opacity-100 text-rose-400 ml-1" title="Remove course">
                                            <i class="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                    <p class="text-[11px] font-medium" style="color:var(--v-fg3)">
                        Not studying right now? No worries — you can skip this.
                    </p>
                </div>

                <div class="pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="goOnboardingBack('step_b')" class="px-4 py-2.5 rounded-xl text-xs font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                        ← Back
                    </button>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="goOnboardingNext('step_b', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold transition hover:underline" style="color:var(--v-fg2)">
                            Skip for now
                        </button>
                        <button type="button" onclick="goOnboardingNext('step_b', false)" class="v-accent-btn px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5">
                            <span>Continue</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // STEP C: First Pending Task (Skippable)
    // -------------------------------------------------------------------------
    if (stepKey === 'step_c') {
        const courses = Array.isArray(state.courses) ? state.courses : [];
        const pendingTasks = (state.tasks || []).filter(t => !t.completed);
        const todayStr = formatDateKey(new Date());

        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                        Got something on your to-do list? ✍️
                    </h2>
                    <p class="text-xs sm:text-sm font-medium" style="color:var(--v-fg2)">
                        Let's get that first task out of your head and into your plan.
                    </p>
                </div>

                ${obLastTaskAddedFeedback ? `
                    <div class="p-3.5 rounded-2xl border bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2.5">
                        <i class="fa-solid fa-circle-check text-sm shrink-0"></i>
                        <span>Nice! One less thing to keep track of (added "${escapeHtml(obLastTaskAddedFeedback)}"). Want to add another?</span>
                    </div>
                ` : ''}

                <div class="p-4 rounded-2xl border space-y-3.5 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <div>
                        <label class="block font-bold mb-1.5" style="color:var(--v-fg2)">Task Title</label>
                        <input type="text" id="ob-task-title-input" placeholder="e.g. Finish Physics Lab Report, Revise Chapter 3..."
                            onkeydown="if(event.key==='Enter'){event.preventDefault();addTaskFromOnboarding(false);}"
                            class="w-full px-3.5 py-2.5 rounded-xl font-bold focus:outline-none">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                            <label class="block font-bold mb-1 text-[11px]" style="color:var(--v-fg2)">Due Date (optional)</label>
                            <input type="date" id="ob-task-due-input" value="${todayStr}" class="w-full px-3 py-2 rounded-xl font-bold focus:outline-none">
                        </div>
                        <div>
                            <label class="block font-bold mb-1 text-[11px]" style="color:var(--v-fg2)">Category</label>
                            <select id="ob-task-cat-select" class="w-full px-3 py-2 rounded-xl font-bold focus:outline-none">
                                <option value="Personal">Personal</option>
                                <option value="Studies">Studies</option>
                                <option value="Fitness">Fitness</option>
                                <option value="Health">Health</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1 text-[11px]" style="color:var(--v-fg2)">Course (optional)</label>
                            <select id="ob-task-course-select" class="w-full px-3 py-2 rounded-xl font-bold focus:outline-none">
                                <option value="">General / None</option>
                                ${courses.map(c => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} (${escapeHtml(c.code)})</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <button type="button" onclick="addTaskFromOnboarding(false)" class="v-accent-btn w-full py-2.5 rounded-xl font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-plus"></i>
                        <span>Add Task to My List</span>
                    </button>
                </div>

                <div class="space-y-2">
                    <span class="text-xs font-extrabold" style="color:var(--v-fg)">Pending Tasks Queued (${pendingTasks.length})</span>
                    <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        ${pendingTasks.slice(0, 6).map(t => `
                            <div class="px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                                <div class="flex items-center gap-2 min-w-0">
                                    <i class="fa-regular fa-square-check" style="color:var(--v-accent)"></i>
                                    <span class="font-bold truncate" style="color:var(--v-fg)">${escapeHtml(t.title)}</span>
                                    ${t.course ? `<span class="text-[10px] px-2 py-0.5 rounded font-bold" style="background:var(--v-bg3);color:var(--v-fg2);">${escapeHtml(t.course)}</span>` : ''}
                                </div>
                                <button type="button" onclick="removeTaskFromOnboarding('${t.id}')" class="text-rose-400 opacity-70 hover:opacity-100 px-1" title="Remove task">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="goOnboardingBack('step_c')" class="px-4 py-2.5 rounded-xl text-xs font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                        ← Back
                    </button>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="goOnboardingNext('step_c', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold transition hover:underline" style="color:var(--v-fg2)">
                            Skip for now
                        </button>
                        <button type="button" onclick="goOnboardingNext('step_c', false)" class="v-accent-btn px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5">
                            <span>Continue</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // STEP D: First Habit (Skippable)
    // -------------------------------------------------------------------------
    if (stepKey === 'step_d') {
        const habits = Array.isArray(state.habits) ? state.habits : [];
        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                        Anything you'd like to do more often? 🌱
                    </h2>
                    <p class="text-xs sm:text-sm font-medium" style="color:var(--v-fg2)">
                        A small habit can make a big difference. Let's start with one.
                    </p>
                </div>

                ${obLastHabitAddedFeedback ? `
                    <div class="p-3.5 rounded-2xl border bg-emerald-500/15 border-emerald-500/35 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-2.5">
                        <i class="fa-solid fa-seedling text-sm shrink-0"></i>
                        <span>Love that! Small steps, steady progress ("${escapeHtml(obLastHabitAddedFeedback)}"). Want to add one more?</span>
                    </div>
                ` : ''}

                <div class="space-y-2">
                    <p class="text-[11px] font-extrabold uppercase tracking-wider" style="color:var(--v-fg3)">Starter Habit Ideas (Click to Add)</p>
                    <div class="flex flex-wrap gap-2">
                        ${QUICK_HABIT_SUGGESTIONS.map((h, idx) => {
                            const active = habits.some(existing => existing.name.trim().toLowerCase() === h.name.toLowerCase());
                            return `
                                <button type="button" onclick="toggleQuickHabitSuggestion(${idx})" class="fp-ob-chip ${active ? 'active' : ''}">
                                    <span>${h.icon}</span>
                                    <span>${escapeHtml(h.name)}</span>
                                    ${active ? '<i class="fa-solid fa-check text-[10px]" style="color:var(--v-accent)"></i>' : '<i class="fa-solid fa-plus text-[9px] opacity-60"></i>'}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="p-4 rounded-2xl border space-y-3 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <label class="block font-bold" style="color:var(--v-fg)">Or Create Your Own Habit</label>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <input type="text" id="ob-habit-name-input" placeholder="e.g. Practice coding for 30 mins..."
                            onkeydown="if(event.key==='Enter'){event.preventDefault();addHabitFromOnboarding(false);}"
                            class="flex-1 px-3.5 py-2.5 rounded-xl font-bold focus:outline-none">
                        <select id="ob-habit-freq-select" class="px-3 py-2.5 rounded-xl font-bold focus:outline-none">
                            <option value="7">Every day (7d/wk)</option>
                            <option value="5">Weekdays (5d/wk)</option>
                            <option value="4">4 days / week</option>
                            <option value="3">3 days / week</option>
                        </select>
                        <button type="button" onclick="addHabitFromOnboarding(false)" class="v-accent-btn px-4 py-2.5 rounded-xl font-extrabold shrink-0">
                            + Add Habit
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    <span class="text-xs font-extrabold" style="color:var(--v-fg)">Your Active Habits (${habits.length})</span>
                    <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        ${habits.slice(0, 6).map(h => `
                            <div class="px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                                <div class="flex items-center gap-2 min-w-0">
                                    <span>${h.icon || '🌱'}</span>
                                    <span class="font-bold truncate" style="color:var(--v-fg)">${escapeHtml(h.name)}</span>
                                    <span class="text-[10px] px-2 py-0.5 rounded font-bold" style="background:var(--v-bg3);color:var(--v-fg2);">${h.targetPerWeek || 7}d/wk</span>
                                </div>
                                <button type="button" onclick="removeHabitFromOnboarding('${h.id}')" class="text-rose-400 opacity-70 hover:opacity-100 px-1" title="Remove habit">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="goOnboardingBack('step_d')" class="px-4 py-2.5 rounded-xl text-xs font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                        ← Back
                    </button>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="goOnboardingNext('step_d', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold transition hover:underline" style="color:var(--v-fg2)">
                            Skip for now
                        </button>
                        <button type="button" onclick="goOnboardingNext('step_d', false)" class="v-accent-btn px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5">
                            <span>Continue</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // STEP E: Water Settings & Study Plans (Skippable)
    // -------------------------------------------------------------------------
    if (stepKey === 'step_e') {
        const waterOn = state.waterRemindersEnabled !== false;
        const studyOn = state.studyPlanEnabled !== false;
        const goalMl = state.dailyWaterGoalMl || 2500;
        const glassMl = state.glassSizeMl || 250;
        const intervalMin = state.waterReminderIntervalMin || 90;
        const pomoMin = (state.timerSettings && state.timerSettings.pomodoro) || 25;

        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                        Let's make your routine work for you 💧
                    </h2>
                    <p class="text-xs sm:text-sm font-medium" style="color:var(--v-fg2)">
                        A couple of optional settings can help personalize your day.
                    </p>
                </div>

                <!-- Part 1: Water Reminders & Hydration Goal -->
                <div class="p-4 rounded-2xl border space-y-3.5 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center text-sm shrink-0">
                                <i class="fa-solid fa-glass-water"></i>
                            </div>
                            <div>
                                <h3 class="font-extrabold text-xs sm:text-sm" style="color:var(--v-fg)">Water &amp; Hydration Reminders</h3>
                                <p class="text-[11px]" style="color:var(--v-fg2)">Stay hydrated while you study with gentle cup reminders</p>
                            </div>
                        </div>
                        <button type="button" role="switch" aria-checked="${waterOn}" onclick="toggleOnboardingWaterReminders()" class="fp-toggle-switch ${waterOn ? 'active' : ''} shrink-0">
                            <span class="fp-toggle-knob"></span>
                        </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 ${waterOn ? '' : 'opacity-50'}">
                        <div>
                            <label class="block font-bold mb-1 text-[11px]" style="color:var(--v-fg2)">Daily Water Goal (ml)</label>
                            <input type="number" id="ob-water-goal-input" step="250" min="1000" max="6000" value="${goalMl}" class="w-full px-3 py-2 rounded-xl font-bold focus:outline-none">
                        </div>
                        <div>
                            <label class="block font-bold mb-1 text-[11px]" style="color:var(--v-fg2)">Cup / Glass Size</label>
                            <select id="ob-water-glass-select" class="w-full px-3 py-2 rounded-xl font-bold focus:outline-none">
                                <option value="200" ${glassMl === 200 ? 'selected' : ''}>200 ml (Small cup)</option>
                                <option value="250" ${glassMl === 250 ? 'selected' : ''}>250 ml (Standard glass)</option>
                                <option value="300" ${glassMl === 300 ? 'selected' : ''}>300 ml (Mug)</option>
                                <option value="500" ${glassMl === 500 ? 'selected' : ''}>500 ml (Bottle)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold mb-1 text-[11px]" style="color:var(--v-fg2)">Reminder Frequency</label>
                            <select id="ob-water-interval-select" class="w-full px-3 py-2 rounded-xl font-bold focus:outline-none">
                                <option value="60" ${intervalMin === 60 ? 'selected' : ''}>Every 60 mins</option>
                                <option value="90" ${intervalMin === 90 ? 'selected' : ''}>Every 90 mins</option>
                                <option value="120" ${intervalMin === 120 ? 'selected' : ''}>Every 2 hours</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Part 2: Study Plan & Pomodoro Target -->
                <div class="p-4 rounded-2xl border space-y-3.5 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <div class="flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2.5">
                            <div class="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0" style="background:rgba(var(--v-accent-rgb),0.15);color:var(--v-accent);">
                                <i class="fa-solid fa-calendar-check"></i>
                            </div>
                            <div>
                                <h3 class="font-extrabold text-xs sm:text-sm" style="color:var(--v-fg)">Study Plan &amp; Pomodoro Target</h3>
                                <p class="text-[11px]" style="color:var(--v-fg2)">Choose your preferred daily study pace and focus session length</p>
                            </div>
                        </div>
                        <button type="button" role="switch" aria-checked="${studyOn}" onclick="toggleOnboardingStudyPlan()" class="fp-toggle-switch ${studyOn ? 'active' : ''} shrink-0">
                            <span class="fp-toggle-knob"></span>
                        </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 ${studyOn ? '' : 'opacity-50'}">
                        ${[
                            { name: 'Light Daily Flow', hrs: 2, sess: 2, days: 'Mon, Tue, Wed, Thu, Fri', desc: '2h / 2 sessions' },
                            { name: 'Balanced Weekdays', hrs: 3, sess: 3, days: 'Mon, Tue, Wed, Thu, Fri', desc: '3h / 3 sessions' },
                            { name: 'Exam Sprint', hrs: 5, sess: 5, days: 'Mon, Tue, Wed, Thu, Fri, Sat', desc: '5h / 5 sessions' }
                        ].map(p => {
                            const active = obSelectedStudyPreset === p.name;
                            return `
                                <button type="button" onclick="selectOnboardingStudyPlanPreset('${p.name}', ${p.hrs}, ${p.sess}, '${p.days}')"
                                    class="p-2.5 rounded-xl border text-left transition ${active ? 'ring-2' : ''}"
                                    style="background:var(--v-bg2);border-color:${active ? 'var(--v-accent)' : 'var(--v-bdr3)'};">
                                    <p class="font-extrabold text-xs" style="color:var(--v-fg)">${p.name}</p>
                                    <p class="text-[10px] mt-0.5 font-semibold" style="color:var(--v-accent)">${p.desc}</p>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <div class="flex items-center justify-between gap-3 pt-1">
                        <label class="font-bold text-[11px]" style="color:var(--v-fg2)">Default Pomodoro Session Length:</label>
                        <select id="ob-pomo-duration-select" class="px-3 py-1.5 rounded-xl font-bold focus:outline-none">
                            <option value="15" ${pomoMin === 15 ? 'selected' : ''}>15 mins (Blitz)</option>
                            <option value="25" ${pomoMin === 25 ? 'selected' : ''}>25 mins (Classic)</option>
                            <option value="45" ${pomoMin === 45 ? 'selected' : ''}>45 mins (Deep Work)</option>
                            <option value="60" ${pomoMin === 60 ? 'selected' : ''}>60 mins (Extra+)</option>
                        </select>
                    </div>
                </div>

                <div class="pt-3 border-t flex items-center justify-between gap-2 flex-wrap" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="goOnboardingBack('step_e')" class="px-4 py-2.5 rounded-xl text-xs font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                        ← Back
                    </button>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="goOnboardingNext('step_e', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold transition hover:underline" style="color:var(--v-fg2)">
                            Skip for now
                        </button>
                        <button type="button" onclick="goOnboardingNext('step_e', false)" class="v-accent-btn px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5">
                            <span>Continue</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // STEP F: Notifications, App Sound & Popups (ON by default + System Access Request)
    // -------------------------------------------------------------------------
    if (stepKey === 'step_f') {
        const soundOn = state.soundEnabled !== false;
        const popupsOn = state.inAppPopupsEnabled !== false;
        const channels = state.notificationChannels || { pomodoro: true, tasks: true, habits: true, hydration: true };
        const permState = typeof getSystemNotificationPermissionState === 'function' ? getSystemNotificationPermissionState() : 'default';

        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                        Want a little nudge when you need it? 🔔
                    </h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">
                        Tasks, habits, study time — we can give you a gentle reminder so things don't slip your mind. No pressure, though. You're in control.
                    </p>
                </div>

                <!-- 1. App Sound & In-App Popups (ON by default) -->
                <div class="p-4 rounded-2xl border space-y-3 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-extrabold uppercase tracking-wider" style="color:var(--v-accent)">App Sound &amp; Popup Preferences (ON by Default)</span>
                        <button type="button" onclick="playNotificationChime('success')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border hover:opacity-90" style="border-color:var(--v-bdr3);color:var(--v-fg);">
                            🔊 Preview Chime
                        </button>
                    </div>

                    <div onclick="toggleOnboardingSoundSwitch()" class="p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer" style="background:var(--v-bg2);border-color:var(--v-bdr3);">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:rgba(var(--v-accent-rgb),0.15);color:var(--v-accent);">
                                <i class="fa-solid fa-volume-high"></i>
                            </div>
                            <div>
                                <p class="font-extrabold text-xs" style="color:var(--v-fg)">App Sound &amp; Harmonic Chimes</p>
                                <p class="text-[11px]" style="color:var(--v-fg2)">Plays Pomodoro completion alarms &amp; gentle habit/task check-in chimes</p>
                            </div>
                        </div>
                        <button type="button" role="switch" aria-checked="${soundOn}" onclick="event.stopPropagation(); toggleOnboardingSoundSwitch();" class="fp-toggle-switch ${soundOn ? 'active' : ''} shrink-0">
                            <span class="fp-toggle-knob"></span>
                        </button>
                    </div>

                    <div onclick="toggleOnboardingPopupSwitch()" class="p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer" style="background:var(--v-bg2);border-color:var(--v-bdr3);">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                                <i class="fa-solid fa-message"></i>
                            </div>
                            <div>
                                <p class="font-extrabold text-xs" style="color:var(--v-fg)">In-App Toast Popups</p>
                                <p class="text-[11px]" style="color:var(--v-fg2)">Shows floating corner popups for reminders, streaks &amp; timer alerts</p>
                            </div>
                        </div>
                        <button type="button" role="switch" aria-checked="${popupsOn}" onclick="event.stopPropagation(); toggleOnboardingPopupSwitch();" class="fp-toggle-switch ${popupsOn ? 'active' : ''} shrink-0">
                            <span class="fp-toggle-knob"></span>
                        </button>
                    </div>
                </div>

                <!-- 2. Detailed Reminder Channels -->
                <div class="p-4 rounded-2xl border space-y-2.5 text-xs" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <p class="text-[11px] font-extrabold uppercase tracking-wider" style="color:var(--v-fg3)">What We'll Remind You About</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${[
                            { key: 'pomodoro', icon: '⏱️', title: 'Pomodoro & Study Timer', desc: 'When focus or break sessions finish' },
                            { key: 'tasks', icon: '📋', title: 'Due-Today Tasks', desc: 'Nudges for pending tasks due today' },
                            { key: 'habits', icon: '🔥', title: 'Habit Streak Protection', desc: 'Evening check-in for unfinished habits' },
                            { key: 'hydration', icon: '💧', title: 'Water & Hydration', desc: `Every ${state.waterReminderIntervalMin || 90} mins toward ${state.dailyWaterGoalMl || 2500}ml` }
                        ].map(ch => {
                            const isOn = channels[ch.key] !== false;
                            return `
                                <div onclick="toggleOnboardingNotifChannel('${ch.key}')" class="p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition" style="background:var(--v-bg2);border-color:${isOn ? 'var(--v-accent)' : 'var(--v-bdr3)'};">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <span class="text-sm shrink-0">${ch.icon}</span>
                                        <div class="min-w-0">
                                            <p class="font-extrabold text-[11px] truncate" style="color:var(--v-fg)">${ch.title}</p>
                                            <p class="text-[10px] truncate" style="color:var(--v-fg2)">${ch.desc}</p>
                                        </div>
                                    </div>
                                    <input type="checkbox" ${isOn ? 'checked' : ''} onclick="event.stopPropagation(); toggleOnboardingNotifChannel('${ch.key}');" class="w-4 h-4 rounded accent-indigo-600 shrink-0 cursor-pointer">
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- 3. System Notification Access Permission Card -->
                <div class="p-4 rounded-2xl border space-y-3" style="background:rgba(var(--v-accent-rgb),0.1);border-color:rgba(var(--v-accent-rgb),0.32);">
                    <div class="flex items-center justify-between gap-2 flex-wrap">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-bell text-sm" style="color:var(--v-accent)"></i>
                            <span class="text-xs font-extrabold" style="color:var(--v-fg)">System &amp; Background Notification Access</span>
                        </div>
                        <span class="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);background:var(--v-bg0);color:var(--v-accent);">
                            ${permState === 'granted' ? 'Permission Granted ✅' : (permState === 'denied' ? 'Blocked in Browser Settings' : 'Click Below to Allow')}
                        </span>
                    </div>
                    <p class="text-[11px] leading-relaxed" style="color:var(--v-fg2)">
                        Allowing notification access lets FocusPulse alert you when a Pomodoro finishes or when it's time to drink water — even if the app is minimized or in the background.
                    </p>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button type="button" onclick="handleOnboardingGrantNotifications()" class="v-accent-btn py-3 px-4 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2">
                            <i class="fa-solid fa-bell"></i>
                            <span>Yep, let's do it!</span>
                        </button>
                        <button type="button" onclick="handleOnboardingSkipNotifications()" class="py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm border transition hover:opacity-90 flex items-center justify-center gap-2" style="background:var(--v-bg0);border-color:var(--v-bdr3);color:var(--v-fg2);">
                            <span>Maybe later</span>
                        </button>
                    </div>
                </div>

                <div class="pt-2 flex items-center justify-between text-xs">
                    <button type="button" onclick="goOnboardingBack('step_f')" class="px-4 py-2 rounded-xl font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                        ← Back
                    </button>
                    <span class="text-[11px] font-medium" style="color:var(--v-fg3)">You can change these anytime in Settings → Notifications</span>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // FINAL COMPLETION SCREEN ('complete')
    // -------------------------------------------------------------------------
    const displayName = getSavedLocalGuestName() || ((state.user && state.user.name) ? state.user.name : 'Guest');
    const courses = Array.isArray(state.courses) ? state.courses : [];
    const pendingTasks = (state.tasks || []).filter(t => !t.completed);
    const habits = Array.isArray(state.habits) ? state.habits : [];
    const soundOn = state.soundEnabled !== false;
    const popupsOn = state.inAppPopupsEnabled !== false;

    stage.innerHTML = `
        <div class="fp-ob-card text-center space-y-6">
            <div class="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow-xl border overflow-hidden" style="background:var(--v-accent);color:var(--v-accent-fg);border-color:rgba(255,255,255,0.2);">
                ${state.user && state.user.avatarDataUrl
                    ? `<img src="${state.user.avatarDataUrl}" alt="" class="w-full h-full object-cover">`
                    : '🎉'
                }
            </div>

            <div class="space-y-2 max-w-md mx-auto">
                <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">
                    You're all set, ${escapeHtml(displayName.split(' ')[0])}! 🎉
                </h2>
                <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">
                    Your space is ready. Let's make today count — one little step at a time.
                </p>
            </div>

            <!-- Dynamic Personalized Summary Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-xs">
                <div class="p-3.5 rounded-2xl border space-y-1" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--v-accent)">👋 Profile &amp; Space</span>
                    <p class="font-extrabold text-sm" style="color:var(--v-fg)">${escapeHtml(displayName)}</p>
                    <p class="text-[11px]" style="color:var(--v-fg2)">${state.userType === 'authenticated' ? 'Cloud Synced Account Active' : 'Guest Workspace Saved Locally'} • ${state.theme === 'light' ? 'Light Surface' : 'Dark Surface'}</p>
                </div>

                <div class="p-3.5 rounded-2xl border space-y-1" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--v-accent)">📚 Courses (${courses.length})</span>
                    <p class="font-extrabold text-sm truncate" style="color:var(--v-fg)">${courses.length > 0 ? escapeHtml(courses.map(c => c.name).join(', ')) : 'No courses added yet'}</p>
                    <p class="text-[11px]" style="color:var(--v-fg2)">${courses.length > 0 ? '2-letter subject badges ready' : 'Add anytime in Courses & Badges'}</p>
                </div>

                <div class="p-3.5 rounded-2xl border space-y-1" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--v-accent)">✍️ Tasks &amp; Habits</span>
                    <p class="font-extrabold text-sm" style="color:var(--v-fg)">${pendingTasks.length} Pending Task${pendingTasks.length === 1 ? '' : 's'} • ${habits.length} Habit${habits.length === 1 ? '' : 's'}</p>
                    <p class="text-[11px] truncate" style="color:var(--v-fg2)">${pendingTasks[0] ? 'Next: ' + escapeHtml(pendingTasks[0].title) : 'Ready for your first task'}</p>
                </div>

                <div class="p-3.5 rounded-2xl border space-y-1" style="background:var(--v-bg0);border-color:var(--v-bdr2);">
                    <span class="text-[10px] font-extrabold uppercase tracking-wider" style="color:var(--v-accent)">🔔 Reminders &amp; Routine</span>
                    <p class="font-extrabold text-sm" style="color:var(--v-fg)">Sound ${soundOn ? 'ON' : 'OFF'} • Popups ${popupsOn ? 'ON' : 'OFF'}</p>
                    <p class="text-[11px]" style="color:var(--v-fg2)">Water: ${state.dailyWaterGoalMl || 2500}ml (${state.waterReminderIntervalMin || 90}m) • Pomodoro: ${(state.timerSettings && state.timerSettings.pomodoro) || 25}m</p>
                </div>
            </div>

            <div class="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button type="button" onclick="goOnboardingBack('complete')" class="w-full sm:w-auto px-4 py-3 rounded-2xl text-xs font-bold border transition hover:opacity-80" style="border-color:var(--v-bdr3);color:var(--v-fg2);">
                    ← Review Steps
                </button>
                <button type="button" onclick="finishOnboardingAndEnterApp()" class="v-accent-btn w-full sm:flex-1 py-3.5 px-6 rounded-2xl font-extrabold text-sm shadow-xl transition flex items-center justify-center gap-2">
                    <span>Let's get started</span>
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </div>
    `;
}
