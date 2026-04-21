$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RuntimeRoot = Join-Path $ProjectRoot ".runtime\yt-dlp"
$VenvPath = Join-Path $RuntimeRoot ".venv"
$PythonPath = Join-Path $VenvPath "Scripts\python.exe"

New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null

if (-not (Test-Path $PythonPath)) {
  $Bootstrap = if ($env:PYTHON_BOOTSTRAP) { $env:PYTHON_BOOTSTRAP } else { "python" }
  & $Bootstrap -m venv $VenvPath
}

& $PythonPath -m pip install --upgrade pip
& $PythonPath -m pip install --upgrade yt-dlp

Write-Host "yt-dlp runtime ready: $PythonPath -m yt_dlp"
