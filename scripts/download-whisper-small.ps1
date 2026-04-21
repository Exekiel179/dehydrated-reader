$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$TargetDir = Join-Path $ProjectRoot ".runtime\whisper\models\Systran\faster-whisper-small"
$BaseUrl = if ($env:HF_ENDPOINT) { $env:HF_ENDPOINT.TrimEnd("/") } else { "https://hf-mirror.com" }
$Repo = "Systran/faster-whisper-small"
$Files = @(
  "config.json",
  "model.bin",
  "tokenizer.json",
  "vocabulary.txt"
)

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null

foreach ($File in $Files) {
  $Target = Join-Path $TargetDir $File
  if ((Test-Path $Target) -and ((Get-Item $Target).Length -gt 0)) {
    Write-Host "exists: $Target"
    continue
  }

  $Url = "$BaseUrl/$Repo/resolve/main/$File"
  Write-Host "downloading: $Url"
  try {
    Start-BitsTransfer -Source $Url -Destination $Target -DisplayName "download $File" -Description $Repo
  } catch {
    Write-Warning "BITS failed for $File, fallback to Invoke-WebRequest."
    Invoke-WebRequest -Uri $Url -OutFile $Target
  }
}

Write-Host "Whisper small model ready: $TargetDir"
