# =========================================================================
# Self-Signed TLS Certificate Generator (PowerShell for Windows)
# Generates local RSA 4096-bit TLS certificate for Aarogya-Drishti HTTPS testing
# =========================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Generating local TLS certificates for Aarogya-Drishti using OpenSSL..." -ForegroundColor Cyan

$privKeyPath = Join-Path $ScriptDir "privkey.pem"
$fullChainPath = Join-Path $ScriptDir "fullchain.pem"

if (Get-Command openssl -ErrorAction SilentlyContinue) {
    openssl req -x509 -nodes -days 365 -newkey rsa:4096 `
      -keyout $privKeyPath `
      -out $fullChainPath `
      -subj "/C=IN/ST=Andhra Pradesh/L=Paderu/O=ITDA Paderu Tribal Health/OU=Aarohan Hackathon Simulation/CN=localhost" `
      -addext "subjectAltName = DNS:localhost,IP:127.0.0.1"
    
    Write-Host "TLS certificates successfully generated at:" -ForegroundColor Green
    Write-Host "  - Certificate: $fullChainPath"
    Write-Host "  - Private Key: $privKeyPath"
} else {
    Write-Warning "OpenSSL command line tool not found in PATH. Please install OpenSSL or Git for Windows, or use New-SelfSignedCertificate."
}
