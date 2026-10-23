param([ValidateSet('Diagnostics')][string]$Phase = 'Diagnostics')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# CI-only diagnostic. No token, account, host policy or existing authority changes.
# WindowsIdentity.Owner exposes TOKEN_OWNER, which can differ from TokenUser:
# https://learn.microsoft.com/en-us/dotnet/api/system.security.principal.windowsidentity.owner
# https://learn.microsoft.com/en-us/windows/win32/secauthz/owner-of-a-new-object
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or $env:CI -ne 'true') {
  throw 'WINDOWS_PRIVATE_QUALIFICATION_REQUIRES_DISPOSABLE_GITHUB_CI'
}
function Get-OwnerObservation([string]$Path) {
  $acl = Get-Acl -LiteralPath $Path
  return [ordered]@{
    ownerSid = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
    protected = $acl.AreAccessRulesProtected
    access = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object {
      [ordered]@{sid = $_.IdentityReference.Value; type = [string]$_.AccessControlType; rights = [long]$_.FileSystemRights; inherited = $_.IsInherited}
    })
  }
}
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
try {
  $sid = $identity.User.Value
  $observation = [ordered]@{
    phase = $Phase
    userSid = $sid
    tokenOwnerSid = $identity.Owner.Value
    administratorEnabled = ([System.Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
  }
  $probeParent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $probe = Join-Path $probeParent ('dmk-windows-owner-' + [Guid]::NewGuid().ToString('N'))
  $created = $false
  try {
    New-Item -ItemType Directory -Path $probe -ErrorAction Stop | Out-Null
    $created = $true
    if ((Get-Item -LiteralPath $probe).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {throw 'OWNER_PROBE_LINK_REJECTED'}
    $file = Join-Path $probe 'exclusive-probe.txt'
    $stream = [System.IO.File]::Open($file, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    try {$stream.WriteByte(1)} finally {$stream.Dispose()}
    $observation.directoryBefore = Get-OwnerObservation $probe
    $observation.fileBefore = Get-OwnerObservation $file
    # Match genuine new-root DACL hardening while recording its owner unchanged.
    & icacls.exe $probe '/inheritance:r' '/grant:r' "*$($sid):(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) {throw 'OWNER_PROBE_DACL_FAILED'}
    $observation.directoryAfter = Get-OwnerObservation $probe
    $observation.fileAfter = Get-OwnerObservation $file
    Write-Output ('WINDOWS_PRIVATE_OWNER_DIAGNOSTIC ' + ($observation | ConvertTo-Json -Depth 8 -Compress))
  } finally {
    if ($created) {
      # Only the exclusively created probe with its exact parent/name is removed.
      $resolved = [System.IO.Path]::GetFullPath($probe)
      if ([System.IO.Path]::GetDirectoryName($resolved) -ne $probeParent.TrimEnd('\') -or [System.IO.Path]::GetFileName($resolved) -notmatch '^dmk-windows-owner-[a-f0-9]{32}$') {throw 'OWNER_PROBE_CLEANUP_PATH_REJECTED'}
      if ((Get-Item -LiteralPath $resolved).Attributes -band [System.IO.FileAttributes]::ReparsePoint) {throw 'OWNER_PROBE_CLEANUP_LINK_REJECTED'}
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
} finally {$identity.Dispose()}
