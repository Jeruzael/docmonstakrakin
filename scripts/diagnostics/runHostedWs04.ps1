param([switch]$Child)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# ACCEL-20261024 scoped diagnostic launcher. Never use a live authority or alter the host token.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows' -or $env:CI -ne 'true') {
  throw 'WS04_HOSTED_DIAGNOSTIC_REQUIRES_DISPOSABLE_GITHUB_CI'
}
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
try {
  $sid = $identity.User.Value
  if ($Child) {
    if ($identity.Owner.Value -ne $sid) { throw 'WS04_CHILD_OWNER_PROFILE_UNCONFIRMED' }
    foreach ($profile in @('inherited', 'sparse')) {
      # Preserve original WS01..WS04 order and warmup, stop before WS05.
      & node scripts/diagnostics/diagnoseWs04.mjs $profile prefix
      if ($LASTEXITCODE -ne 0) { throw "WS04_DIAGNOSTIC_OBSERVED_FAILURE: $profile" }
    }
    return
  }
  # Reuse exactly the reviewed CREATE_SUSPENDED / distinct-primary-token helper
  # as data, without executing or editing the original qualification script.
  $source = Join-Path $PSScriptRoot '../runWindowsPrivateQualification.ps1'
  $tokens = $null; $errors = $null
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
  if ($errors.Count) { throw 'WS04_ORIGINAL_HELPER_PARSE_FAILED' }
  $assignments = @($ast.FindAll({ param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
    $node.Left.VariablePath.UserPath -eq 'nativeDefinition'
  }, $true))
  if ($assignments.Count -ne 1) { throw 'WS04_ORIGINAL_NATIVE_HELPER_AMBIGUOUS' }
  $literal = $assignments[0].Right.Expression
  if ($literal -isnot [System.Management.Automation.Language.StringConstantExpressionAst]) { throw 'WS04_ORIGINAL_NATIVE_HELPER_NOT_LITERAL' }
  Add-Type -TypeDefinition $literal.Value
  $parent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  $logs = Join-Path $parent ('dmk-ws04-hosted-' + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $logs | Out-Null
  $ownerBefore = $identity.Owner.Value
  $executable = (Get-Process -Id $PID).Path
  if ($PSCommandPath.Contains('"') -or $executable.Contains('"')) { throw 'WS04_HOSTED_LAUNCH_PATH_INVALID' }
  $arguments = '-NoLogo -NoProfile -NonInteractive -File "' + $PSCommandPath + '" -Child'
  try {
    $status = [DmkPrivateQualificationProcess]::Run($executable, $arguments, (Get-Location).ProviderPath, $logs, $sid)
  } finally {
    # Runner/fixture logs contain only constant test labels, public error codes,
    # safe operation metadata and task-owned evidence paths. No SID is printed.
    foreach ($name in @('stdout.log', 'stderr.log')) {
      $file = Join-Path $logs $name
      if (Test-Path -LiteralPath $file) { Get-Content -LiteralPath $file | Write-Output }
    }
    $after = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    try { if ($after.User.Value -ne $sid -or $after.Owner.Value -ne $ownerBefore) { throw 'WS04_HOSTED_PARENT_TOKEN_CHANGED' } }
    finally { $after.Dispose() }
    # The workflow uploads only sanitized dmk-ws04-evidence-* directories.
    # Keep launcher logs until this isolated job's disposal; no broad deletion.
  }
  if ($status -ne 0) { throw "WS04_HOSTED_CHILD_FAILED: $status" }
} finally { $identity.Dispose() }
