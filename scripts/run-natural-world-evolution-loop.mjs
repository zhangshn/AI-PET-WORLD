import {runNaturalWorldEvolutionLoop,loopStepChild,loopStepReceiptRef} from './lib/natural-world-evolution-loop.mjs'
try{
  if(process.argv.length===6&&process.argv[2]==='--step'){
    const run=process.argv[3],step=Number(process.argv[4]);await loopStepChild(run,step,process.argv[5])
    process.stdout.write(JSON.stringify({pid:process.pid,step,receiptSha256:loopStepReceiptRef(run,step).sha256})+'\n')
  }else{
    if(process.argv.length!==2)throw Error('world_loop_arguments')
    process.stdout.write(JSON.stringify(await runNaturalWorldEvolutionLoop())+'\n')
  }
}catch(error){process.stderr.write(JSON.stringify({status:'failed_closed',error:error.message,run:error.run??null,productionReady:false})+'\n');process.exitCode=1}
