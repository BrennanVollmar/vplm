param(
  [string]$Name = "VPLM Dev Server",
  [string]$Target = "scripts\\dev.cmd"
)

$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop ("$Name.lnk")

# Determine repo root: parent of the scripts directory
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptsDir '..')).Path

# Absolute target to scripts\dev.cmd inside the repo
$targetPath = (Resolve-Path (Join-Path $repoRoot $Target)).Path

if (-not (Test-Path $targetPath)) {
  Write-Host "ERROR: Target not found: $targetPath" -ForegroundColor Red
  exit 1
}

$sc = $shell.CreateShortcut($shortcutPath)
$sc.TargetPath = $targetPath
$sc.WorkingDirectory = $repoRoot
$sc.WindowStyle = 7
$sc.Description = "Start the VPLM Vite dev server"
$sc.IconLocation = "%SystemRoot%\\System32\\SHELL32.dll, 220"
$sc.Save()

Write-Host "Created shortcut: $shortcutPath -> $targetPath" -ForegroundColor Green
