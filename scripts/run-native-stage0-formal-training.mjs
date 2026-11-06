import {nativeStage0ServiceCommand} from './lib/native-stage0-formal-service.mjs'

try {
  console.log(JSON.stringify(await nativeStage0ServiceCommand(...process.argv.slice(2))))
} catch(error) {
  console.error(error.stack??error)
  process.exitCode=1
}
