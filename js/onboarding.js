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
    { name: 'Morning Hydration (500ml)', category: 'Health', icon: '💧', color: 'blue', targetPerWeek: 7 },
    { name: 'Sleep on time', category: 'Health', icon: '😴', color: 'blue', targetPerWeek: 7 },
    { name: 'Read for 20 minutes', category: 'Learning', icon: '📚', color: 'violet', targetPerWeek: 5 },
    { name: "Revise today's lessons", category: 'Learning', icon: '📝', color: 'amber', targetPerWeek: 5 },
    { name: 'Exercise / Stretch (30m)', category: 'Fitness', icon: '💪', color: 'emerald', targetPerWeek: 4 },
    { name: 'Deep Work Session (No Phone)', category: 'Productivity', icon: '⚡', color: 'amber', targetPerWeek: 5 },
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
    if (typeof checkDailyHydrationReset === 'function') {
        checkDailyHydrationReset();
    }
    updateReturningUserHomeGreeting();
    updateOnboardingAccountStatusUI();

    const userType = window.appState.userType;
    const authEmail = window.appState.authEmail;

    // Strict Auth Policy: ONLY authenticated users may access the application
    if (userType === 'authenticated' && authEmail) {
        closeOnboardingShell();
        window.appState.activeSection = 'home';
        switchAppView('home', false);
        return;
    }

    // Logged out / unauthenticated -> Show Welcome Landing Page with Sign In & Sign Up options!
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
    const hasAuthed = localStorage.getItem('focuspulse_has_authed_account') === 'true';
    const savedEmail = localStorage.getItem('focuspulse_auth_email');
    if (hasAuthed && savedEmail && window.appState.userType !== 'authenticated') {
        window.appState.userType = 'authenticated';
        window.appState.authEmail = savedEmail;
    }
    const isLoggedIn = Boolean(window.currentFirebaseUser || window.appState.userType === 'authenticated');
    const badgeEl = document.getElementById('account-mode-pill-badge');
    if (badgeEl) {
        if (isLoggedIn) {
            const emailStr = window.currentFirebaseUser?.email || window.appState.authEmail || 'Cloud Synced';
            badgeEl.innerHTML = `<i class="fa-solid fa-cloud-check mr-1"></i> Signed In (${escapeHtml(emailStr)})`;
            badgeEl.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 mx-auto sm:mx-0 w-fit';
        } else {
            badgeEl.innerHTML = `<i class="fa-solid fa-lock mr-1"></i> Authentication Required`;
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
    if (!window.appState || window.appState.userType !== 'authenticated' || !window.appState.authEmail) {
        const shell = document.getElementById('fp-onboarding-shell');
        if (shell) shell.classList.remove('hidden');
        return;
    }
    const shell = document.getElementById('fp-onboarding-shell');
    if (shell) shell.classList.add('hidden');
}

// =========================================================================
// 3. WELCOME & AUTHENTICATION SCREENS ('welcome', 'signin', 'signup', 'forgot')
// =========================================================================
let authScreenSource = null; // 'profile' | 'settings' | 'welcome' | null

window.window.handleAuthBackNavigation = function() {
    if (!window.appState || window.appState.userType !== 'authenticated' || !window.appState.authEmail) {
        openOnboardingAuthScreen('signin');
        return;
    }
    if (authScreenSource === 'profile' || (typeof activeMainTab !== 'undefined' && activeMainTab === 'account')) {
        authScreenSource = null;
        closeOnboardingShell();
        if (typeof switchAppView === 'function') switchAppView('account', false);
        return;
    }
    if (authScreenSource === 'settings' || (typeof activeMainTab !== 'undefined' && activeMainTab === 'settings')) {
        authScreenSource = null;
        closeOnboardingShell();
        if (typeof switchAppView === 'function') switchAppView('settings', false);
        return;
    }
    closeOnboardingShell();
};

function openOnboardingAuthScreen(mode = 'welcome', source = null) {
    if (source) {
        authScreenSource = source;
    } else if (typeof activeMainTab !== 'undefined' && activeMainTab === 'account') {
        authScreenSource = 'profile';
    } else if (typeof activeMainTab !== 'undefined' && activeMainTab === 'settings') {
        authScreenSource = 'settings';
    }

    const shell = document.getElementById('fp-onboarding-shell');
    if (!shell) return;
    shell.classList.remove('hidden');
    if (!window.appState.hasCompletedOnboarding) {
        window.appState.onboardingStep = mode;
        saveState();
    }
    renderOnboardingAuthView(mode);
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
    showNotification("Sign In Required 🔒", "Please sign in or create an account to use FocusPulse.", "info");
    openOnboardingAuthScreen('signup');
}

function skipSetupAndGoHomeNow() {
    if (!window.appState || window.appState.userType !== 'authenticated') {
        showNotification("Account Required 🔒", "Please sign in or create an account to access the dashboard.", "warning");
        openOnboardingAuthScreen('signin');
        return;
    }
    closeOnboardingShell();
    switchAppView('home', false);
}

function completeLocalAccountFallback() {}

async function handleOnboardingSignInSubmit(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const email = (document.getElementById('ob-signin-email')?.value || '').trim();
    const pass = document.getElementById('ob-signin-password')?.value || '';
    const errEl = document.getElementById('ob-auth-error-banner');
    if (errEl) {
        errEl.classList.add('hidden');
        errEl.innerText = '';
    }

    if (!email || !pass) {
        showError("Please enter both your email address and password.");
        return;
    }

    if (typeof window.firebaseLoginEmail === 'function') {
        await window.firebaseLoginEmail(email, pass, true);
    }
}

async function handleOnboardingSignUpSubmit(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const name = (document.getElementById('ob-signup-name')?.value || '').trim();
    const email = (document.getElementById('ob-signup-email')?.value || '').trim();
    const pass = document.getElementById('ob-signup-password')?.value || '';
    const confirmPass = document.getElementById('ob-signup-confirm')?.value || '';
    const termsChecked = document.getElementById('ob-signup-terms')?.checked !== false;
    const errEl = document.getElementById('ob-auth-error-banner');
    if (errEl) {
        errEl.classList.add('hidden');
        errEl.innerText = '';
    }

    if (!email || !email.includes('@')) {
        showError("Please enter a valid email address.");
        return;
    }
    if (!pass || pass.length < 6) {
        showError("Password must be at least 6 characters long.");
        return;
    }
    if (pass !== confirmPass) {
        showError("Passwords do not match. Please re-enter your password.");
        return;
    }
    if (!termsChecked) {
        showError("Please acknowledge the privacy & license terms to create an account.");
        return;
    }

    if (typeof window.firebaseSignupEmail === 'function') {
        await window.firebaseSignupEmail(name, email, pass, true);
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

    // -------------------------------------------------------------------------
    // 1. SIGN IN SCREEN
    // -------------------------------------------------------------------------
    if (mode === 'signin') {
        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="flex items-center justify-between">
                    <button type="button" onclick="openOnboardingAuthScreen('welcome')" class="text-xs font-bold flex items-center gap-1.5 hover:opacity-80 transition" style="color:var(--v-fg2)">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i>
                        <span>Landing Page</span>
                    </button>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);color:var(--v-accent);">Sign In</span>
                </div>

                <div class="space-y-1.5">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">Welcome back 👋</h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">Sign in to automatically restore your cloud-synced tasks, courses, habits, and profile.</p>
                </div>

                <form onsubmit="handleOnboardingSignInSubmit(event)" class="space-y-4 text-xs">
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

                    <button type="submit" id="ob-auth-submit-btn" class="v-accent-btn w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2">
                        <span>Sign In &amp; Restore Workspace</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                </form>

                <div class="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="openOnboardingAuthScreen('signup')" class="font-bold hover:underline" style="color:var(--v-accent)">
                        New to FocusPulse? Create an Account →
                    </button>
                    <button type="button" onclick="openOnboardingAuthScreen('welcome')" class="font-medium hover:underline" style="color:var(--v-fg3)">
                        Back to Landing
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // 2. SIGN UP SCREEN
    // -------------------------------------------------------------------------
    if (mode === 'signup') {
        stage.innerHTML = `
            <div class="fp-ob-card space-y-4">
                <div class="flex items-center justify-between">
                    <button type="button" onclick="openOnboardingAuthScreen('welcome')" class="text-xs font-bold flex items-center gap-1.5 hover:opacity-80 transition" style="color:var(--v-fg2)">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i>
                        <span>Landing Page</span>
                    </button>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);color:var(--v-accent);">Sign Up</span>
                </div>

                <div class="space-y-1">
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight" style="color:var(--v-fg)">Create your space ✨</h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">Set up your account, then we'll personalize your courses, tasks, habits, and rhythm in a quick 1-minute walkthrough.</p>
                </div>

                <form onsubmit="handleOnboardingSignUpSubmit(event)" class="space-y-3 text-xs">
                    <div>
                        <label class="block font-bold mb-1" style="color:var(--v-fg2)">Your Name</label>
                        <input type="text" id="ob-signup-name" required placeholder="Enter your name..." class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
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
                        <span class="text-[11px] leading-snug" style="color:var(--v-fg2)">I agree to FocusPulse terms and privacy-first local + cloud storage.</span>
                    </label>

                    <div id="ob-auth-error-banner" class="hidden p-3 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30"></div>

                    <button type="submit" id="ob-auth-submit-btn" class="v-accent-btn w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2">
                        <span>Create Account &amp; Personalize</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>
                </form>

                <div class="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs" style="border-color:var(--v-bdr)">
                    <button type="button" onclick="openOnboardingAuthScreen('signin')" class="font-bold hover:underline" style="color:var(--v-accent)">
                        Already have an account? Sign In →
                    </button>
                    <button type="button" onclick="openOnboardingAuthScreen('welcome')" class="font-medium hover:underline" style="color:var(--v-fg3)">
                        Back to Landing
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // 3. FORGOT PASSWORD SCREEN (Sets new password to [Name]@123)
    // -------------------------------------------------------------------------
    if (mode === 'forgot') {
        stage.innerHTML = `
            <div class="fp-ob-card space-y-5">
                <div class="flex items-center justify-between">
                    <button type="button" onclick="openOnboardingAuthScreen('signin')" class="text-xs font-bold flex items-center gap-1.5 hover:opacity-80 transition" style="color:var(--v-fg2)">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i>
                        <span>Back to Sign In</span>
                    </button>
                    <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border" style="border-color:var(--v-bdr3);color:var(--v-accent);">Password Reset</span>
                </div>

                <div class="space-y-1.5">
                    <h2 class="text-2xl font-black tracking-tight" style="color:var(--v-fg)">Reset your password 🔑</h2>
                    <p class="text-xs sm:text-sm font-medium leading-relaxed" style="color:var(--v-fg2)">Enter your account email to reset your password to the secure <strong>[Name]@123</strong> format.</p>
                </div>

                <form onsubmit="handleOnboardingForgotSubmit(event)" class="space-y-3.5 text-xs">
                    <div>
                        <label class="block font-bold mb-1.5" style="color:var(--v-fg2)">Account Email</label>
                        <input type="email" id="ob-forgot-email" required placeholder="you@example.com" class="w-full px-3.5 py-2.5 rounded-xl font-semibold focus:outline-none">
                    </div>
                    <div id="ob-auth-error-banner" class="hidden"></div>
                    <button type="submit" id="ob-auth-submit-btn" class="v-accent-btn w-full py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-lg transition">
                        Reset Password
                    </button>
                </form>
            </div>
        `;
        return;
    }

    // -------------------------------------------------------------------------
    // 4. WELCOME & LANDING SCREEN ('welcome')
    // -------------------------------------------------------------------------
    stage.innerHTML = `
        <div class="fp-ob-card text-center space-y-6">
            <div class="flex flex-col items-center gap-3 pt-1">
                <div class="fp-logo-box w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl border" data-logo-mode="original" style="background:var(--v-accent);color:var(--v-accent-fg);border-color:rgba(255,255,255,0.22);">
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKhGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMxNDUgNzkuMTYzNDk5LCAyMDE4LzA4LzEzLTE2OjQwOjIyICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0RXZ0PSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VFdmVudCMiIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHhtcDpDcmVhdGVEYXRlPSIyMDI2LTEwLTA3VDIyOjIyOjA4KzA1OjMwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDI2LTEwLTIyVDIwOjE3OjM1KzA1OjMwIiB4bXA6TW9kaWZ5RGF0ZT0iMjAyNi0xMC0yMlQyMDoxNzozNSswNTozMCIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6NjI0ODIyNTktOTQ4OS1kNzRjLTk3NDgtOGJlMjk0MmQ3NTcyIiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6MjZjMWMwMzItNmQ1NC04MDRmLWE3ZTMtZTdmNTU5MzdkOWFkIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6Mzc1YWYwYWYtMGFkNS1mYjQxLTk0MTAtODJjY2EzZTk1ODI1IiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiB0aWZmOk9yaWVudGF0aW9uPSIxIiB0aWZmOlhSZXNvbHV0aW9uPSI3MjAwMDAvMTAwMDAiIHRpZmY6WVJlc29sdXRpb249IjcyMDAwMC8xMDAwMCIgdGlmZjpSZXNvbHV0aW9uVW5pdD0iMiIgZXhpZjpDb2xvclNwYWNlPSI2NTUzNSIgZXhpZjpQaXhlbFhEaW1lbnNpb249IjEwMjQiIGV4aWY6UGl4ZWxZRGltZW5zaW9uPSIxMDI0Ij4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDozNzVhZjBhZi0wYWQ1LWZiNDEtOTQxMC04MmNjYTNlOTU4MjUiIHN0RXZ0OndoZW49IjIwMjYtMTAtMDdUMjI6MjI6MDgrMDU6MzAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6ZDczNzVlZTMtYjNmYS03NDQ2LWEwYzctOWYyNjA5NTExOGYxIiBzdEV2dDp3aGVuPSIyMDI2LTEwLTA3VDIyOjI0OjMyKzA1OjMwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOSAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjU4NGU5ZDNmLWI4YmYtMGM0Zi1hNWI4LTJkYmViZTVlNDliMCIgc3RFdnQ6d2hlbj0iMjAyNi0xMC0yMlQyMDoxNzozNSswNTozMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTkgKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjb252ZXJ0ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImZyb20gYXBwbGljYXRpb24vdm5kLmFkb2JlLnBob3Rvc2hvcCB0byBpbWFnZS9wbmciLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImRlcml2ZWQiIHN0RXZ0OnBhcmFtZXRlcnM9ImNvbnZlcnRlZCBmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvcG5nIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo2MjQ4MjI1OS05NDg5LWQ3NGMtOTc0OC04YmUyOTQyZDc1NzIiIHN0RXZ0OndoZW49IjIwMjYtMTAtMjJUMjA6MTc6MzUrMDU6MzAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE5IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1wTU06SGlzdG9yeT4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NTg0ZTlkM2YtYjhiZi0wYzRmLWE1YjgtMmRiZWJlNWU0OWIwIiBzdFJlZjpkb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6MWZmYTY5MDgtNDhiYS1lODQ3LTllYTYtYWIxYzFlZDE3MGNiIiBzdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6Mzc1YWYwYWYtMGFkNS1mYjQxLTk0MTAtODJjY2EzZTk1ODI1Ii8+IDwvcmRmOkRl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AAAAK6AAAAAAgBVQAAAAAMAKKAAAAABgBRQAAAAAsAIKAAAAAFgBBQAAAACsgAIAAAAAVkABAAAAACugAAAAAIAVUAAAAADACigAAAAAYAUUAAAAALACCgAAAABYAQUAAAAArIACAAAAAFZAAQAAAAAroAAAAACAFVAAAAAAwAooAAAAAGAFFAAAAACwAgoAAAAAWAEFAAAAAKyAAgAAAABWQAEAAAAAK6AAAAAAgBVQAAAAAMAKKAAAAABgBRQAAAAAsAIKAAAAAFgBBQAAAACsgAIAAAAAVkABAAAAACugAAAAAIAVUAAAAADACigAAAAAYAUUAAAAALACCgAAAABYAQUAAAAArIACAAAAAFZAAQAAAAAroAAAAACAFVAAAAAAwAooAAAAAGAFFAAAAACwAgoAAAAAWAEFAAAAAKyAAgAAAABWQAEAAAAAK6AAAAAAgBVQAAAAAMAKKAAAAABgBRQAAAAAsAIKAAAAAFgBBQAAAACsgAIAAAAAVkABAAAAACugAAAAAIAVUAAAAADACigAAAAAYAUUAAAAALACCgAAAABYAQUAAAAArIACAAAAAFZAAQAAAAAroAAAAACAFVAAAAAAwAooAAAAAGAFFAAAAACwAgoAAAAAWAEFAAAAAKyAAgAAAABWQAEAAAAAK6AAAAAAgBVQAAAAAMAKKAAAAABgBRQAAAAAsAIKAAAAAFgBBQAAAACsgAIAAAAAVkABAAAAACugAAAAAIAVUAAAAADACigAAAAAYAUUAAAAALACCgAAAABYAQUAAAAArIACAAAAAFZAAQAAAAAroAAAAACAFVAAAAAAwAooAAAAAGAFFAAAAACwAgoAAAAAWAEFAAAAAKyAAgAAAABWQAEAAAAAK6AAAAAAgBVQAAAAAMAKKAAAAABgBRQAAAAAsAIKAAAAAFgBBQAAAACsgAIAAAAAVkABAAAAACugAAAAAIAVUAAAAADACigAAAAAYAUUAAAAALACCgAAAABYAQUAAAAArIACAAAAAFZAAQAAAAAroAAAAACAFVAAAAAAwAooAAAAAGAFFAAAAACwAgoAAAAAWAEFAAAAAKyAAgAAAABWQAEAAAAAK6AAAAAAgBVQAAAAAMAKKAAAAABgBRQAAAAAsAIKAAAAAFgBBQAAAACsgAIAAAAAVkABAAAAACugAAAAAIAV+P8Bu/R+UQ0rP/UAAAAASUVORK5CYII=" onerror="this.onerror=null; this.src='assets/logo.png';" alt="FocusPulse Logo" class="w-full h-full object-contain p-2 drop-shadow-md" style="filter:none !important;">
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

            <div class="pt-3 border-t flex items-center justify-center text-xs" style="border-color:var(--v-bdr)">
                <p class="text-[11px] font-medium text-center" style="color:var(--v-fg3)">
                    Authentication is required to unlock your personalized study workspace and keep your progress synced.
                </p>
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

    const existingIdx = window.appState.habits.findIndex(h => h.name.trim().toLowerCase() === item.name.toLowerCase());

    if (existingIdx !== -1) {
        // Dismark to cancel that habit
        const removedName = window.appState.habits[existingIdx].name;
        window.appState.habits.splice(existingIdx, 1);
        obLastHabitAddedFeedback = '';
        saveState();
        renderOnboardingWizardStep('step_d');
        if (typeof showNotification === 'function') {
            showNotification("Habit Cancelled", `Removed "${removedName}" from your active habits.`, "info");
        }
        return;
    }

    // Mark to add habit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = formatDateKey(today);
    const now = Date.now();
    const logs = {};
    logs[todayKey] = true;

    window.appState.habits.unshift({
        id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
        name: item.name,
        category: item.category || 'Health',
        color: item.color || 'blue',
        icon: item.icon || '🌱',
        targetPerWeek: item.targetPerWeek || 7,
        logs: logs,
        completedToday: true,
        completedAt: now,
        isDefaultHabit: false
    });
    obLastHabitAddedFeedback = item.name;
    saveState();
    renderOnboardingWizardStep('step_d');
    if (typeof showNotification === 'function') {
        showNotification("Habit Added!", `Added "${item.name}" to your habits.`, "habit");
    }
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

// Explicit window exports for inline HTML event handlers
window.handleOnboardingSignInSubmit = handleOnboardingSignInSubmit;
window.handleOnboardingSignUpSubmit = handleOnboardingSignUpSubmit;
window.handleOnboardingForgotSubmit = handleOnboardingForgotSubmit;
window.openOnboardingAuthScreen = openOnboardingAuthScreen;
window.completeLocalAccountFallback = completeLocalAccountFallback;
window.toggleObPasswordVisibility = toggleObPasswordVisibility;
window.startGuestOnboardingFlow = startGuestOnboardingFlow;
window.skipSetupAndGoHomeNow = skipSetupAndGoHomeNow;


function startGuestOnboardingFlow() {
    showNotification("Sign In Required 🔒", "Please sign in or create an account to use FocusPulse.", "info");
    openOnboardingAuthScreen('signup');
}

function skipSetupAndGoHomeNow() {
    if (!window.appState || window.appState.userType !== 'authenticated') {
        showNotification("Account Required 🔒", "Please sign in or create an account to access the dashboard.", "warning");
        openOnboardingAuthScreen('signin');
        return;
    }
    closeOnboardingShell();
    switchAppView('home', false);
}
