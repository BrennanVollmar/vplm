param(
  [string]$Port = "5173"
)

$cwd = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $cwd ..)

Write-Host "Starting Vite dev server on port $Port..." -ForegroundColor Green
$env:PORT = $Port
Start-Process -FilePath npm -ArgumentList @('--prefix','apps/vplm-portal','run','dev') -WindowStyle Minimized

Start-Sleep -Seconds 2
Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public static class DevHttpsTrustOverride {
    public static bool Bypass(object sender, X509Certificate certificate, X509Chain chain, SslPolicyErrors errors) => true;
}
"@
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = [System.Net.Security.RemoteCertificateValidationCallback] { param($sender,$cert,$chain,$errors) return $true }

$ok = $false
for ($i=0; $i -lt 30; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri "https://localhost:$Port" -TimeoutSec 2
    if ($resp.StatusCode -ge 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 800
}

if ($ok) {
  Write-Host "Site is up at https://localhost:$Port" -ForegroundColor Green
  Start-Process "https://localhost:$Port"
} else {
  Write-Host "Timed out waiting for https://localhost:$Port" -ForegroundColor Yellow
}

