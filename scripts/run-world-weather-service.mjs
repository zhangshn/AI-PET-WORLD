import {executeScheduledWeatherCommand} from './lib/world-weather-scheduled-service.mjs'

try {
  console.log(JSON.stringify(await executeScheduledWeatherCommand(...process.argv.slice(2))))
}catch(error){
  console.error(error.stack??error)
  process.exitCode=1
}
