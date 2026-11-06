import {prepareNaturalWorldLiveMapInput} from "./lib/natural-world-live-map-input.mjs";

if(process.argv.length!==2)throw new Error("current-world input accepts no arguments");
console.log(JSON.stringify(await prepareNaturalWorldLiveMapInput(),null,2));
