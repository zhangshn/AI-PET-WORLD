import {rollingWeatherCommand} from './lib/world-rolling-weather-runtime.mjs'

try {console.log(JSON.stringify(await rollingWeatherCommand(...process.argv.slice(2))))}
catch(error){console.error(error.stack??error);process.exitCode=1}
