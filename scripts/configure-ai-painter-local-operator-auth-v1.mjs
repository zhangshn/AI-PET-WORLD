import path from 'node:path';import {pathToFileURL} from 'node:url';
import {OPERATOR_DEPLOYMENT_PROTOCOL,configureLocalOperatorDeployment} from './lib/ai-painter-local-operator-deployment-v1.mjs';
export function parseOperatorDeploymentArguments(args){
 if(args.length===1&&args[0]==='--help')return {help:true};
 if(args.length!==3||args[0]!=='--protocol'||args[1]!==OPERATOR_DEPLOYMENT_PROTOCOL||args[2]!=='configure')throw Object.assign(Error('operator_deployment_fixed_configure_required'),{code:'operator_deployment_fixed_configure_required'});
 return {operation:'configure'};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{const command=parseOperatorDeploymentArguments(process.argv.slice(2));if(command.help)process.stdout.write('Explicit existing-project operator deployment only\nnode scripts/configure-ai-painter-local-operator-auth-v1.mjs --protocol ai-painter-local-operator-deployment-v1 configure\nNo key/path/rotation arguments. No session, service reload or training action.\n');else process.stdout.write(JSON.stringify(configureLocalOperatorDeployment(command))+'\n');}
 catch(error){const code=/^operator_deployment_[a-z0-9_]+$/u.test(error.code??'')?error.code:'operator_deployment_failed';process.stderr.write(JSON.stringify({protocol:OPERATOR_DEPLOYMENT_PROTOCOL,status:'failed_closed',errorCode:code,...(error.publicEvidence?{deployment:error.publicEvidence}:{})})+'\n');process.exitCode=1;}
}
