# FocusPulse Branding & Asset Guide

This directory documents the official visual and branding assets used across the FocusPulse Web App, Windows Desktop Installer (`.exe`), Android Application (`.apk`), and GitHub repository.

## Core Brand Assets (`assets/`)

| File | Purpose |
| :--- | :--- |
| `assets/logo.png` | Primary transparent FocusPulse glyph dynamically tinted by `--v-accent` in the UI topbar and sidebar. |
| `assets/icon.png` | Square rounded-badge application icon used in `README.md` and installer metadata. |
| `assets/title.png` | Wide FocusPulse wordmark/banner image used in `README.md` and release headers. |
| `assets/favicon.png` | Browser tab and PWA favicon (`64x64` PNG). |
| `assets/focit.png` | Official **Foc-It** organization emblem (`https://github.com/foc-it`). |
| `assets/azmee7.png` | Creator avatar for **azmee7 (Azmi)** (`https://github.com/azmee7`). |
| `assets/badge_github.png` | Official "Get it on GitHub" download badge for `README.md`. |

## Platform & Promotional Badges (`assets/additional/`)

- `badge_windows.png` — Windows `.exe` installer download badge.
- `badge_android.png` — Android signed `.apk` download badge.
- `badge_web.png` — Browser / Web App launch badge.
- `rate_us.png` — GitHub Star / community support badge.

## Application Screenshots (`assets/screenshots/`)

Contains genuine screenshots captured directly from the working FocusPulse application interface (displaying sample user **Patrick**):
- `Timer.png` — Home & Focus dashboard with Smart Pomodoro Timer and Museo Sans 900 tabular numerals.
- `Tasks.png` — Smart Task Tracker and Active Courses (`CS101`, `Calculus`, `Physics`).
- `Habits.png` — 7-Day Habit Flow interactive weekly check-in grid and streak analytics.
- `Zenith.png` — Zenith AI Coach chat, study plan, and Quick Study Notes.
- `Themes.png` — Solid Theme Mode and Liquid Glass appearance customization.
- `Settings.png` — Application version status, GitHub Releases update checker, and credits.

## Native Platform Icons (`src-tauri/icons/`)

Generated from `assets/logo.png` for Tauri v2 desktop & mobile packaging:
- `icon.ico` — Multi-resolution Windows executable & installer icon (`16px` to `256px`).
- `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png` — Cross-platform window, tray, and Android launcher icons.
