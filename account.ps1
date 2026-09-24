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

$securityVerifier = New-DmkVerifier "SecurityTest"

$roster["SecurityTest"] = @{
    id = "security-test-reviewer"
    kind = "HUMAN"
    roles = @("Security Officer")
    credentialVerifier = $securityVerifier
}

$env:DMK_HUMAN_REVIEWERS = $roster | ConvertTo-Json -Compress -Depth 5

npm run dev