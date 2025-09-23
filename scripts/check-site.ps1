param(
  [string]$Url = "https://localhost:5173"
)

Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public static class DevHttpsTrustOverride {
    public static bool Bypass(object sender, X509Certificate certificate, X509Chain chain, SslPolicyErrors errors) => true;
}
"@
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = [System.Net.Security.RemoteCertificateValidationCallback] { param($sender,$cert,$chain,$errors) return $true }

$ok = $false
for ($i=0; $i -lt 5; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    if ($resp.StatusCode -ge 200) { $ok = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 800
}

if ($ok) { Write-Host "OK"; exit 0 } else { Write-Host "DOWN"; exit 1 }

