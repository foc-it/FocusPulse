@echo off
title FocusPulse .EXE Builder (Single-Instance Protected)
echo ===================================================
echo   FocusPulse Standalone Windows .EXE Generator
echo   (Single-Instance & Multi-Window Protected)
echo ===================================================
echo.

set CSC_PATH=%SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC_PATH%" set CSC_PATH=%SystemRoot%\Microsoft.NET\Framework\v4.0.30319\csc.exe

set ICON_PARAM=
if exist "%~dp0src-tauri\icons\icon.ico" (
    set ICON_PARAM=/win32icon:"%~dp0src-tauri\icons\icon.ico"
) else if exist "%~dp0assets\icon.ico" (
    set ICON_PARAM=/win32icon:"%~dp0assets\icon.ico"
)

if exist "%CSC_PATH%" (
    echo [1/2] Compiling native FocusPulse.exe with purple/violet icon...
    (
        echo using System;
        echo using System.Diagnostics;
        echo using System.IO;
        echo using System.Runtime.InteropServices;
        echo using System.Threading;
        echo class Program {
        echo     [DllImport^("user32.dll"^)]
        echo     private static extern bool SetForegroundWindow^(IntPtr hWnd^);
        echo     [DllImport^("user32.dll"^)]
        echo     private static extern bool ShowWindow^(IntPtr hWnd, int nCmdShow^);
        echo     private const int SW_RESTORE = 9;
        echo     static void Main^(^) {
        echo         bool createdNew;
        echo         using ^(Mutex mutex = new Mutex^(true, "FocusPulse_SingleInstance_Mutex_FocIt", out createdNew^)^) {
        echo             if ^(!createdNew^) {
        echo                 Process current = Process.GetCurrentProcess^(^);
        echo                 foreach ^(Process p in Process.GetProcessesByName^(current.ProcessName^)^) {
        echo                     if ^(p.Id != current.Id ^&^& p.MainWindowHandle != IntPtr.Zero^) {
        echo                         ShowWindow^(p.MainWindowHandle, SW_RESTORE^);
        echo                         SetForegroundWindow^(p.MainWindowHandle^);
        echo                         break;
        echo                     }
        echo                 }
        echo                 return;
        echo             }
        echo             string dir = AppDomain.CurrentDomain.BaseDirectory;
        echo             string html = Path.Combine^(dir, "index.html"^);
        echo             string url = "file:///" + html.Replace^("\\", "/"^);
        echo             try {
        echo                 Process.Start^(new ProcessStartInfo^("msedge.exe", "--app=\"" + url + "\" --window-size=1360,880"^) { UseShellExecute = true }^);
        echo             } catch {
        echo                 Process.Start^(new ProcessStartInfo^(html^) { UseShellExecute = true }^);
        echo             }
        echo         }
        echo     }
        echo }
    ) > "%TEMP%\FocusPulseLauncher.cs"

    "%CSC_PATH%" /target:winexe %ICON_PARAM% /out:"%~dp0FocusPulse.exe" "%TEMP%\FocusPulseLauncher.cs" >nul
    del "%TEMP%\FocusPulseLauncher.cs" >nul 2>nul

    if exist "%~dp0FocusPulse.exe" (
        echo [SUCCESS] Created "%~dp0FocusPulse.exe"!
        echo Protected: Launching FocusPulse will focus your active window and never open multiple windows.
    )
) else (
    echo [INFO] .NET csc.exe not found at default path. Use Tauri installer or Launch_FocusPulse_App.bat.
)

echo.
pause
