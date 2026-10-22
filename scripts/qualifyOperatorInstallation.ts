/** Prepare the dated official SDK prerequisite; this never installs packages or claims runtime qualification. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';

const sdkVersion='10.0.26100.0';
const installerSha256='b0bdbad38ae74c40ccae8cdbcf229807627fba2bc3100be28301c4ba884f755e';
const msiNames=[
  'Universal CRT Headers Libraries and Sources','Windows SDK Desktop Headers x64','Windows SDK Desktop Headers x86',
  'Windows SDK Desktop Libs x64','Windows SDK for Windows Store Apps Headers','Windows SDK for Windows Store Apps Libs',
  'Windows SDK for Windows Store Apps Tools','Windows SDK for Windows Store Apps Headers OnecoreUap',
  'Windows SDK OnecoreUap Headers x86','Windows SDK OnecoreUap Headers x64',
  'Windows SDK for Windows Store Apps','Windows SDK for Windows Store Apps Metadata',
].map(name=>name+'-x86_en-us.msi');
const sha=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function fail(code:string):never{throw Error(code);}
function canonicalDirectory(file:string){
  if(!path.isAbsolute(file)||path.resolve(file)!==file||fs.realpathSync.native(file)!==file||fs.lstatSync(file).isSymbolicLink()||!fs.lstatSync(file).isDirectory())fail('SDK_CANONICAL_DIRECTORY_REQUIRED');
  return file;
}
function newDirectory(file:string){
  if(!path.isAbsolute(file)||path.resolve(file)!==file)fail('SDK_NEW_ABSOLUTE_DIRECTORY_REQUIRED');
  canonicalDirectory(path.dirname(file));
  try{fs.lstatSync(file);fail('SDK_DESTINATION_EXISTS');}catch(e){if((e as any)?.code!=='ENOENT')throw e;}
}
function overlaps(a:string,b:string){const relative=path.relative(a,b);return !relative||(!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));}
function longName(name:string){return name.split(':')[0].split('|').at(-1)!;}
const usage='Node 22.23.3 x64 Windows: node scripts/qualifyOperatorInstallation.ts --layout ABSOLUTE_OFFICIAL_LAYOUT --sdk-root NEW_ABSOLUTE_ROOT --evidence NEW_ABSOLUTE_DIRECTORY [--plan-only]\n'+
  'Accepts the signed 10.1.26100.9457 layout; prepares native x64 SDK files without registry/host installation. Never runs npm or changes SDK checks.\n';
const options=new Map<string,string>();
try{
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help'){process.stdout.write(usage);process.exit(0);}
  for(let i=0;i<args.length;i++){
    const key=args[i];if(!['--layout','--sdk-root','--evidence','--plan-only'].includes(key)||options.has(key))fail('SDK_USAGE');
    const value=key==='--plan-only'?'true':args[++i];if(!value||value.startsWith('--'))fail('SDK_USAGE');options.set(key,value);
  }
  if(process.platform!=='win32'||process.arch!=='x64'||!['--layout','--sdk-root','--evidence'].every(key=>options.has(key)))fail('SDK_USAGE');
  const layout=canonicalDirectory(options.get('--layout')!),sdk=options.get('--sdk-root')!,evidence=options.get('--evidence')!;
  newDirectory(sdk);newDirectory(evidence);
  if([[layout,sdk],[sdk,layout],[layout,evidence],[evidence,layout],[sdk,evidence],[evidence,sdk]].some(([a,b])=>overlaps(a,b)))fail('SDK_OUTPUTS_MUST_BE_SEPARATE');
  const bootstrap=path.join(layout,'winsdksetup.exe');if(sha(bootstrap)!==installerSha256)fail('SDK_UNQUALIFIED_INSTALLER_HASH');
  fs.mkdirSync(evidence);
  const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const inspect=String.raw`
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$q=[string][char]96
function Rows($db,$table,$fields){
 $query='SELECT '+(($fields|ForEach-Object{$q+$_+$q})-join ',')+' FROM '+$q+$table+$q
 $view=$db.OpenView($query);$null=$view.Execute();$rows=@()
 while($record=$view.Fetch()){$item=[ordered]@{};for($i=1;$i -le $fields.Count;$i++){$item[$fields[$i-1]]=$record.StringData($i)};$rows+=[pscustomobject]$item}
 $null=$view.Close();return $rows
}
function Signature($file){$s=Get-AuthenticodeSignature -LiteralPath $file;if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'CN=Microsoft Corporation'){throw 'SDK_SOURCE_SIGNATURE_INVALID'};return [pscustomobject]@{Status=$s.Status.ToString();Signer=$s.SignerCertificate.Subject;SHA256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()}}
$layout=$env:DMK_SDK_LAYOUT
$bootstrap=Signature (Join-Path $layout 'winsdksetup.exe')
$installer=New-Object -ComObject WindowsInstaller.Installer
$packages=@()
$names=ConvertFrom-Json -InputObject $env:DMK_SDK_MSIS
foreach($name in $names){
 $file=Join-Path (Join-Path $layout 'Installers') $name;$signature=Signature $file;$db=$installer.OpenDatabase($file,0)
 $packages+=[pscustomobject]@{name=$name;signature=$signature;files=@(Rows $db 'File' @('File','Component_','FileName','FileSize','Sequence'));directories=@(Rows $db 'Directory' @('Directory','Directory_Parent','DefaultDir'));components=@(Rows $db 'Component' @('Component','Directory_'));media=@(Rows $db 'Media' @('DiskId','LastSequence','Cabinet'))}
}
[pscustomobject]@{bootstrap=$bootstrap;packages=$packages}|ConvertTo-Json -Depth 12
`;
  const inspectResult=spawnSync(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(inspect,'utf16le').toString('base64')],{
    encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:12*1024*1024,
    env:{...process.env,DMK_SDK_LAYOUT:layout,DMK_SDK_MSIS:JSON.stringify(msiNames),PSModulePath:path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')},
  });
  fs.writeFileSync(path.join(evidence,'inspection.stderr.log'),inspectResult.stderr||'');
  if(inspectResult.status!==0)fail('SDK_READONLY_MSI_INSPECTION_FAILED');
  const metadata=JSON.parse(inspectResult.stdout.replace(/^\uFEFF/,''));
  fs.writeFileSync(path.join(evidence,'source-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
  const files:any[]=[];
  for(const msi of metadata.packages){
    const directories=new Map<string,any>(msi.directories.map((d:any)=>[d.Directory,d]));
    const components=new Map<string,string>(msi.components.map((c:any)=>[c.Component,c.Directory_]));
    function relative(id:string,seen=new Set<string>()):string|null{
      if(id==='KitsRoot')return '';if(!id||seen.has(id))return null;seen.add(id);
      const directory=directories.get(id);if(!directory)return null;const parent=relative(directory.Directory_Parent,seen);if(parent===null)return null;
      const name=longName(directory.DefaultDir);return name==='.'?parent:path.posix.join(parent,name);
    }
    for(const file of msi.files){
      const directory=relative(components.get(file.Component_)!);if(directory===null)continue;
      const target=path.posix.join(directory,longName(file.FileName));if(path.posix.isAbsolute(target)||target.split('/').some(p=>!p||p==='..'))fail('SDK_UNSAFE_FILE_TABLE_PATH');
      const media=msi.media.find((m:any)=>Number(m.LastSequence)>=Number(file.Sequence)&&m.Cabinet);
      files.push({msi:msi.name,fileId:file.File,relative:target,bytes:Number(file.FileSize),cabinet:media?.Cabinet});
    }
  }
  const selected=files.filter(file=>/^SDKManifest\.xml$/i.test(file.relative)||/^(Include\/10\.0\.26100\.0\/(ucrt|um|shared|winrt)\/|Lib\/10\.0\.26100\.0\/(um|ucrt)\/x64\/|DesignTime\/|Platforms\/)/i.test(file.relative)||/^bin\/10\.0\.26100\.0\/x64\/(?:\d+\/)?(?:rc\.exe|rcdll\.dll|mt\.exe)(?:\.mui)?$/i.test(file.relative));
  if(!selected.length||selected.some(file=>!/^fil[a-f0-9]{32}$/.test(file.fileId)||!/^[a-f0-9]{32}\.cab$/.test(file.cabinet||'')||!Number.isSafeInteger(file.bytes)||file.bytes<1))fail('SDK_UNSUPPORTED_FILE_TABLE');
  const cabinets=[...new Set<string>(selected.map(file=>file.cabinet))].sort();
  const verifyCabinets=String.raw`
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$names=ConvertFrom-Json -InputObject $env:DMK_SDK_CABS
foreach($name in $names){
 $file=Join-Path (Join-Path $env:DMK_SDK_LAYOUT 'Installers') $name;$s=Get-AuthenticodeSignature -LiteralPath $file
 if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'CN=Microsoft Corporation'){throw 'SDK_CABINET_SIGNATURE_INVALID'}
 [pscustomobject]@{name=$name;bytes=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant();signature=$s.Status.ToString();signer=$s.SignerCertificate.Subject}
}|ConvertTo-Json -Depth 4
`;
  // PowerShell requires a collected foreach expression before piping.
  const cabinetScript=verifyCabinets.replace('foreach($name','@(foreach($name').replace('}|ConvertTo-Json','})|ConvertTo-Json');
  const cabinetResult=spawnSync(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(cabinetScript,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:1024*1024,env:{...process.env,DMK_SDK_LAYOUT:layout,DMK_SDK_CABS:JSON.stringify(cabinets),PSModulePath:path.join(process.env.SystemRoot||'C:\\Windows','System32/WindowsPowerShell/v1.0/Modules')}});
  fs.writeFileSync(path.join(evidence,'cabinet-inspection.stderr.log'),cabinetResult.stderr||'');
  if(cabinetResult.status!==0)fail('SDK_CABINET_SIGNATURE_VERIFICATION_FAILED');
  const cabinetMetadata=JSON.parse(cabinetResult.stdout.replace(/^\uFEFF/,''));
  const plan={schema:1,sdkVersion,installerSha256,selectedFiles:selected.length,selectedBytes:selected.reduce((n,f)=>n+f.bytes,0),cabinets:cabinetMetadata,files:selected};
  fs.writeFileSync(path.join(evidence,'sdk-plan.json'),JSON.stringify(plan,null,2)+'\n');
  if(options.has('--plan-only')){console.log(JSON.stringify({planned:true,files:plan.selectedFiles,bytes:plan.selectedBytes,cabinets:cabinets.length,builtOrQualified:false}));process.exit(0);}
  fs.mkdirSync(sdk);fs.writeFileSync(path.join(sdk,'task-owned-sdk.json'),JSON.stringify({schema:1,sourceInstallerSha256:installerSha256,hostInstalled:false,registryEdited:false})+'\n');
  const inventory:any[]=[];let peakStageBytes=0;
  for(const cabinet of cabinets){
    const source=path.join(layout,'Installers',cabinet),expected=cabinetMetadata.find((c:any)=>c.name===cabinet);
    if(sha(source)!==expected.sha256)fail('SDK_CABINET_CHANGED');
    const stage=path.join(sdk,'.cab-stage-'+cabinet.slice(0,32));fs.mkdirSync(stage);
    const expanded=spawnSync(path.join(process.env.SystemRoot||'C:\\Windows','System32/expand.exe'),['-F:*',source,stage],{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
    fs.writeFileSync(path.join(evidence,cabinet+'.stdout.log'),expanded.stdout||'');fs.writeFileSync(path.join(evidence,cabinet+'.stderr.log'),expanded.stderr||'');
    if(expanded.status!==0)fail('SDK_CABINET_EXTRACTION_FAILED');
    let stageBytes=0;
    for(const name of fs.readdirSync(stage)){const s=fs.lstatSync(path.join(stage,name));if(!/^(?:fil|cat|sca)[a-f0-9]+$/i.test(name)||!s.isFile()||s.isSymbolicLink())fail('SDK_UNEXPECTED_CABINET_ENTRY');stageBytes+=s.size;}
    peakStageBytes=Math.max(peakStageBytes,stageBytes);if(stageBytes>1430612780)fail('SDK_STAGE_BUDGET_EXCEEDED');
    for(const file of selected.filter(file=>file.cabinet===cabinet)){
      const from=path.join(stage,file.fileId),stat=fs.lstatSync(from),target=path.resolve(sdk,file.relative),digest=sha(from);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==file.bytes||!target.startsWith(sdk+path.sep))fail('SDK_FILE_TABLE_MISMATCH');
      if(fs.existsSync(target)){if(fs.statSync(target).size!==file.bytes||sha(target)!==digest)fail('SDK_CONFLICTING_TARGET');}
      else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.renameSync(from,target);}
      inventory.push({...file,sha256:digest});
    }
    // Only the just-created flat, non-link stage inside this new SDK root is removed.
    if(path.dirname(path.resolve(stage))!==sdk||fs.realpathSync.native(stage)!==stage||fs.lstatSync(stage).isSymbolicLink())fail('SDK_UNSAFE_STAGE_CLEANUP');
    fs.rmSync(stage,{recursive:true});
  }
  fs.writeFileSync(path.join(evidence,'sdk-extracted-files.json'),JSON.stringify(inventory,null,2)+'\n');
  console.log(JSON.stringify({prepared:true,files:inventory.length,peakStageBytes,hostInstalled:false,registryEdited:false,builtOrQualified:false}));
}catch(error){const code=String((error as Error)?.message||'');console.error(/^SDK_[A-Z_]+$/.test(code)?code:'SDK_PREPARATION_FAILED');process.exitCode=1;}
