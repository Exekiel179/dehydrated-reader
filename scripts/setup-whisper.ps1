$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RuntimeRoot = Join-Path $ProjectRoot ".runtime\whisper"
$VenvPath = Join-Path $RuntimeRoot ".venv"
$PythonPath = Join-Path $VenvPath "Scripts\python.exe"
$Model = if ($env:WHISPER_MODEL) { $env:WHISPER_MODEL } else { "small" }
$CacheDir = Join-Path $RuntimeRoot "models"

New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null

if (-not $env:HF_ENDPOINT) {
  $env:HF_ENDPOINT = "https://hf-mirror.com"
}

if (-not $env:HF_HUB_DISABLE_XET) {
  $env:HF_HUB_DISABLE_XET = "1"
}

if (-not (Test-Path $PythonPath)) {
  $Bootstrap = if ($env:PYTHON_BOOTSTRAP) { $env:PYTHON_BOOTSTRAP } else { "python" }
  & $Bootstrap -m venv $VenvPath
}

& $PythonPath -m pip install --upgrade pip
& $PythonPath -m pip install --upgrade faster-whisper

if ($env:WHISPER_PREWARM -eq "1") {
  & $PythonPath (Join-Path $ProjectRoot "server\whisper_transcribe.py") --model $Model --cache-dir $CacheDir --prewarm
  Write-Host "Whisper model ready: $Model"
}

Write-Host "Whisper runtime ready: $PythonPath"
