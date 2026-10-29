# ============================================================================
# FocusPulse — Automated Android APK Keystore & Signing Script (FP-01)
# Signs app-universal-release-unsigned.apk -> FocusPulse_1.0.0_Android_Signed.apk
# ============================================================================
$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " FocusPulse Android APK Signer (v1.0.0)" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$UnsignedApk = Join-Path $ProjectRoot "src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk"
$SignedApk   = Join-Path $ProjectRoot "FocusPulse_1.0.0_Android_Signed.apk"
$AlignedApk  = Join-Path $ProjectRoot "src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-aligned.apk"
$Keystore    = Join-Path $ProjectRoot "focuspulse-release-key.jks"
$KeyAlias    = "focuspulse"
$StorePass   = "focuspulse123"

if (-not (Test-Path $UnsignedApk)) {
    Write-Host "[!] Unsigned APK not found at:" -ForegroundColor Yellow
    Write-Host "    $UnsignedApk" -ForegroundColor Yellow
    Write-Host "    Run 'npx tauri android build --apk' first, then re-run this script." -ForegroundColor Yellow
    exit 1
}

# 1. Locate keytool.exe
$Keytool = "keytool"
$JbrKeytool = "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe"
if (Test-Path $JbrKeytool) {
    $Keytool = $JbrKeytool
}

# 2. Generate release keystore if it doesn't exist yet (gitignored)
if (-not (Test-Path $Keystore)) {
    Write-Host "[1/3] Creating Android signing keystore ($Keystore)..." -ForegroundColor Green
    & $Keytool -genkeypair -v `
        -keystore $Keystore `
        -alias $KeyAlias `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -storepass $StorePass `
        -keypass $StorePass `
        -dname "CN=FocusPulse, OU=Foc-It, O=Foc-It, L=Kerala, S=KL, C=IN"
} else {
    Write-Host "[1/3] Using existing keystore: $Keystore" -ForegroundColor Green
}

# 3. Locate Android SDK build-tools (zipalign.exe & apksigner.bat)
$SdkRoot = "$env:LOCALAPPDATA\Android\Sdk"
$BuildToolsDir = Join-Path $SdkRoot "build-tools"
$ZipAlign = $null
$ApkSigner = $null

if (Test-Path $BuildToolsDir) {
    $LatestBt = Get-ChildItem $BuildToolsDir -Directory | Sort-Object Name -Descending | Select-Object -First 1
    if ($LatestBt) {
        $CandidateZip = Join-Path $LatestBt.FullName "zipalign.exe"
        $CandidateSign = Join-Path $LatestBt.FullName "apksigner.bat"
        if (Test-Path $CandidateZip) { $ZipAlign = $CandidateZip }
        if (Test-Path $CandidateSign) { $ApkSigner = $CandidateSign }
    }
}

if ($ZipAlign -and $ApkSigner) {
    Write-Host "[2/3] Aligning APK with zipalign..." -ForegroundColor Green
    if (Test-Path $AlignedApk) { Remove-Item $AlignedApk -Force }
    & $ZipAlign -v -p 4 $UnsignedApk $AlignedApk

    Write-Host "[3/3] Signing APK with apksigner (v2/v3 signature)..." -ForegroundColor Green
    & $ApkSigner sign `
        --ks $Keystore `
        --ks-key-alias $KeyAlias `
        --ks-pass "pass:$StorePass" `
        --key-pass "pass:$StorePass" `
        --out $SignedApk `
        $AlignedApk

    Write-Host ""
    Write-Host "SUCCESS! Signed installable Android APK created at:" -ForegroundColor Green
    Write-Host "  $SignedApk" -ForegroundColor White
} else {
    Write-Host "[!] Android SDK build-tools (apksigner.bat) not found under $BuildToolsDir" -ForegroundColor Red
    exit 1
}
