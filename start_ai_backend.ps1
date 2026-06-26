# Start the Borne Farms AI backend (Flask) on http://127.0.0.1:5000
# Run this in PowerShell: .\start_ai_backend.ps1

$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $dir

Write-Host "Starting Borne Farms AI backend..." -ForegroundColor Cyan
Write-Host "URL: http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

python ai_backend.py
