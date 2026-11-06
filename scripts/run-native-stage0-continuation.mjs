import {nativeContinuationCommand} from './lib/native-stage0-continuation-host.mjs'
try{
  console.log(JSON.stringify(await nativeContinuationCommand(...process.argv.slice(2))))
}catch(error){
  console.error(error.stack??error);process.exitCode=1
}
