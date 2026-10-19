param(
  [Parameter(Mandatory)][ValidateSet('test', 'prod')][string]$Target,
  [switch]$ConfirmLive
)

$ErrorActionPreference = 'Stop'
$Server = 'root@37.148.211.222'
$Files = @(
  'index.html',
  'legal.html',
  'styles.css',
  'info.css',
  'script.js',
  'news.js',
  'articles.json',
  'cookie-settings.js',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml'
)
$RemoteDir = if ($Target -eq 'test') { '/var/www/wrldsi-test' } else { '/var/www/wrldsi' }

if ($Target -eq 'prod' -and -not $ConfirmLive) {
  $Answer = Read-Host 'Upload these files to the LIVE WRLDSI site? Type evet to continue'
  if ($Answer -cne 'evet') { Write-Host 'Cancelled.'; return }
}

Push-Location $PSScriptRoot
try {
  foreach ($File in $Files) {
    if (-not (Test-Path -LiteralPath $File -PathType Leaf)) {
      throw "Required file not found: $File"
    }
  }

  scp -q -o BatchMode=yes $Files "${Server}:${RemoteDir}/"
  if ($LASTEXITCODE -ne 0) { throw 'Upload failed.' }

  $RemoteFiles = ($Files | ForEach-Object { "$RemoteDir/$_" }) -join ' '
  ssh -o BatchMode=yes $Server "chown root:www-data $RemoteFiles && chmod 644 $RemoteFiles"
  if ($LASTEXITCODE -ne 0) { throw 'Could not fix remote file permissions.' }

  foreach ($File in $Files) {
    $LocalHash = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLower()
    $RemoteHash = ssh -o BatchMode=yes $Server "sha256sum $RemoteDir/$File"
    if ($LASTEXITCODE -ne 0) { throw "Could not verify remote file: $File" }
    $RemoteHash = ($RemoteHash -split '\s+')[0]
    if ($LocalHash -ne $RemoteHash) { throw "Hash mismatch for $File." }
  }

  Write-Host "Deploy and SHA-256 verification complete: $Target ($RemoteDir)."
}
finally {
  Pop-Location
}
