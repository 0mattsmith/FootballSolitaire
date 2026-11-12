<#
.SYNOPSIS
  Build, optionally bump version + build signed Android APK, push to GitHub, and publish Release.

.EXAMPLE
  .\push.ps1 "Added new stadium cards & fixes" --bump
  .\push.ps1 "Quick web layout tweak"
#>

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Parse positional message and --bump / -Bump / --no-apk flags
$Message = ""
$Bump = $false
$SkipApk = $false

foreach ($arg in $args) {
    if ($arg -eq "--bump" -or $arg -eq "-Bump" -or $arg -eq "-bump") {
        $Bump = $true
    } elseif ($arg -eq "--no-apk" -or $arg -eq "-NoApk") {
        $SkipApk = $true
    } elseif (-not $Message) {
        $Message = $arg
    } else {
        $Message = "$Message $arg"
    }
}

if ([string]::IsNullOrWhiteSpace($Message)) {
    Write-Host 'Usage: .\push.ps1 "update info" [--bump]' -ForegroundColor Yellow
    exit 1
}

# Read current version from package.json
$pkgPath = Join-Path $PSScriptRoot "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$currentVersion = [string]$pkg.version

# Read current versionCode from android/app/build.gradle
$gradlePath = Join-Path $PSScriptRoot "android\app\build.gradle"
$gradleText = Get-Content $gradlePath -Raw
$codeMatch = [regex]::Match($gradleText, 'versionCode\s+(\d+)')
$currentCode = if ($codeMatch.Success) { [int]$codeMatch.Groups[1].Value } else { 1 }

$newVersion = $currentVersion
$newCode = $currentCode

if ($Bump) {
    $parts = $currentVersion.Split('.')
    $maj = [int]$parts[0]
    $min = [int]$parts[1]
    $pat = [int]$parts[2] + 1
    $newVersion = "$maj.$min.$pat"
    $newCode = $currentCode + 1

    Write-Host "Bumping version: v$currentVersion ($currentCode) -> v$newVersion ($newCode)" -ForegroundColor Cyan

    # Update package.json
    $pkgRaw = Get-Content $pkgPath -Raw
    $pkgRaw = [regex]::Replace($pkgRaw, '"version"\s*:\s*"[^"]+"', "`"version`": `"$newVersion`"", 1)
    [System.IO.File]::WriteAllText($pkgPath, $pkgRaw, $utf8NoBom)

    # Update android/app/build.gradle
    $gradleText = [regex]::Replace($gradleText, 'versionCode\s+\d+', "versionCode $newCode")
    $gradleText = [regex]::Replace($gradleText, 'versionName\s+"[^"]+"', "versionName `"$newVersion`"")
    [System.IO.File]::WriteAllText($gradlePath, $gradleText, $utf8NoBom)
}

# Always keep src/data/appVersion.ts and public/version.json synced with current version & notes
$escapedNotes = $Message.Replace('\', '\\').Replace("'", "\'").Replace("`r", "").Replace("`n", " ")
$appVerTs = @"
export const APP_INFO = {
  version: '$newVersion',
  versionCode: $newCode,
  releaseNotes: '$escapedNotes',
  githubOwner: '0mattsmith',
  githubRepo: 'FootballSolitaire',
} as const;
"@
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "src\data\appVersion.ts"), $appVerTs, $utf8NoBom)

$publishedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$verJsonObj = [ordered]@{
    version      = $newVersion
    versionCode  = $newCode
    releaseNotes = $Message
    publishedAt  = $publishedAt
}
[System.IO.File]::WriteAllText((Join-Path $PSScriptRoot "public\version.json"), ($verJsonObj | ConvertTo-Json), $utf8NoBom)

# Run tests & production web build
Write-Host "Running unit tests..." -ForegroundColor Cyan
& npm.cmd run test
if ($LASTEXITCODE -ne 0) { throw "Unit tests failed. Aborting push." }

Write-Host "Building web bundle..." -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw "Web build failed. Aborting push." }

# Sync Capacitor web assets into Android
Write-Host "Syncing assets to Android..." -ForegroundColor Cyan
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw "Capacitor sync failed." }

# Ensure consistent release signing keystore exists locally
$keystorePath = Join-Path $PSScriptRoot "android\release.keystore"
$keystorePropsPath = Join-Path $PSScriptRoot "android\keystore.properties"
if (-not (Test-Path $keystorePath)) {
    Write-Host "Generating release signing keystore (one-time)..." -ForegroundColor Yellow
    & keytool -genkeypair -v -keystore $keystorePath -alias footballsolitaire -keyalg RSA -keysize 2048 -validity 10000 -storepass football2026 -keypass football2026 -dname "CN=Matt Smith, O=FootballSolitaire, C=GB"
    if ($LASTEXITCODE -ne 0) { throw "keytool keystore generation failed." }
}
if (-not (Test-Path $keystorePropsPath)) {
    $propsContent = @"
storeFile=../release.keystore
storePassword=football2026
keyAlias=footballsolitaire
keyPassword=football2026
"@
    [System.IO.File]::WriteAllText($keystorePropsPath, $propsContent, $utf8NoBom)
}

# Ensure android/local.properties points to Android SDK if missing
$localPropsPath = Join-Path $PSScriptRoot "android\local.properties"
if (-not (Test-Path $localPropsPath)) {
    $sdkDir = $env:ANDROID_HOME
    if (-not $sdkDir) { $sdkDir = $env:ANDROID_SDK_ROOT }
    if (-not $sdkDir) { $sdkDir = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
    if (Test-Path $sdkDir) {
        $escapedSdk = $sdkDir.Replace('\', '\\').Replace(':', '\:')
        [System.IO.File]::WriteAllText($localPropsPath, "sdk.dir=$escapedSdk`n", $utf8NoBom)
    }
}

# Build signed Android APK when bumping or when no APK has been built yet
$releasesDir = Join-Path $PSScriptRoot "releases"
$apkDest = Join-Path $releasesDir "FootballSolitaire-v$newVersion.apk"
if (($Bump -or -not (Test-Path $apkDest)) -and -not $SkipApk) {
    Write-Host "Building signed Android APK (v$newVersion)..." -ForegroundColor Cyan
    Push-Location (Join-Path $PSScriptRoot "android")
    try {
        & .\gradlew.bat assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "Android Gradle assembleRelease failed." }
    } finally {
        Pop-Location
    }

    $builtApk = Join-Path $PSScriptRoot "android\app\build\outputs\apk\release\app-release.apk"
    if (-not (Test-Path $builtApk)) {
        throw "Expected APK not found at $builtApk"
    }
    New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
    Copy-Item $builtApk $apkDest -Force
    Write-Host "APK built: $apkDest" -ForegroundColor Green
}

# Commit & Push to GitHub
Write-Host "Committing and pushing to GitHub..." -ForegroundColor Cyan
& git add -A
$status = & git status --porcelain
if ($status) {
    & git commit -m "$Message"
    if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
}
& git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed." }

# Publish GitHub Release with APK when --bump (or if initial v1.0.0 release doesn't exist yet)
$tagName = "v$newVersion"
$existingRelease = $null
try {
    $existingRelease = & gh release view $tagName --json tagName 2>$null
} catch {}

if (($Bump -or -not $existingRelease) -and (Test-Path $apkDest)) {
    if ($existingRelease) {
        Write-Host "Updating existing GitHub Release $tagName..." -ForegroundColor Cyan
        & gh release upload $tagName $apkDest --clobber
    } else {
        Write-Host "Publishing GitHub Release $tagName with APK..." -ForegroundColor Cyan
        & gh release create $tagName $apkDest --title "Football Solitaire $tagName" --notes "$Message"
    }
    if ($LASTEXITCODE -ne 0) { throw "gh release failed." }
}

Write-Host ""
Write-Host "Done! Published v$newVersion ($Message)" -ForegroundColor Green
Write-Host "Web URL:     https://0mattsmith.github.io/FootballSolitaire/" -ForegroundColor Green
Write-Host "Release URL: https://github.com/0mattsmith/FootballSolitaire/releases/tag/$tagName" -ForegroundColor Green
