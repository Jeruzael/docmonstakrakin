param([ValidateSet('Diagnostics', 'Npm', 'Bun')][string]$Phase = 'Diagnostics', [switch]$Child, [ValidateSet('Workspace', 'Agent')][string]$Suite = 'Workspace')
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
      [ordered]@{sid = $_.IdentityReference.Value; type = [string]$_.AccessControlType; rights = [long]$_.FileSystemRights; inherited = $_.IsInherited; inheritance = [string]$_.InheritanceFlags; propagation = [string]$_.PropagationFlags}
    })
  }
}
function New-PrivateProbeDacl([string]$Sid) {
  # A fresh descriptor removes unrelated explicit grants as well as inherited
  # ones. Applied only to this helper's exclusively created disposable probe.
  # It does not set an owner or touch any authority directory/file.
  $acl = [System.Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new(
    [System.Security.Principal.SecurityIdentifier]::new($Sid),
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    ([System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit),
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Allow))
  return $acl
}

# This launcher changes only a NEW suspended child's distinct primary token. It never calls
# SetTokenInformation on the runner/PowerShell's existing token. No privileges
# are enabled, no users/groups are created and no system policy is changed.
# https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-settokeninformation
# https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw
# https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_statistics
$nativeDefinition = @'
using System;
using System.Collections;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;

public static class DmkPrivateQualificationProcess {
  [StructLayout(LayoutKind.Sequential)] struct SECURITY_ATTRIBUTES {public int length; public IntPtr descriptor; [MarshalAs(UnmanagedType.Bool)] public bool inherit;}
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct STARTUPINFO {
    public int cb; public string reserved, desktop, title; public int x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reservedBytes;
    public IntPtr reservedData,input,output,error;
  }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION {public IntPtr process,thread; public int processId,threadId;}
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool GetTokenInformation(IntPtr token,int informationClass,IntPtr information,int length,out int required);
  [DllImport("advapi32.dll",SetLastError=true)] static extern bool SetTokenInformation(IntPtr token,int informationClass,IntPtr information,int length);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,ExactSpelling=true)] static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inheritHandles,uint flags,IntPtr environment,string directory,ref STARTUPINFO startup,out PROCESS_INFORMATION process);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateFileW(string file,uint access,uint share,ref SECURITY_ATTRIBUTES attributes,uint disposition,uint flags,IntPtr template);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint exitCode);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exitCode);
  [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
  static void Require(bool success,string operation) {if(!success){var code=Marshal.GetLastWin32Error();throw new Win32Exception(code,operation+" [Win32="+code+"] "+new Win32Exception(code).Message);}}
  static string Owner() {using(var identity=WindowsIdentity.GetCurrent())return identity.Owner.Value;}
  static long TokenId(IntPtr token) {
    int required;var sized=GetTokenInformation(token,10,IntPtr.Zero,0,out required);var code=Marshal.GetLastWin32Error();
    if(sized||code!=122)throw new Win32Exception(code,"GetTokenInformation(TokenStatistics size) [Win32="+code+"] "+new Win32Exception(code).Message);
    if(required<8||required>4096)throw new InvalidOperationException("TOKEN_STATISTICS_SIZE_INVALID");
    var data=Marshal.AllocHGlobal(required);
    try {Require(GetTokenInformation(token,10,data,required,out required),"GetTokenInformation(TokenStatistics)");return Marshal.ReadInt64(data);}
    finally {Marshal.FreeHGlobal(data);}
  }
  static string EnvironmentBlock() {
    var variables=Environment.GetEnvironmentVariables();var names=new string[variables.Count];variables.Keys.CopyTo(names,0);Array.Sort(names,StringComparer.OrdinalIgnoreCase);
    var block=new StringBuilder();foreach(var name in names)block.Append(name).Append('=').Append(variables[name]).Append('\0');return block.Append('\0').ToString();
  }
  public static int Run(string executable,string arguments,string directory,string logDirectory,string expectedUser) {
    IntPtr source=IntPtr.Zero,childToken=IntPtr.Zero,sid=IntPtr.Zero,owner=IntPtr.Zero,environment=IntPtr.Zero,output=IntPtr.Zero,error=IntPtr.Zero,input=IntPtr.Zero;
    var process=new PROCESS_INFORMATION();var originalOwner=Owner();bool completed=false;
    try {
      // The existing token is QUERY-only. No adjustment or duplication rights
      // are requested on the runner/parent token.
      Require(OpenProcessToken(GetCurrentProcess(),0x0008,out source),"OpenProcessToken(parent query)");
      var parentId=TokenId(source);
      var attributes=new SECURITY_ATTRIBUTES {length=Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)),inherit=true};
      output=CreateFileW(Path.Combine(logDirectory,"stdout.log"),0x40000000,1,ref attributes,1,0x80,IntPtr.Zero);
      Require(output!=new IntPtr(-1),"Create stdout");
      error=CreateFileW(Path.Combine(logDirectory,"stderr.log"),0x40000000,1,ref attributes,1,0x80,IntPtr.Zero);
      Require(error!=new IntPtr(-1),"Create stderr");
      input=CreateFileW("NUL",0x80000000,3,ref attributes,3,0x80,IntPtr.Zero);Require(input!=new IntPtr(-1),"Open NUL");
      environment=Marshal.StringToHGlobalUni(EnvironmentBlock());
      var startup=new STARTUPINFO {cb=Marshal.SizeOf(typeof(STARTUPINFO)),flags=0x100,input=input,output=output,error=error};
      // Explicit application path, hidden child, exact inherited environment;
      // CURRENT TEMP is preserved. No profile or credentials are provisioned.
      var command=new StringBuilder("\""+executable+"\" "+arguments);
      // Normal process creation needs no alternate-logon/impersonation grant.
      // The primary thread cannot execute any script until every fence below.
      Require(CreateProcessW(executable,command,IntPtr.Zero,IntPtr.Zero,true,0x00000004|0x08000000|0x400,environment,directory,ref startup,out process),"CreateProcessW(CREATE_SUSPENDED)");
      Require(OpenProcessToken(process.process,0x0008|0x0080,out childToken),"OpenProcessToken(suspended child)");
      var childId=TokenId(childToken);
      if(childId==parentId)throw new InvalidOperationException("CHILD_TOKEN_NOT_INDEPENDENT");
      using(var identity=new WindowsIdentity(childToken))if(identity.User.Value!=expectedUser)throw new InvalidOperationException("CHILD_TOKEN_USER_CHANGED");
      var identifier=new SecurityIdentifier(expectedUser);var bytes=new byte[identifier.BinaryLength];identifier.GetBinaryForm(bytes,0);
      sid=Marshal.AllocHGlobal(bytes.Length);Marshal.Copy(bytes,0,sid,bytes.Length);owner=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(owner,sid);
      Require(SetTokenInformation(childToken,4,owner,IntPtr.Size),"SetTokenInformation(child TokenOwner)");
      using(var identity=new WindowsIdentity(childToken))if(identity.User.Value!=expectedUser||identity.Owner.Value!=expectedUser)throw new InvalidOperationException("CHILD_TOKEN_OWNER_UNCONFIRMED");
      if(TokenId(source)!=parentId||TokenId(childToken)!=childId||Owner()!=originalOwner)throw new InvalidOperationException("TOKEN_IDENTITY_OR_PARENT_OWNER_CHANGED");
      Console.WriteLine("WINDOWS_PRIVATE_DISTINCT_CHILD_TOKEN {\"parentTokenId\":\""+parentId.ToString("X16")+"\",\"childTokenId\":\""+childId.ToString("X16")+"\",\"parentOwnerUnchanged\":true}");
      var suspension=ResumeThread(process.thread);
      Require(suspension!=0xffffffff,"ResumeThread");
      if(suspension!=1)throw new InvalidOperationException("CHILD_SUSPEND_COUNT_INVALID");
      var wait=WaitForSingleObject(process.process,25*60*1000);
      if(wait!=0) {TerminateProcess(process.process,124);WaitForSingleObject(process.process,10000);throw new InvalidOperationException("QUALIFICATION_CHILD_TIMEOUT_OR_WAIT_FAILURE");}
      uint exitCode;Require(GetExitCodeProcess(process.process,out exitCode),"GetExitCodeProcess");completed=true;return checked((int)exitCode);
    } finally {
      if(!completed&&process.process!=IntPtr.Zero){TerminateProcess(process.process,125);WaitForSingleObject(process.process,10000);}
      foreach(var handle in new[]{process.thread,process.process,input,output,error,childToken,source})if(handle!=IntPtr.Zero&&handle!=new IntPtr(-1))CloseHandle(handle);
      foreach(var pointer in new[]{environment,owner,sid})if(pointer!=IntPtr.Zero)Marshal.FreeHGlobal(pointer);
      if(Owner()!=originalOwner)throw new InvalidOperationException("PARENT_TOKEN_OWNER_CHANGED");
    }
  }
}
'@

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
    # Keep the original combined-icacls diagnostic. Actual helper probes are
    # nonempty (the exclusive file above already exists), unlike the successful
    # empty-directory split-command variant. Use the independently tested exact
    # descriptor here; runtime authority admission remains completely separate.
    if ($Phase -eq 'Diagnostics') {
      & icacls.exe $probe '/inheritance:r' '/grant:r' "*$($sid):(OI)(CI)F" | Out-Null
      if ($LASTEXITCODE -ne 0) {throw 'OWNER_PROBE_DACL_FAILED'}
    } else {
      # Persist modified DACL only. PowerShell Set-Acl can request unrelated
      # SACL access for a new descriptor and require SeSecurityPrivilege.
      # https://learn.microsoft.com/en-us/dotnet/api/system.io.filesystemaclextensions.setaccesscontrol
      [System.IO.FileSystemAclExtensions]::SetAccessControl([System.IO.DirectoryInfo]::new($probe), (New-PrivateProbeDacl $sid))
    }
    $observation.directoryAfter = Get-OwnerObservation $probe
    $observation.fileAfter = Get-OwnerObservation $file
    if ($observation.directoryAfter.ownerSid -ne $observation.directoryBefore.ownerSid -or $observation.fileAfter.ownerSid -ne $observation.fileBefore.ownerSid) {throw 'OWNER_PROBE_UNEXPECTED_OWNER_CHANGE'}
    Write-Output ('WINDOWS_PRIVATE_OWNER_DIAGNOSTIC ' + ($observation | ConvertTo-Json -Depth 8 -Compress))
    if ($Phase -eq 'Diagnostics') {
      if ($Child) {throw 'DIAGNOSTICS_CANNOT_SELECT_CHILD_PROFILE'}
      # Compare only NEW, disposable descendants. Owner is observed, never set.
      # This distinguishes TOKEN_OWNER from DACL-hardening behavior without
      # changing the existing authority's admission contract or repairing it.
      $variants = [ordered]@{}
      foreach ($name in @('separate-icacls', 'exact-directory-security')) {
        $variant = Join-Path $probe $name
        New-Item -ItemType Directory -Path $variant -ErrorAction Stop | Out-Null
        $before = Get-OwnerObservation $variant
        $variantResult = [ordered]@{before=$before}
        if ($name -eq 'separate-icacls') {
          & icacls.exe $variant '/inheritance:r' | Out-Null
          if ($LASTEXITCODE -ne 0) {throw 'OWNER_PROBE_SEPARATE_INHERITANCE_FAILED'}
          $variantResult.afterInheritance = Get-OwnerObservation $variant
          & icacls.exe $variant '/grant:r' "*$($sid):(OI)(CI)F" | Out-Null
          if ($LASTEXITCODE -ne 0) {throw 'OWNER_PROBE_SEPARATE_GRANT_FAILED'}
        } else {
          # A new DACL, not SetAccessRule (which retains unrelated explicit ACEs).
          # https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectsecurity.setaccessruleprotection
          [System.IO.FileSystemAclExtensions]::SetAccessControl([System.IO.DirectoryInfo]::new($variant), (New-PrivateProbeDacl $sid))
        }
        $variantResult.after = Get-OwnerObservation $variant
        if ($variantResult.after.ownerSid -ne $before.ownerSid) {throw 'OWNER_PROBE_UNEXPECTED_OWNER_CHANGE'}
        $variants[$name] = $variantResult
      }
      Write-Output ('WINDOWS_PRIVATE_DACL_VARIANTS ' + ($variants | ConvertTo-Json -Depth 9 -Compress))
      return
    }
    if ($Child) {
      # Direct -Child invocation cannot skip the actual token/filesystem checks.
      if ($identity.Owner.Value -ne $sid -or $observation.directoryBefore.ownerSid -ne $sid -or $observation.fileBefore.ownerSid -ne $sid) {throw 'CHILD_OWNER_PROFILE_UNCONFIRMED'}
      if (-not $observation.directoryAfter.protected -or $observation.directoryAfter.access.Count -ne 1 -or @($observation.directoryAfter.access | Where-Object {$_.sid -ne $sid -or $_.type -ne 'Allow' -or $_.rights -ne [long][System.Security.AccessControl.FileSystemRights]::FullControl}).Count) {throw 'CHILD_DACL_PROFILE_UNCONFIRMED'}
      $env:DMK_OWNER_PROBE = $probe
      $nodeProbe = @'
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const file=path.join(process.env.DMK_OWNER_PROBE,'node-created-probe.txt');fs.writeFileSync(file,'1',{flag:'wx'});
const literal=file.replaceAll("'","''");
const code="$ErrorActionPreference='Stop';$i=[System.Security.Principal.WindowsIdentity]::GetCurrent();@{userSid=$i.User.Value;tokenOwnerSid=$i.Owner.Value;fileOwnerSid=(Get-Acl -LiteralPath '"+literal+"').GetOwner([System.Security.Principal.SecurityIdentifier]).Value}|ConvertTo-Json -Compress";
const result=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:10000,env:{...process.env,PSModulePath:path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/Modules')}});
if(result.status!==0)throw Error('NODE_DESCENDANT_OWNER_QUERY_FAILED');const observation=JSON.parse(result.stdout.trim());if(observation.userSid!==observation.tokenOwnerSid||observation.userSid!==observation.fileOwnerSid)throw Error('NODE_DESCENDANT_OWNER_UNCONFIRMED');console.log('NODE_DESCENDANT_OWNER_PROFILE '+JSON.stringify(observation));
// This is diagnostic acquisition on NEW synthetic paths, not an authority repair.
// Record the actual Node subprocess profile before the full native suite runs.
const os=require('node:os'),{pathToFileURL}=require('node:url');
const env={...process.env,PSModulePath:path.join(process.env.WINDIR,'System32/WindowsPowerShell/v1.0/Modules')};
const ps=code=>{const r=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';"+code,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:10000,env});if(r.status!==0)throw Error('NODE_ACL_QUERY_FAILED '+r.status+' '+r.stderr.slice(-2000));return r.stdout.trim();};
const quote=p=>p.replaceAll("'","''");
const acl=p=>JSON.parse(ps("$i=[Security.Principal.WindowsIdentity]::GetCurrent();$a=Get-Acl -LiteralPath '"+quote(p)+"';@{powershellVersion=$PSVersionTable.PSVersion.ToString();userSid=$i.User.Value;tokenOwnerSid=$i.Owner.Value;ownerSid=$a.GetOwner([Security.Principal.SecurityIdentifier]).Value;protected=$a.AreAccessRulesProtected;access=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|%{@{sid=$_.IdentityReference.Value;type=[string]$_.AccessControlType;rights=[long]$_.FileSystemRights;inherited=$_.IsInherited}})}|ConvertTo-Json -Depth 6 -Compress"));
const parent=fs.realpathSync.native(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'dmk-node-owner-diagnostic-'));
(async()=>{try{
 const empty=path.join(root,'empty-node-created');fs.mkdirSync(empty,{mode:0o700});const before=acl(empty);
 cp.execFileSync('icacls.exe',[empty,'/inheritance:r'],{windowsHide:true,stdio:'pipe',timeout:3000});const afterInheritance=acl(empty);
 cp.execFileSync('icacls.exe',[empty,'/grant:r','*'+observation.userSid+':(OI)(CI)F'],{windowsHide:true,stdio:'pipe',timeout:3000});const afterGrant=acl(empty);
 console.log('NODE_FRESH_DACL_DIAGNOSTIC '+JSON.stringify({node:process.versions.node,before,afterInheritance,afterGrant}));
 const workspace=path.join(root,'genuine-boundary');fs.mkdirSync(workspace);const boundary=require(path.resolve('server/security/workspaceAccess/privateBoundary.cjs'));let stage='capture',handle;
 try{handle=boundary.capture(workspace,true);stage='acquire';handle=boundary.acquire(handle);stage='assertFiles';boundary.assertFiles(handle);stage='release';boundary.release(handle);handle=undefined;stage='complete';}
 catch(e){console.log('NODE_GENUINE_BOUNDARY_DIAGNOSTIC '+JSON.stringify({stage,code:e.code||e.name}));}
 finally{if(handle?.lockRaw){try{boundary.release(handle);}catch{}}}
 const security=path.join(workspace,'.security'),resources={};
 if(fs.existsSync(security)){resources['.security']=acl(security);for(const name of fs.readdirSync(security))if(['owner.lock','authority.sqlite','authority.sqlite-wal','authority.sqlite-shm'].includes(name))resources[name]=acl(path.join(security,name));}
 console.log('NODE_GENUINE_BOUNDARY_RESOURCES '+JSON.stringify({stage,resources}));
 if(fs.existsSync(security)){
  const whoami=cp.execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true,timeout:2000});const expected=/S-1-\d+(?:-\d+)+/.exec(whoami)?.[0];
  if(!expected)throw Error('NODE_EXPECTED_OWNER_SID_MISSING');
  const admission="$ErrorActionPreference='Stop';$a=Get-Acl -LiteralPath '"+quote(security)+"';$s=New-Object System.Security.Principal.SecurityIdentifier('"+expected+"');if($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $s.Value){exit 3};if(-not $a.AreAccessRulesProtected){exit 3};$r=$a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]);if($r.Count -lt 1){exit 3};foreach($v in $r){if($v.IdentityReference.Value -ne $s.Value -or $v.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow){exit 3}}";
  const strict=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(admission,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:10000,env});
  console.log('NODE_EXACT_ADMISSION_RECHECK '+JSON.stringify({expectedSid:expected,status:strict.status,signal:strict.signal,error:strict.error?.code,stderr:strict.stderr.slice(-3000)}));
 }
 if(stage==='complete'){
  let store;try{const {WorkspaceStore}=await import(pathToFileURL(path.resolve('server/security/workspaceAccess/store.ts')).href);store=await WorkspaceStore.open(workspace,{initialize:true});console.log('NODE_GENUINE_SQLITE_DIAGNOSTIC '+JSON.stringify({opened:true}));}
  catch(e){const after={};for(const name of fs.readdirSync(security))if(['owner.lock','authority.sqlite','authority.sqlite-wal','authority.sqlite-shm'].includes(name))after[name]=acl(path.join(security,name));console.log('NODE_GENUINE_SQLITE_DIAGNOSTIC '+JSON.stringify({opened:false,code:e.code||e.name,after}));}
  finally{if(store)await store.close();}
 }
}finally{if(path.dirname(path.resolve(root))!==parent||!/^dmk-node-owner-diagnostic-/.test(path.basename(root))||fs.lstatSync(root).isSymbolicLink())throw Error('NODE_DIAGNOSTIC_CLEANUP_REJECTED');fs.rmSync(root,{recursive:true});}})().catch(e=>{console.error('NODE_OWNERSHIP_DIAGNOSTIC_FAILED '+e.message);process.exitCode=1;});
'@
      & node --import tsx --input-type=commonjs -e $nodeProbe
      if ($LASTEXITCODE -ne 0) {throw 'NODE_DESCENDANT_OWNER_PROFILE_FAILED'}
      Remove-Item Env:DMK_OWNER_PROBE
      $scripts = if ($Suite -eq 'Agent') {
        @('scripts/testWorkspaceAgentService.ts', 'scripts/testWorkspaceAgentDelegation.ts', 'scripts/testWorkspaceAgentApplication.ts', 'scripts/testWorkspaceMcpBridge.ts', 'scripts/testWorkspaceMcpSecurity.ts', 'scripts/testWorkspaceMcpAuthority.ts', 'scripts/testWorkspaceMcpOAuth.ts', 'scripts/testWorkspaceMcpOAuthLauncher.ts')
      } else {
        @('scripts/testWorkspacePrivateDirectory.ts', 'scripts/testWorkspaceStore.ts', 'scripts/testWorkspaceEmptyCreation.ts', 'scripts/testWorkspaceActionReceipts.ts', 'scripts/testWorkspaceActionApplication.ts', 'scripts/testWorkspaceApplication.ts', 'scripts/testWorkspaceTls.ts', 'scripts/testWorkspaceBackup.ts')
      }
      foreach ($script in $scripts) {
        & node --import tsx $script
        if ($LASTEXITCODE -ne 0) {throw "PRIVATE_QUALIFICATION_FAILED: $script"}
      }
      if ($Phase -eq 'Npm') {
        & npm.cmd run ci:quality
        if ($LASTEXITCODE -ne 0) {throw 'PRIVATE_QUALIFICATION_QUALITY_FAILED'}
      }
      & git diff --exit-code
      if ($LASTEXITCODE -ne 0) {throw 'PRIVATE_QUALIFICATION_CHANGED_TRACKED_SOURCE'}
      return
    }
    $initialOwner = $identity.Owner.Value
    Add-Type -TypeDefinition $nativeDefinition
    $logs = Join-Path $probe 'qualification-logs'
    New-Item -ItemType Directory -Path $logs | Out-Null
    $executable = (Get-Process -Id $PID).Path
    if ($PSCommandPath.Contains('"') -or $executable.Contains('"')) {throw 'QUALIFICATION_APPLICATION_PATH_INVALID'}
    $arguments = '-NoLogo -NoProfile -NonInteractive -File "' + $PSCommandPath + '" -Phase ' + $Phase + ' -Suite ' + $Suite + ' -Child'
    try {$childExit = [DmkPrivateQualificationProcess]::Run($executable, $arguments, (Get-Location).ProviderPath, $logs, $sid)}
    finally {
      # Even a launcher/wait failure must expose the genuine child's evidence.
      foreach ($log in @('stdout.log', 'stderr.log')) {
        $logPath = Join-Path $logs $log
        if (Test-Path -LiteralPath $logPath) {Get-Content -LiteralPath $logPath | Write-Output}
      }
    }
    $afterIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    try {
      if ($afterIdentity.Owner.Value -ne $initialOwner -or $afterIdentity.User.Value -ne $sid) {throw 'QUALIFICATION_PARENT_TOKEN_CHANGED'}
      Write-Output ('WINDOWS_PRIVATE_PARENT_TOKEN_UNCHANGED ' + (@{userSid=$sid; tokenOwnerSid=$afterIdentity.Owner.Value; childExit=$childExit} | ConvertTo-Json -Compress))
    } finally {$afterIdentity.Dispose()}
    if ($childExit -ne 0) {throw "PRIVATE_QUALIFICATION_CHILD_FAILED: $childExit"}
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
