import type { SceneComposerBiome, ScenePalette } from "./scene-composer-schema";

export function buildScenePalette(
  biome: SceneComposerBiome,
  moisture: number
): ScenePalette {
  const dry = moisture <= 35;
  const wet = moisture >= 72;

  if (biome === "desert") {
    return {
      bg: "#17231f",
      grassA: dry ? "#8a7c47" : wet ? "#697849" : "#817e40",
      grassB: dry ? "#9b884c" : wet ? "#748858" : "#8a8848",
      grassC: dry ? "#71683b" : wet ? "#52663e" : "#706f3d",
      grassDark: dry ? "#625833" : wet ? "#3f5132" : "#5a6135",
      grassLight: dry ? "#b8a45e" : wet ? "#96a96a" : "#b0a85c",
      pathA: dry ? "#cf9346" : wet ? "#9c7c3f" : "#b58a42",
      pathB: dry ? "#dda34f" : wet ? "#aa8848" : "#c2964a",
      pathDark: "#8a6334",
      pathLight: "#e3bd68",
      shadow: "#1b2117",
      trunkDark: "#6b4b2b",
      trunk: "#9b7445",
      trunkLight: "#c79a5e",
      leafDark: dry ? "#565532" : wet ? "#465431" : "#4f5c30",
      leaf: dry ? "#8e8b4c" : wet ? "#768c52" : "#88904e",
      leafLight: dry ? "#bdb468" : wet ? "#9eae6b" : "#bdbb6b",
      leafUnder: dry ? "#3f3e25" : wet ? "#344229" : "#384020",
      bushDark: dry ? "#5c5c35" : wet ? "#435631" : "#4e552f",
      bush: dry ? "#88894d" : wet ? "#6f8b54" : "#7d8849",
      bushLight: dry ? "#bdbb68" : wet ? "#95aa69" : "#b7b85f",
      stone: "#6a6245",
      stoneLight: "#9a8f62",
      flower: "#e9d783",
      actorDark: "#604131",
      actor: "#a87b54",
    };
  }

  if (biome === "oasis") {
    return {
      bg: "#17231f",
      grassA: dry ? "#5f814e" : wet ? "#246f52" : "#3f8559",
      grassB: dry ? "#6d9258" : wet ? "#2e8060" : "#479466",
      grassC: dry ? "#466b42" : wet ? "#1c5c49" : "#2f6d4d",
      grassDark: dry ? "#36543a" : wet ? "#104634" : "#25513a",
      grassLight: dry ? "#9fbf7f" : wet ? "#78b894" : "#87d69a",
      pathA: dry ? "#a88c50" : wet ? "#5b6844" : "#7d7748",
      pathB: dry ? "#b99b5b" : wet ? "#69774d" : "#8b8551",
      pathDark: "#4f5b36",
      pathLight: "#b9c878",
      shadow: "#102019",
      trunkDark: "#604028",
      trunk: "#936139",
      trunkLight: "#bf8953",
      leafDark: dry ? "#37684c" : wet ? "#0e5c45" : "#1c634e",
      leaf: dry ? "#6f9d70" : wet ? "#2f946e" : "#4b9d77",
      leafLight: dry ? "#a1c48d" : wet ? "#7fc79d" : "#8ed0a0",
      leafUnder: dry ? "#315641" : wet ? "#0d4034" : "#16483b",
      bushDark: dry ? "#286547" : wet ? "#0f543d" : "#1a6b4f",
      bush: dry ? "#63a06f" : wet ? "#359368" : "#4fb77e",
      bushLight: dry ? "#a3cf8c" : wet ? "#7fc79d" : "#9deab4",
      stone: "#48665d",
      stoneLight: "#78a090",
      flower: "#f48be5",
      actorDark: "#426a5c",
      actor: "#95c7b0",
    };
  }

  return {
    bg: "#17231f",
    grassA: dry ? "#667e43" : wet ? "#1f7336" : "#3f7d3c",
    grassB: dry ? "#758d4e" : wet ? "#2a8541" : "#4f8d43",
    grassC: dry ? "#4d6338" : wet ? "#185a2d" : "#336936",
    grassDark: dry ? "#38482b" : wet ? "#0d3f1f" : "#28572c",
    grassLight: dry ? "#9daf62" : wet ? "#67a95a" : "#7fc360",
    pathA: dry ? "#c09243" : wet ? "#956f32" : "#a57934",
    pathB: dry ? "#ce9d4b" : wet ? "#a47d3a" : "#b3843b",
    pathDark: "#805d2f",
    pathLight: "#d5a75b",
    shadow: "#111b15",
    trunkDark: "#5a351f",
    trunk: "#8a5a31",
    trunkLight: "#b87a3a",
    leafDark: dry ? "#354c2b" : wet ? "#0c4825" : "#154526",
    leaf: dry ? "#668a45" : wet ? "#2f8a3d" : "#3f873d",
    leafLight: dry ? "#9fb563" : wet ? "#68b85a" : "#7ec35c",
    leafUnder: dry ? "#263b25" : wet ? "#0a321b" : "#10351e",
    bushDark: dry ? "#3c5c31" : wet ? "#0e4c26" : "#17612f",
    bush: dry ? "#6f984a" : wet ? "#2c8941" : "#3da248",
    bushLight: dry ? "#a7bd65" : wet ? "#69b85b" : "#8fdb65",
    stone: "#536354",
    stoneLight: "#81927d",
    flower: biome === "grassland" ? "#f5f0a8" : "#e8f0db",
    actorDark: "#6c4930",
    actor: "#b89260",
  };
}
