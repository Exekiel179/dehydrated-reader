$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot '.runtime\crawl4ai'
$venvRoot = Join-Path $runtimeRoot '.venv'
$pythonExe = Join-Path $venvRoot 'Scripts\python.exe'
$requirementsFile = Join-Path $projectRoot 'server\requirements-crawl4ai.txt'

function Resolve-Python {
  $candidates = @(
    'py -3.11',
    'python'
  )

  foreach ($candidate in $candidates) {
    try {
      if ($candidate -eq 'py -3.11') {
        & py -3.11 --version | Out-Null
        return @{ Command = 'py'; Args = @('-3.11') }
      }

      & python --version | Out-Null
      return @{ Command = 'python'; Args = @() }
    } catch {
      continue
    }
  }

  throw '未找到 Python 3.11+。请先安装 Python，再重新运行 setup:crawl4ai。'
}

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if (-not (Test-Path $pythonExe)) {
  $python = Resolve-Python
  & $python.Command @($python.Args + @('-m', 'venv', $venvRoot))
}

& $pythonExe -m pip install --upgrade pip
& $pythonExe -m pip install -r $requirementsFile
& $pythonExe -m playwright install chromium

Write-Host ''
Write-Host 'Crawl4AI 运行时已安装完成。'
Write-Host "Python: $pythonExe"
Write-Host "Runtime: $runtimeRoot"
