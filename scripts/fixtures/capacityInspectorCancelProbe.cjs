'use strict';
// Test-only scheduling: block after the first real source read, then let the
// independent parent kill the inspector process at that exact boundary.
const fs=require('node:fs');
if(require.main!==module){
  const read=fs.readSync;
  fs.readSync=function(fd,...args){
    const n=read.call(this,fd,...args);
    if(process.send&&fs.readlinkSync('/proc/self/fd/'+fd).endsWith('/.security/authority.sqlite')){
      process.send({sourceRead:true});
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);
    }
    return n;
  };
}else{
  const {spawn}=require('node:child_process');
  const child=spawn(process.execPath,['--require',__filename,process.argv[2],process.argv[3]],{stdio:['ignore','pipe','pipe','ipc']});
  let ready=false,output='';
  const timer=setTimeout(()=>{child.kill('SIGKILL');process.exitCode=1;},10000);
  child.stdout.on('data',bytes=>{output+=bytes;});
  child.on('message',message=>{if(message?.sourceRead){ready=true;child.kill('SIGKILL');}});
  child.on('close',(code,signal)=>{clearTimeout(timer);if(!ready||signal!=='SIGKILL'||output)process.exitCode=1;else console.log('CANCELLED_AFTER_SOURCE_READ_WITHOUT_VERDICT');});
}
