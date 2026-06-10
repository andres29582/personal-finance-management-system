$ErrorActionPreference = 'Stop'

$checks = @(
  @{ Name = 'Backend health'; Url = 'http://localhost:3000/health'; TimeoutSec = 8 },
  @{ Name = 'Frontend'; Url = 'http://localhost:8081'; TimeoutSec = 30 }
)

foreach ($check in $checks) {
  try {
    $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec $check.TimeoutSec
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
      throw "$($check.Name) returned HTTP $($response.StatusCode)"
    }

    Write-Host "$($check.Name) OK: $($check.Url) -> HTTP $($response.StatusCode)"
  } catch {
    Write-Error "$($check.Name) failed at $($check.Url): $($_.Exception.Message)"
    exit 1
  }
}
