# PowerShell helper to validate data/grants.json and sync data/grants-data.js
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$JsonPath = Join-Path $Root "data\grants.json"
$JsPath = Join-Path $Root "data\grants-data.js"

$raw = [System.IO.File]::ReadAllText($JsonPath, [System.Text.Encoding]::UTF8)
$parsed = $raw | ConvertFrom-Json

if (-not $parsed.grants -or $parsed.grants.Count -eq 0) {
    throw "No grants found in data/grants.json"
}

$ids = $parsed.grants | ForEach-Object { $_.id }
$dups = $ids | Group-Object | Where-Object { $_.Count -gt 1 }
if ($dups) {
    throw "Duplicate grant IDs detected: $($dups.Name -join ', ')"
}

$jsContent = "// Auto-generated from data/grants.json`nwindow.NAAMII_PORTAL_DATA = " + $raw.Trim() + ";`n"
[System.IO.File]::WriteAllText($JsPath, $jsContent, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Validated $($parsed.grants.Count) grants and synced data/grants-data.js successfully."
