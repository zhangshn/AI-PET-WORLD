import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";

// Windows ignores Node's POSIX mode bits. Create the *new* child with its own
// ACL at birth. Never repair/adopt an existing permissive credential database.
const winSecurity=String.raw`
$ErrorActionPreference='Stop'
$me=[Security.Principal.WindowsIdentity]::GetCurrent().User
$admin=[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
$system=[Security.Principal.SecurityIdentifier]::new('S-1-5-18')
$trusted=@($me.Value,$admin.Value,$system.Value)
foreach($p in @($env:AIPW_ACCOUNT_ANCHOR,$env:AIPW_ACCOUNT_MOUNT)){
  $acl=if([IO.Directory]::Exists($p)){[IO.Directory]::GetAccessControl($p)}else{[IO.File]::GetAccessControl($p)}
  if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $me.Value){throw 'server account does not own the project and mount'}
}
$directory=$env:AIPW_ACCOUNT_DIR
if(-not [IO.Directory]::Exists($directory)){
  if($env:AIPW_ACCOUNT_CREATE -ne '1'){throw 'private directory absent'}
  $acl=[Security.AccessControl.DirectorySecurity]::new()
  $acl.SetOwner($me)
  $acl.SetAccessRuleProtection($true,$false)
  foreach($sid in @($me,$system,$admin)){
    $rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
  }
  [IO.Directory]::CreateDirectory($directory,$acl)|Out-Null
}
$paths=@($directory)
foreach($suffix in @('','-journal','-wal','-shm')){
  $file=[IO.Path]::Combine($directory,'players.sqlite'+$suffix)
  if([IO.File]::Exists($file)){$paths+=$file}
}
foreach($p in $paths){
  if([IO.File]::GetAttributes($p) -band [IO.FileAttributes]::ReparsePoint){throw 'reparse point'}
  $acl=if([IO.Directory]::Exists($p)){[IO.Directory]::GetAccessControl($p)}else{[IO.File]::GetAccessControl($p)}
  if($trusted -notcontains $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value){throw 'unexpected owner'}
  if($p -eq $directory -and -not $acl.AreAccessRulesProtected){throw 'inherited credential directory ACL'}
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
    if($rule.AccessControlType -eq 'Allow' -and $trusted -notcontains $rule.IdentityReference.Value){throw 'untrusted credential ACL'}
  }
}
`;
const checked=new Map();
function fileIdentity(file){
  try{
    const s=fs.lstatSync(file,{bigint:true});
    if(s.isSymbolicLink()||s.ino===0n)throw Error("player storage identity unavailable");
    return [s.dev,s.ino,s.birthtimeNs].join("/");
  }catch(error){if(error.code==="ENOENT")return null;throw error;}
}

export function ensurePrivatePlayerStorage(anchor,mount,create=false){
  const directory=path.join(mount,"world-player-access"),db=path.join(directory,"players.sqlite");
  const before=fileIdentity(directory),dbBefore=fileIdentity(db);
  if(before===null&&!create)throw Error("private player storage has not been provisioned");
  if(before && checked.get(directory)===before+":"+dbBefore)return directory;
  if(process.platform==="win32"){
    const command=path.join(process.env.SystemRoot??"C:\\Windows","System32","WindowsPowerShell","v1.0","powershell.exe");
    const outcome=spawnSync(command,["-NoLogo","-NonInteractive","-NoProfile","-EncodedCommand",Buffer.from(winSecurity,"utf16le").toString("base64")],
      {windowsHide:true,timeout:10000,stdio:"ignore",env:{...process.env,AIPW_ACCOUNT_ANCHOR:anchor,AIPW_ACCOUNT_MOUNT:mount,
        AIPW_ACCOUNT_DIR:directory,AIPW_ACCOUNT_CREATE:create?"1":"0"}});
    if(outcome.status!==0)throw Error("server storage owner or private Windows ACL validation failed");
  }else{
    const uid=process.getuid();
    if(fs.statSync(anchor).uid!==uid || fs.statSync(mount).uid!==uid)throw Error("server account does not own the project and mount");
    if(!before && create)fs.mkdirSync(directory,{mode:0o700});
    const stats=fs.lstatSync(directory);
    if(stats.uid!==uid||!stats.isDirectory()||(stats.mode&0o077)!==0)throw Error("private credential directory required");
    if(dbBefore){const s=fs.lstatSync(db);if(s.uid!==uid||(s.mode&0o077)!==0)throw Error("private credential file required");}
  }
  const after=fileIdentity(directory),dbAfter=fileIdentity(db);
  if(!after||(before&&before!==after)||(dbBefore&&dbBefore!==dbAfter))throw Error("credential storage changed during verification");
  checked.set(directory,after+":"+dbAfter);
  return directory;
}
