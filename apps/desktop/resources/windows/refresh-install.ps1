# Runs on every packaged launch and after an update applies.
#
# Squirrel keeps every installed app-<version> folder and leaves the previous
# build running. Both copies register the same AppUserModelID, so Explorer can
# keep drawing the old build's taskbar artwork. Keep the newest build plus its
# immediate predecessor: one icon wins, and the previous build stays available
# for the in-app rollback.
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA "UsageAtlas"),
  [string]$CurrentExe = ""
)

$ErrorActionPreference = "SilentlyContinue"
if (-not (Test-Path -LiteralPath $InstallRoot)) { exit 0 }

$builds = Get-ChildItem -LiteralPath $InstallRoot -Directory |
  Where-Object { $_.Name -match '^app-\d+\.\d+\.\d+' } |
  Sort-Object { [version]($_.Name -replace '^app-', '') } -Descending
if ($builds.Count -eq 0) { exit 0 }

$newest = $builds[0]
$newestExe = Join-Path $newest.FullName "UsageAtlas.exe"
if (-not (Test-Path -LiteralPath $newestExe)) { exit 0 }

# Never stop the process that asked for the cleanup. Everything else under this
# install root is a previous build, including copies Explorer started earlier.
$current = if ($CurrentExe) { [System.IO.Path]::GetFullPath($CurrentExe) } else { "" }
Get-CimInstance Win32_Process -Filter "Name = 'UsageAtlas.exe'" |
  Where-Object {
    $_.ExecutablePath -and
    $_.ExecutablePath.StartsWith($InstallRoot, [System.StringComparison]::OrdinalIgnoreCase) -and
    [System.IO.Path]::GetFullPath($_.ExecutablePath) -ne $current
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Milliseconds 900

$keep = @($builds[0].FullName)
if ($builds.Count -gt 1) { $keep += $builds[1].FullName }
# Never delete the folder the running window came from, even after a rollback.
if ($CurrentExe) {
  $currentDir = Split-Path -Parent ([System.IO.Path]::GetFullPath($CurrentExe))
  if ($keep -notcontains $currentDir) { $keep += $currentDir }
}
foreach ($build in $builds) {
  if ($keep -contains $build.FullName) { continue }
  Remove-Item -LiteralPath $build.FullName -Recurse -Force
}

# The taskbar button reads the ICO from disk; Explorer caches it per
# AppUserModelID, so ask the shell to re-read icons after the swap. The
# shortcuts themselves are rewritten by the main process, which can preserve
# their AppUserModelID (WScript.Shell would drop it).
$icon = Join-Path $newest.FullName "resources\icons\usageatlas.ico"
if (Test-Path -LiteralPath $icon) { ie4uinit.exe -show }
