import path from "node:path";
import {fileURLToPath} from "node:url";
import {issueLocalWorldInvite,isAccessError} from "../src/server/world-player-access/store.mjs";

if(process.argv.length!==2 || path.resolve(import.meta.dirname,"..")!==path.resolve(process.cwd())
  || path.resolve(process.argv[1])!==fileURLToPath(import.meta.url)){
  process.stderr.write("Run node scripts/issue-local-world-invite.mjs without arguments from the project directory.\n");
  process.exitCode=2;
}else{
  try{
    const invitation=issueLocalWorldInvite();
    process.stdout.write(JSON.stringify(invitation)+"\n");
  }catch(error){
    process.stderr.write((isAccessError(error)?error.code:"player_invitation_unavailable")+"\n");
    process.exitCode=1;
  }
}
