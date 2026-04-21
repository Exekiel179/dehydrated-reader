$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.runtime\auth-assistant'

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

Write-Host '正在安装本地登录助手浏览器运行时...'
Push-Location $projectRoot
try {
  & npx playwright install chromium
}
finally {
  Pop-Location
}

Write-Host "本地登录助手已就绪: $runtimeRoot"
