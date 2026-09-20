[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$Username = "Gio",

    [Parameter(Mandatory = $false)]
    [string]$Role = "Lead Architect",

    [Parameter(Mandatory = $false)]
    [string]$Id = "gio-local-reviewer",

    [Parameter(Mandatory = $false)]
    [System.Security.SecureString]$SecurePassword,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [string]$AuditLogPath = "docs/07_verification/reviewer-provisioning-audit.log"
)

function Write-AuditEvent {
    param(
        [string]$Identity,
        [string]$Action,
        [string]$Status,
        [string]$Message
    )
    $timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $logDir = Split-Path -Parent $AuditLogPath
    if ($logDir -and -not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    $entry = @{
        timestamp = $timestamp
        identity = $Identity
        action = $Action
        status = $Status
        message = $Message
    } | ConvertTo-Json -Compress
    Add-Content -Path $AuditLogPath -Value $entry
}

try {
    # Check required tools
    $nodeCmd = Get-Command "node" -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-AuditEvent -Identity $Username -Action "CHECK_DEPENDENCIES" -Status "FAILURE" -Message "Node.js executable not found in PATH"
        Write-Error "Prerequisite check failed: 'node' executable is required but not found in PATH."
        exit 1
    }

    if ($DryRun) {
        # Dry-run verification mode
        if ([string]::IsNullOrWhiteSpace($Username)) {
            Write-AuditEvent -Identity "<empty>" -Action "VERIFY_INPUTS" -Status "FAILURE" -Message "Username cannot be empty"
            Write-Error "Dry-run validation error: Username is empty."
            exit 1
        }
        if ([string]::IsNullOrWhiteSpace($Role)) {
            Write-AuditEvent -Identity $Username -Action "VERIFY_INPUTS" -Status "FAILURE" -Message "Role cannot be empty"
            Write-Error "Dry-run validation error: Role is empty."
            exit 1
        }
        if ([string]::IsNullOrWhiteSpace($Id)) {
            Write-AuditEvent -Identity $Username -Action "VERIFY_INPUTS" -Status "FAILURE" -Message "Reviewer ID cannot be empty"
            Write-Error "Dry-run validation error: Reviewer ID is empty."
            exit 1
        }

        # Check credential presence in param or environment without echoing
        $hasCred = $false
        if ($null -ne $SecurePassword -and $SecurePassword.Length -gt 0) {
            $hasCred = $true
        } elseif (-not [string]::IsNullOrEmpty($env:DMK_REVIEWER_PASSWORD)) {
            $hasCred = $true
        }

        Write-AuditEvent -Identity $Username -Action "DRY_RUN_VERIFICATION" -Status "SUCCESS" -Message "Verification mode completed successfully (Node available, parameters valid, credential presence checked: $hasCred)"
        Write-Host "Dry-run verification succeeded: Node available, parameters valid, credential presence verified: $hasCred."
        exit 0
    }

    # Obtain SecurePassword
    if ($null -eq $SecurePassword -or $SecurePassword.Length -eq 0) {
        if (-not [string]::IsNullOrEmpty($env:DMK_REVIEWER_PASSWORD)) {
            $SecurePassword = ConvertTo-SecureString $env:DMK_REVIEWER_PASSWORD -AsPlainText -Force
        } elseif ([Environment]::UserInteractive) {
            $SecurePassword = Read-Host "Enter secure password for $Username" -AsSecureString
        } else {
            Write-AuditEvent -Identity $Username -Action "PROVISION_REVIEWER" -Status "FAILURE" -Message "No credential provided in non-interactive mode"
            Write-Error "Error: No password provided via -SecurePassword, DMK_REVIEWER_PASSWORD env var, or interactive prompt."
            exit 1
        }
    }

    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    $verifier = $null
    try {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        $env:DMK_TEMP_REVIEWER_PASSWORD = $plain
        $verifierOutput = node -e "const {randomBytes,scryptSync}=require('crypto'); const salt=randomBytes(16).toString('hex'); const hash=scryptSync(process.env.DMK_TEMP_REVIEWER_PASSWORD,salt,32).toString('hex'); console.log(salt+':'+hash)"
        $verifier = $verifierOutput.Trim()
    }
    finally {
        $env:DMK_TEMP_REVIEWER_PASSWORD = $null
        if ($ptr -ne [System.IntPtr]::Zero) {
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }

    if ([string]::IsNullOrWhiteSpace($verifier)) {
        Write-AuditEvent -Identity $Username -Action "PROVISION_REVIEWER" -Status "FAILURE" -Message "Failed to generate scrypt credential verifier"
        Write-Error "Error: Failed to generate cryptographic verifier."
        exit 1
    }

    $roster = @{
        $Username = @{
            id = $Id
            kind = "HUMAN"
            roles = @($Role)
            credentialVerifier = $verifier
        }
    }

    $env:DMK_HUMAN_REVIEWERS = $roster | ConvertTo-Json -Compress -Depth 5
    Write-AuditEvent -Identity $Username -Action "PROVISION_REVIEWER" -Status "SUCCESS" -Message "Provisioned reviewer in DMK_HUMAN_REVIEWERS without exposing plaintext credential"
    Write-Host "Successfully provisioned reviewer '$Username' ($Role)."

} catch {
    $errMsg = $_.Exception.Message
    Write-AuditEvent -Identity $Username -Action "PROVISION_REVIEWER" -Status "FAILURE" -Message "Unexpected error: $errMsg"
    Write-Error "Provisioning failed: $errMsg"
    exit 1
}
