function New-DmkVerifier {
    param([string]$Username)

    $secure = Read-Host "Create password for $Username" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)

    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        $env:DMK_TEMP_REVIEWER_PASSWORD = $plain

        $verifier = node -e "const {randomBytes,scryptSync}=require('crypto'); const salt=randomBytes(16).toString('hex'); const hash=scryptSync(process.env.DMK_TEMP_REVIEWER_PASSWORD,salt,32).toString('hex'); console.log(salt+':'+hash)"

        return $verifier.Trim()
    }
    finally {
        $env:DMK_TEMP_REVIEWER_PASSWORD = $null
        if ($ptr -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        }
    }
}

$gioVerifier = New-DmkVerifier "Gio"

$roster = @{
    "Gio" = @{
        id = "gio-local-reviewer"
        kind = "HUMAN"
        roles = @("Lead Architect")
        credentialVerifier = $gioVerifier
    }
}

# Synthetic governance identities are only for an explicitly enabled local test.
# Unset NODE_ENV is npm run dev's normal environment; unknown/production modes
# fail closed. Never enable this flag when using real governance state.
if ($env:DMK_ENABLE_TEST_REVIEWER -ceq "1" -and @("", "development", "test") -ccontains ([string]$env:NODE_ENV)) {
    Write-Warning "SecurityTest is enabled for disposable development/test governance only."
    $securityVerifier = New-DmkVerifier "SecurityTest"
    $roster["SecurityTest"] = @{
        id = "security-test-reviewer"
        kind = "HUMAN"
        roles = @("Security Officer")
        credentialVerifier = $securityVerifier
    }
}

$env:DMK_HUMAN_REVIEWERS = $roster | ConvertTo-Json -Compress -Depth 5

npm run dev
