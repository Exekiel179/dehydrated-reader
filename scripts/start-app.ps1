$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
  Write-Host 'node_modules 不存在，正在安装依赖...'
  npm install
}

Write-Host '正在同时启动前端与后端开发服务...'
npm run dev
