import {launch,prepare,run,readback} from './lib/world-environment-scheduled-run.mjs'

const commands={'--prepare':prepare,'--launch':launch,'--run':run,'--readback':readback}
commands['--first-committed-weather']=async()=>(await import('./lib/world-first-weather-runtime.mjs')).runFirstWeatherRuntime()
commands['--read-first-committed-weather']=async()=>(await import('./lib/world-first-weather-runtime.mjs')).readFirstWeatherRuntime()
const args=process.argv.slice(2)
if(args.length!==1||!Object.hasOwn(commands,args[0]))throw Error('expected one fixed scheduled-world command')
try{console.log(JSON.stringify(await commands[args[0]]()))}
catch(err){console.error(err.stack??err);process.exitCode=1}
