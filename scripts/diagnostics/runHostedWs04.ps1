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
    $outcomes = @()
    $evidenceParent = [System.IO.Path]::GetFullPath($env:DMK_WS04_EVIDENCE_PARENT)
    if (-not [System.IO.Directory]::Exists($evidenceParent) -or ((Get-Item -LiteralPath $evidenceParent).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw 'WS04_CONTROL_EVIDENCE_PARENT_INVALID' }
    $controlEvidence = Join-Path $evidenceParent ('dmk-ws04-evidence-controls-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $controlEvidence | Out-Null
    $priorScope = $env:DMK_WS04_DIAGNOSTIC; $priorEvidence = $env:DMK_WS04_EVIDENCE
    try {
      $env:DMK_WS04_DIAGNOSTIC = 'synthetic-only'; $env:DMK_WS04_EVIDENCE = $controlEvidence
      & node --require ./scripts/diagnostics/ws04Permissions.preload.cjs scripts/diagnostics/ws04ObserverControls.cjs
      $controlStatus = $LASTEXITCODE
      $sourceRevision = (git rev-parse HEAD).Trim(); $sourceTree = (git rev-parse 'HEAD^{tree}').Trim()
      if ($LASTEXITCODE -ne 0 -or $sourceRevision -notmatch '^[a-f0-9]{40}$' -or $sourceTree -notmatch '^[a-f0-9]{40}$') { throw 'WS04_CONTROL_SOURCE_IDENTITY_UNAVAILABLE' }
      [ordered]@{ diagnosticOnly = $true; experiment = 'genuine-negative-controls'; status = $controlStatus; sourceRevision = $sourceRevision; sourceTree = $sourceTree
        observerSha256 = (Get-FileHash -LiteralPath './scripts/diagnostics/ws04Permissions.preload.cjs' -Algorithm SHA256).Hash.ToLowerInvariant()
        controlsSha256 = (Get-FileHash -LiteralPath './scripts/diagnostics/ws04ObserverControls.cjs' -Algorithm SHA256).Hash.ToLowerInvariant()
      } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $controlEvidence 'summary.json')
      $outcomes += [pscustomobject]@{ experiment = 'genuine-negative-controls'; status = $controlStatus }
    } finally { $env:DMK_WS04_DIAGNOSTIC = $priorScope; $env:DMK_WS04_EVIDENCE = $priorEvidence }
    foreach ($profile in @('inherited', 'sparse')) {
      # Preserve original WS01..WS04 order and warmup, stop before WS05.
      & node scripts/diagnostics/diagnoseWs04.mjs $profile prefix
      $outcomes += [pscustomobject]@{ experiment = $profile; status = $LASTEXITCODE }
    }
    # Both fixed profiles execute once, even when the first observes a failure.
    $outcomes | ConvertTo-Json -Depth 4 | Write-Output
    if (@($outcomes | Where-Object { $_.status -ne 0 }).Count) { throw 'WS04_DIAGNOSTIC_MATRIX_OBSERVED_FAILURE' }
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
