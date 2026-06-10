param(
  [switch]$SkipLocalhost
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "== $Name =="
  & $Command
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$Arguments = @()
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Invoke-Step 'Backend tests' {
  Push-Location (Join-Path $root 'backendnest')
  try {
    Invoke-Native 'npm' @('test', '--', '--runInBand')
  } finally {
    Pop-Location
  }
}

Invoke-Step 'Backend build' {
  Push-Location (Join-Path $root 'backendnest')
  try {
    Invoke-Native 'npm' @('run', 'build')
  } finally {
    Pop-Location
  }
}

Invoke-Step 'Frontend tests' {
  Push-Location (Join-Path $root 'frontend')
  try {
    Invoke-Native 'npm' @('test', '--', '--runInBand')
  } finally {
    Pop-Location
  }
}

if (-not $SkipLocalhost) {
  Invoke-Step 'Localhost checks' {
    & (Join-Path $root 'scripts\verify-localhost.ps1')
  }
}

Write-Host ""
Write-Host "Verification completed."
