$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.runtime\social-bridge'
$venvRoot = Join-Path $runtimeRoot '.venv'
$pythonExe = Join-Path $venvRoot 'Scripts\python.exe'

$cvCatRoot = if ($env:CV_CAT_ROOT) { $env:CV_CAT_ROOT } else { 'F:\Projects\媒体信息投放\cv-cat' }
$wechatSpiderRoot = if ($env:WECHAT_SPIDER_ROOT) { $env:WECHAT_SPIDER_ROOT } else { 'F:\Projects\公众号文章爬虫\wechat_spider\wechat_spider' }
$xhsRequirements = Join-Path $cvCatRoot 'Spider_XHS\requirements.txt'
$douyinRequirements = Join-Path $cvCatRoot 'DouYin_Spider\requirements.txt'
$wechatRequirements = Join-Path $wechatSpiderRoot 'requirements.txt'
$xhsNodeProject = Join-Path $cvCatRoot 'Spider_XHS'
$douyinNodeProject = Join-Path $cvCatRoot 'DouYin_Spider'
$bootstrapPython = if ($env:PYTHON_BOOTSTRAP) { $env:PYTHON_BOOTSTRAP } else { 'python' }

if (-not (Test-Path $xhsRequirements)) {
  throw "未找到 Spider_XHS requirements: $xhsRequirements"
}

if (-not (Test-Path $douyinRequirements)) {
  throw "未找到 DouYin_Spider requirements: $douyinRequirements"
}

if (-not (Test-Path $wechatRequirements)) {
  throw "未找到 wechat_spider requirements: $wechatRequirements"
}

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if (-not (Test-Path $pythonExe)) {
  Write-Host '正在创建社媒桥接专用虚拟环境...'
  & $bootstrapPython -m venv $venvRoot
}

Write-Host '正在安装 Spider_XHS、DouYin_Spider 与 wechat_spider 依赖...'
& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r $xhsRequirements -r $douyinRequirements -r $wechatRequirements

if (Test-Path (Join-Path $xhsNodeProject 'package.json')) {
  Write-Host '正在安装 Spider_XHS Node 依赖...'
  Push-Location $xhsNodeProject
  try {
    & npm install --no-fund --no-audit
  }
  finally {
    Pop-Location
  }
}

if (Test-Path (Join-Path $douyinNodeProject 'package.json')) {
  Write-Host '正在安装 DouYin_Spider Node 依赖...'
  Push-Location $douyinNodeProject
  try {
    & npm install --no-fund --no-audit
  }
  finally {
    Pop-Location
  }
}

Write-Host "社媒桥接环境已就绪: $pythonExe"
