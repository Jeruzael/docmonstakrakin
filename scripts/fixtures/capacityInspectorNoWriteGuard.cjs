'use strict';
// Independent test preload: fail if inspector tries a mutating fs API or gives
// SQLite a filename. This is an API guard, not kernel syscall telemetry.
const fs=require('node:fs'),Module=require('node:module');
function denied(reason){process.stderr.write('INSPECTOR_FORBIDDEN_ATTEMPT:'+reason+'\n');throw Error(reason);}
for(const name of ['writeFileSync','appendFileSync','writeSync','truncateSync','ftruncateSync','unlinkSync','renameSync','mkdirSync','rmdirSync','rmSync','chmodSync','fchmodSync','chownSync','fchownSync','utimesSync','futimesSync','copyFileSync','linkSync','symlinkSync','createWriteStream',
  'writeFile','appendFile','write','truncate','ftruncate','unlink','rename','mkdir','rmdir','rm','chmod','fchmod','chown','fchown','utimes','futimes','copyFile','link','symlink'])fs[name]=()=>denied('INSPECTOR_WRITE_ATTEMPT');
const originalOpen=fs.openSync;
fs.openSync=(file,flags,...rest)=>{
  if(typeof flags==='string'&&flags!=='r'||typeof flags==='number'&&(flags&(fs.constants.O_WRONLY|fs.constants.O_RDWR|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_APPEND)))denied('INSPECTOR_WRITE_OPEN_ATTEMPT');
  return originalOpen(file,flags,...rest);
};
const load=Module._load;
Module._load=function(name,parent,main){
  const value=load.apply(this,arguments);
  if(name!=='better-sqlite3')return value;
  return function(bytes,options){
    if(!Buffer.isBuffer(bytes)||options?.readonly!==true)denied('INSPECTOR_SQLITE_PATH_OR_WRITE_ATTEMPT');
    const db=new value(bytes,options);
    db.exec=()=>denied('INSPECTOR_SQL_WRITE_ATTEMPT');
    db.loadExtension=()=>denied('INSPECTOR_EXTENSION_ATTEMPT');
    db.backup=()=>denied('INSPECTOR_BACKUP_ATTEMPT');
    return db;
  };
};
