# AI-PET-WORLD P8 姝ｅ紡瑙嗚闃舵鎬绘帶璁″垝

## 1. 鏂囨。瀹氫綅

鏈枃妗ｆ槸 P8 姝ｅ紡瑙嗚闃舵鐨勬€绘帶璁″垝銆?

褰撳墠鏈€楂樹緷鎹細

1. AI-PET-WORLD MVP 瀹屾暣璁″垝涔?v1.5銆?
2. AI-PET-WORLD 浜烘牸椹卞姩瑙勫垯涓栫晫寮曟搸璁捐鏂囨。 v1.3銆?
3. AI-PET-WORLD MVP 鏁翠綋鏋舵瀯璁捐鏂囨。 v1.0銆?

P8 闃舵鐨勬牳蹇冪洰鏍囦笉鏄鍓嶇鎵嬪啓涓€涓ソ鐪嬬殑涓栫晫椤甸潰锛岃€屾槸寤虹珛锛?

```text
涓栫晫浜嬪疄
-> 娓叉煋鎶曞奖
-> FormalVisualModel
-> FormalWorldView 鍙娓叉煋
```

鐨勬寮忛摼璺€?

## 2. 褰撳墠鏈€楂樺師鍒?

1. 涓栫晫涓嶆槸鍓嶇鐢诲嚭鏉ョ殑锛屼笘鐣岀敱瑙勫垯鍜岀姸鎬佺敓鎴愩€?
2. 甯冨眬涓嶆槸鍥哄畾妯℃澘锛屽竷灞€鐢?worldSeed銆佺瀹朵汉鏍笺€佽祫婧愩€佷簨浠躲€佸缓璁炬剰鍥惧拰绌洪棿瑙勫垯鍏卞悓鐢熸垚銆?
3. 姝ｅ紡瑙嗚妯″瀷涓嶆槸缁勪欢鐢熸垚鐨勶紝蹇呴』鐢?Formal Visual Generation Layer 鐢熸垚銆?
4. FormalWorldView 鍙兘鍙 FormalVisualModel銆?
5. Debug View 涓?Formal World View 蹇呴』鍒嗙銆?
6. Renderer / FormalWorldView 涓嶈兘鐢熸垚涓栫晫浜嬪疄銆?
7. Renderer / FormalWorldView 涓嶈兘鐢熸垚 placement銆?
8. Renderer / FormalWorldView 涓嶈兘鐢熸垚 actor銆?
9. Renderer / FormalWorldView 涓嶈兘璇诲彇 PNG / WORLD_MAP_ASSETS 浣滀负姝ｅ紡涓栫晫浜嬪疄鏉ユ簮銆?
10. 瀹犵墿鍚庣疆锛宲etState 涓嶅瓨鍦ㄦ椂涓嶈兘榛樿鏄剧ず瀹犵墿銆?

## 3. 宸插畬鎴愬苟淇濈暀鐨?P8-G 缁撹

P8-G 宸插畬鎴愬嚑浣曡瑙夌籂鍋忎笌鏀跺彛銆?

淇濈暀閾捐矾锛?

```text
HomeMapState
-> MapPlacement
-> ShapeGrammar
-> SpatialProjection
-> EntityGeometry
-> VisualState
-> VisualPlacement
-> Renderer SVG geometry layer
-> Debug diagnostics
```

P8-G 鐨勬湁鏁堢粨璁猴細

1. PNG / WORLD_MAP_ASSETS 涓嶈兘浣滀负姝ｅ紡 Renderer 涓昏矾寰勩€?
2. Renderer 涓嶈兘涓轰簡瑙嗚鏁堟灉鐢熸垚 placement銆?
3. Renderer 涓嶈兘淇敼 HomeMapState銆?
4. Renderer 涓嶈兘璇诲彇 proposal 褰撶幇瀹炪€?
5. ShapeGrammar / EntityGeometry / VisualState 鍑犱綍閾捐矾淇濈暀銆?
6. Debug diagnostics 鍙互淇濈暀鍦?Debug View銆?
7. Debug diagnostics 涓嶈兘浼鎴愭渶缁堢帺瀹?UI銆?

## 4. 宸插畬鎴愬苟淇濈暀鐨?P8-H 缁撹

P8-H 宸插畬鎴?Actor Geometry Debug 閾捐矾銆?

淇濈暀閾捐矾锛?

```text
world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> VisualState.actorGeometryProjections
-> Renderer Debug View 鍙鏄剧ず
```

P8-H 鐨勬湁鏁堢粨璁猴細

1. butler actor projection 鍙互浠?world snapshot 杩涘叆 VisualState銆?
2. Renderer 鍙互鍙鏄剧ず actor geometry銆?
3. 褰撳墠 actor 鍥惧舰鏄?Debug 鍑犱綍鍗犱綅銆?
4. 褰撳墠 actor 鍥惧舰涓嶆槸鏈€缁堢帺瀹?UI銆?
5. 褰撳墠 actor 鍥惧舰涓嶆槸鏈€缁堣鑹茬編鏈€?
6. 褰撳墠 actor 鍥惧舰涓嶄唬琛ㄦ渶缁?autonomous movement銆?
7. pet 娌℃湁琚粯璁ゆ帴鍏ャ€?
8. Renderer 涓嶇敓鎴?actor銆?
9. Renderer 涓嶅～榛樿 anchor銆?
10. Renderer 涓嶄慨鏀?HomeMapState銆?

## 5. 宸插洖婊氱殑鏃?P8-I 璺嚎

鏃?P8-I0 / P8-I1 / P8-I2 / P8-I3 璺嚎宸蹭綔搴熴€?

浣滃簾鍘熷洜锛?

1. 鏃ц矾绾胯 FormalWorldView 缁勪欢鎵挎媴姝ｅ紡瑙嗚妯″瀷鐢熸垚鑱岃矗銆?
2. 鏃ц矾绾垮湪缁勪欢鍐呭畾涔?FormalWorldVisualItem銆?
3. 鏃ц矾绾垮湪缁勪欢鍐呭畾涔?FormalActorVisualItem銆?
4. 鏃ц矾绾垮湪缁勪欢鍐呭疄鐜?buildFormalWorldVisualItems銆?
5. 鏃ц矾绾垮湪缁勪欢鍐呭疄鐜?buildFormalActorVisualItems銆?
6. 鏃ц矾绾胯缁勪欢鍐冲畾鍦伴潰銆侀亾璺€佸缓绛戙€佹爲鏈ㄣ€佽鏂姐€佺瀹跺浣曟樉绀恒€?
7. 杩欒繚鍙?MVP v1.5銆佽鍒欎笘鐣屽紩鎿?v1.3 鍜屾暣浣撴灦鏋?v1.0銆?

宸插垹闄ゅ唴瀹癸細

1. src/app/world/components/formal-world-view/formal-world-view.tsx銆?
2. src/app/world/components/formal-world-view/formal-world-view.styles.module.css銆?
3. src/app/world/components/formal-world-view/銆?
4. src/world/engine-notes/P8_I0_FORMAL_WORLD_VIEW_PLAN.md銆?
5. src/world/engine-notes/P8_I1_FORMAL_WORLD_VIEW_COMPONENT_SHELL.md銆?
6. src/world/engine-notes/P8_I2_FORMAL_WORLD_CANVAS.md銆?
7. src/world/engine-notes/P8_I3_FORMAL_ACTOR_PRESENTATION.md銆?

## 6. 褰撳墠姝ｇ‘姝ｅ紡璺嚎

浠庣幇鍦ㄥ紑濮嬶紝姝ｅ紡瑙嗚璺嚎蹇呴』鏄細

```text
HomeMapState / WorldState
-> placements / MapDiff
-> VisualState / RenderableWorldSnapshot
-> FormalVisualGenerator
-> FormalVisualModel
-> FormalWorldView 鍙娓叉煋
```

杩欐潯璺嚎鐨勬牳蹇冩槸锛?

1. HomeMapState 淇濆瓨涓栫晫浜嬪疄銆?
2. MapDiff / EventLog 淇濆瓨涓栫晫鍙樺寲銆?
3. VisualState / RenderableWorldSnapshot 淇濆瓨鍙覆鏌撴姇褰便€?
4. FormalVisualModel 淇濆瓨姝ｅ紡鐜╁涓昏瑙夋ā鍨嬨€?
5. FormalWorldView 鍙礋璐ｆ覆鏌?FormalVisualModel銆?

## 7. FormalVisualModel 鐨勫畾浣?

FormalVisualModel 鏄寮忎富瑙嗚妯″瀷瀹瑰櫒銆?

瀹冨彲浠ュ寘鍚細

1. FormalCanvasModel銆?
2. FormalWorldObjectModel銆?
3. FormalActorModel銆?
4. FormalEnvironmentModel銆?
5. FormalHudSummary銆?

瀹冧笉鑳斤細

1. 鐢熸垚涓嶅瓨鍦ㄧ殑涓栫晫瀵硅薄銆?
2. 鐢熸垚 placement銆?
3. 淇敼 HomeMapState銆?
4. 璇诲彇 proposal 褰撶幇瀹炪€?
5. 浼€?pet銆?
6. 缁曡繃 VisualState / RenderableWorldSnapshot銆?

## 8. FormalWorldView 鐨勮竟鐣?

FormalWorldView 鏄彧璇绘覆鏌撳鍣ㄣ€?

FormalWorldView 鍙互锛?

1. 璇诲彇 FormalVisualModel銆?
2. 娓叉煋 FormalCanvasModel銆?
3. 娓叉煋 FormalWorldObjectModel銆?
4. 娓叉煋 FormalActorModel銆?
5. 娓叉煋 FormalEnvironmentModel銆?
6. 娓叉煋 FormalHudSummary銆?

FormalWorldView 涓嶈兘锛?

1. 鐢熸垚 FormalWorldVisualItem銆?
2. 鐢熸垚 FormalActorVisualItem銆?
3. buildFormalWorldVisualItems銆?
4. buildFormalActorVisualItems銆?
5. 鍐冲畾鏍戙€佹埧瀛愩€侀亾璺€佽鏂姐€佺瀹躲€佸疇鐗╂€庝箞闀裤€?
6. 鐢熸垚 actor銆?
7. 鐢熸垚 placement銆?
8. 濉粯璁?anchor銆?
9. 淇敼 VisualState銆?
10. 淇敼 HomeMapState銆?
11. 璇诲彇 PNG / WORLD_MAP_ASSETS 浣滀负姝ｅ紡涓栫晫浜嬪疄鏉ユ簮銆?
12. 鏄剧ず raw tags / source diagnostics / F-C-S-I銆?
13. 鏄剧ず绱井鏂楁暟鍘熷鏈銆?
14. petState 涓嶅瓨鍦ㄦ椂鏄剧ず榛樿瀹犵墿銆?

## 9. 闈炲浐瀹氬竷灞€瑙勫垯

姝ｅ紡甯冨眬涓嶈兘鏄浐瀹氭ā鏉裤€?

姝ｇ‘瑙勫垯锛?

```text
鍚屼竴鐜╁ + 鍚屼竴 worldSeed + 鍚屼竴涓栫晫鐘舵€?
-> 甯冨眬绋冲畾鍙鐜?

涓嶅悓鐜╁ + 涓嶅悓绠″浜烘牸 + 涓嶅悓 seed + 涓嶅悓璧勬簮 / 浜嬩欢鐘舵€?
-> 甯冨眬鍑虹幇鍙瀵熷樊寮?
```

甯冨眬鍙互浣跨敤 layout recipe 浣滀负鍊欓€夊叧绯伙紝浣?recipe 涓嶈兘鎴愪负鍥哄畾鐢婚潰銆?

鏈€缁堝竷灞€蹇呴』缁忚繃锛?

1. worldSeed銆?
2. 绠″浜烘牸銆?
3. constructionStyle銆?
4. visualTendency銆?
5. resource state銆?
6. construction plan銆?
7. placement rules銆?
8. spatial validation銆?
9. MapDiff / HomeMapState 鍐欏叆銆?

## 10. Debug View 涓?Formal World View 杈圭晫

Debug View 鍙互鏄剧ず锛?

1. grid銆?
2. raw tags銆?
3. source diagnostics銆?
4. Geometry Source Diagnostics銆?
5. Actor Geometry Diagnostics銆?
6. collision / support / influence銆?
7. F / C / S / I銆?
8. anchorSource銆?
9. debug reason銆?

Formal World View 涓嶈兘鐩存帴鏄剧ず锛?

1. debug grid銆?
2. raw tags銆?
3. source labels銆?
4. diagnostics銆?
5. collision / support / influence boxes銆?
6. F / C / S / I銆?
7. actor debug flags銆?
8. anchorSource 鍘熷 tag銆?
9. 绱井鏂楁暟鍘熷鏈銆?

## 11. 褰撳墠闃舵鐘舵€?

褰撳墠闃舵锛?

```text
P8-I-RESET-DOC-CLEANUP
```

褰撳墠鐩爣锛?

1. 娓呯悊 P8 鎬绘帶璁″垝鏂囨。涔辩爜銆?
2. 娓呯悊 Guardrails 涔辩爜銆?
3. 瀵归綈 MVP v1.5 / 寮曟搸 v1.3 / 鏋舵瀯 v1.0銆?
4. 鍑嗗杩涘叆 VISUAL-MODEL-00銆?

## 12. 涓嬩竴姝?

涓嬩竴姝ヨ繘鍏ワ細

```text
VISUAL-MODEL-00锛欶ormalVisualModel schema
```

VISUAL-MODEL-00 鐩爣锛?

1. 鏂板 src/world/formal-visual-model/銆?
2. 鏂板 formal-visual-model-schema.ts銆?
3. 鏂板 formal-visual-model-gateway.ts銆?
4. 鍙畾涔?FormalVisualModel 绫诲瀷鍗忚銆?
5. 涓嶅啓 FormalVisualGenerator銆?
6. 涓嶅啓 FormalWorldView銆?
7. 涓嶆帴 /world 椤甸潰銆?

## 13. P8 褰撳墠鏈€缁堢粨璁?

P8 褰撳墠缁撹锛?

1. P8-G / P8-H Debug Geometry 閾捐矾淇濈暀銆?
2. 鏃?P8-I FormalWorldView 鎵嬪啓瑙嗚璺嚎浣滃簾銆?
3. 鍚庣画鍏堝仛 FormalVisualModel 瀹瑰櫒銆?
4. 鍐嶅仛 FormalVisualGenerator銆?
5. 鏈€鍚庡仛 FormalWorldView 鍙娓叉煋銆?
6. 涓嶅厑璁稿啀鍥炲埌鍓嶇鎵嬪啓涓栫晫鍐呭璺嚎銆?

## 14. VISUAL-MODEL-00 FormalVisualModel schema 瀹屾垚璁板綍

VISUAL-MODEL-00 宸插畬鎴?FormalVisualModel 姝ｅ紡瑙嗚妯″瀷瀹瑰櫒鍗忚銆?

鏈樁娈垫柊澧烇細

1. `src/world/formal-visual-model/formal-visual-model-schema.ts`銆?
2. `src/world/formal-visual-model/formal-visual-model-gateway.ts`銆?
3. `src/world/engine-notes/VISUAL_MODEL_00_FORMAL_VISUAL_MODEL_SCHEMA.md`銆?

鏈樁娈靛畾涔夛細

1. FormalVisualModelVersion銆?
2. FormalVisualModelSource銆?
3. FormalVisualTraceSource銆?
4. FormalVisualLayer銆?
5. FormalWorldObjectKind銆?
6. FormalActorKind銆?
7. FormalVisualStyleToken銆?
8. FormalCanvasMood銆?
9. FormalAtmosphereTone銆?
10. FormalActorPoseToken銆?
11. FormalPetStatusToken銆?
12. FormalVisualSourceTrace銆?
13. FormalVisualAuditSummary銆?
14. FormalCanvasModel銆?
15. FormalWorldObjectModel銆?
16. FormalActorModel銆?
17. FormalEnvironmentModel銆?
18. FormalHudSummary銆?
19. FormalVisualModel銆?
20. FormalVisualModelInput銆?
21. FORMAL_VISUAL_MODEL_VERSION銆?

鏈樁娈佃鍒欙細

1. 鍙畾涔?schema銆?
2. 涓嶅疄鐜?FormalVisualGenerator銆?
3. 涓嶅疄鐜?FormalWorldView銆?
4. 涓嶆柊澧?React 缁勪欢銆?
5. 涓嶆帴鍏?/world 椤甸潰銆?
6. 涓嶄慨鏀?ProceduralRendererView銆?
7. 涓嶄慨鏀?renderer-schema.ts / renderer-gateway.ts銆?
8. 涓嶄慨鏀?world-loop銆?
9. 涓嶇敓鎴?actor銆?
10. 涓嶇敓鎴?placement銆?
11. 涓嶅～榛樿 anchor銆?
12. 涓嶄慨鏀?HomeMapState銆?
13. 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?
14. 涓嶉粯璁ゆ帴鍏?pet銆?
15. 涓嶅啓鍥哄畾甯冨眬銆?

涓嬩竴姝ヨ繘鍏ワ細

```text
VISUAL-MODEL-01锛欶ormalVisualGenerator 绾嚱鏁?
```

## 15. VISUAL-MODEL-01 FormalVisualGenerator 绾嚱鏁板畬鎴愯褰?

VISUAL-MODEL-01 宸插畬鎴?FormalVisualGenerator 绾嚱鏁板眰銆?

鏈樁娈垫柊澧烇細

1. `src/world/formal-visual-model/formal-visual-generator.ts`銆?
2. `src/world/formal-visual-model/formal-world-object-model-builder.ts`銆?
3. `src/world/formal-visual-model/formal-actor-model-builder.ts`銆?
4. `src/world/formal-visual-model/formal-canvas-model-builder.ts`銆?
5. `src/world/formal-visual-model/formal-environment-model-builder.ts`銆?
6. `src/world/formal-visual-model/formal-hud-summary-builder.ts`銆?
7. `src/world/engine-notes/VISUAL_MODEL_01_FORMAL_VISUAL_GENERATOR.md`銆?

鏈樁娈典慨鏀癸細

1. `formal-visual-model-gateway.ts` 瀵煎嚭 FormalVisualGenerator銆?

鏈樁娈佃鍒欙細

1. FormalVisualGenerator 鏄函鍑芥暟銆?
2. 杈撳叆鏄?RenderableWorldSnapshot / VisualState銆?
3. 杈撳嚭鏄?FormalVisualModel銆?
4. 涓嶆柊澧?FormalWorldView銆?
5. 涓嶆柊澧?React 缁勪欢銆?
6. 涓嶆柊澧?CSS銆?
7. 涓嶆帴鍏?/world 椤甸潰銆?
8. 涓嶄慨鏀?ProceduralRendererView銆?
9. 涓嶄慨鏀?renderer-schema.ts / renderer-gateway.ts銆?
10. 涓嶄慨鏀?world-loop銆?
11. 涓嶇敓鎴?actor銆?
12. 涓嶇敓鎴?placement銆?
13. 涓嶅～榛樿 anchor銆?
14. 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?
15. 涓嶉粯璁ゆ帴鍏?pet銆?
16. 涓嶅啓鍥哄畾甯冨眬銆?

涓嬩竴姝ヨ繘鍏ワ細

```text
FORMAL-VIEW-00锛欶ormalWorldView 鍙 FormalVisualModel
```

FORMAL-VIEW-00 鐩爣鏄柊澧炲彧璇?FormalWorldView锛岃瀹冨彧璇诲彇 FormalVisualModel 娓叉煋鐜╁涓昏瑙夊３灞傘€?

FORMAL-VIEW-00 浠嶇劧涓嶈兘锛?

1. 鍦ㄧ粍浠跺唴鐢熸垚 FormalWorldVisualItem銆?
2. 鍦ㄧ粍浠跺唴鐢熸垚 FormalActorVisualItem銆?
3. buildFormalWorldVisualItems銆?
4. buildFormalActorVisualItems銆?
5. 鐢熸垚涓栫晫浜嬪疄銆?
6. 鐢熸垚 placement銆?
7. 鐢熸垚 actor銆?
8. 濉粯璁?anchor銆?
9. 璇诲彇 PNG / WORLD_MAP_ASSETS 浣滀负姝ｅ紡涓栫晫浜嬪疄鏉ユ簮銆?
10. 榛樿鏄剧ず pet銆?

## 16. FORMAL-VIEW-00 FormalWorldView 鍙 FormalVisualModel 瀹屾垚璁板綍

FORMAL-VIEW-00 宸叉柊澧炲彧璇?FormalWorldView 缁勪欢銆?
鏈樁娈垫柊澧烇細

1. `src/app/world/components/formal-world-view/formal-world-view.tsx`銆?2. `src/app/world/components/formal-world-view/formal-world-view.styles.module.css`銆?3. `src/app/world/components/formal-world-view/index.ts`銆?4. `src/world/engine-notes/FORMAL_VIEW_00_FORMAL_WORLD_VIEW_READONLY.md`銆?
鏈樁娈佃鍒欙細

1. FormalWorldView 鍙帴鏀?`model: FormalVisualModel`銆?2. FormalWorldView 涓嶆帴鏀?RenderableWorldSnapshot銆?3. FormalWorldView 涓嶆帴鏀?VisualState銆?4. FormalWorldView 涓嶈皟鐢?FormalVisualGenerator銆?5. FormalWorldView 涓嶇敓鎴?FormalVisualModel銆?6. FormalWorldView 涓嶇敓鎴?actor銆?7. FormalWorldView 涓嶇敓鎴?placement銆?8. FormalWorldView 涓嶅～榛樿 anchor銆?9. FormalWorldView 涓嶄慨鏀?VisualState / HomeMapState銆?10. FormalWorldView 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?11. FormalWorldView 涓嶆樉绀?raw tags / source diagnostics / audit internals銆?12. FormalWorldView 涓嶆帴鍏?/world 椤甸潰銆?13. FormalWorldView 涓嶄慨鏀?ProceduralRendererView銆?14. FormalWorldView 涓嶆敼鍙樼幇鏈?Debug Renderer銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
FORMAL-VIEW-01锛欶ormalWorldView 鎺ュ叆婕旂ず鍏ュ彛鎴?debug preview
```

## 17. FORMAL-VIEW-00 涓ユ牸鍙淇璁板綍

FORMAL-VIEW-00 宸插畬鎴愪弗鏍煎彧璇讳慨璁€?
褰撳墠 FormalWorldView 鍙帴鏀讹細

```ts
model: FormalVisualModel
```

鏈樁娈垫柊澧烇細

1. `src/app/world/components/formal-world-view/formal-world-view.tsx`銆?2. `src/app/world/components/formal-world-view/formal-world-view.styles.module.css`銆?3. `src/app/world/components/formal-world-view/index.ts`銆?4. `src/world/engine-notes/FORMAL_VIEW_00_FORMAL_WORLD_VIEW_READONLY.md`銆?
鏈樁娈电‘璁わ細

1. FormalWorldView 鍙 `model.canvas`銆?2. FormalWorldView 鍙 `model.objects`銆?3. FormalWorldView 鍙 `model.actors`銆?4. FormalWorldView 鍙 `model.environment`銆?5. FormalWorldView 鍙 `model.hudSummary`銆?6. FormalWorldView 鍙牴鎹?FormalVisualModel 宸插瓨鍦ㄧ殑 geometry 娓叉煋 point / line / polygon / multiPolygon銆?7. layer 鎺掑簭鍙敤浜庢樉绀哄眰绾э紝涓嶆敼鍙樹笘鐣屽唴瀹广€?8. FormalWorldView 涓嶈皟鐢?FormalVisualGenerator銆?9. FormalWorldView 涓嶇敓鎴?FormalVisualModel銆?10. FormalWorldView 涓嶇敓鎴?FormalWorldVisualItem / FormalActorVisualItem銆?11. FormalWorldView 涓嶅啓 buildFormalWorldVisualItems / buildFormalActorVisualItems銆?12. FormalWorldView 涓嶇敓鎴愪笘鐣屼簨瀹炪€?13. FormalWorldView 涓嶇敓鎴?placement銆?14. FormalWorldView 涓嶇敓鎴?actor銆?15. FormalWorldView 涓嶅～榛樿 anchor銆?16. FormalWorldView 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?17. FormalWorldView 涓嶉粯璁ゆ帴鍏?pet銆?18. 鏈樁娈典笉鎺ュ叆 /world 椤甸潰銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
FORMAL-VIEW-01锛欶ormalWorldView preview harness
```

## 18. FORMAL-VIEW-01 FormalWorldView preview harness 瀹屾垚璁板綍

FORMAL-VIEW-01 宸插畬鎴?preview harness銆?
鏈樁娈垫柊澧烇細

1. `src/app/world/components/formal-world-view/formal-world-view.preview.tsx`銆?2. `src/world/engine-notes/FORMAL_VIEW_01_FORMAL_WORLD_VIEW_PREVIEW_HARNESS.md`銆?
鏈樁娈电‘璁わ細

1. preview harness 鍙敤浜庡紑鍙戦瑙堛€?2. preview harness 鐢ㄤ簬楠岃瘉 FormalVisualModel -> FormalWorldView 鐨勫彧璇绘覆鏌撴晥鏋溿€?3. preview mock 鍛藉悕涓?`PREVIEW_FORMAL_VISUAL_MODEL`銆?4. preview mock 鍙瓨鍦ㄤ簬 preview harness 鏂囦欢鍐呴儴銆?5. preview mock 甯︽湁 `preview_only` / `not_world_fact` / `not_persisted` auditTags銆?6. preview mock 涓嶆槸涓栫晫浜嬪疄銆?7. preview mock 涓嶈繘鍏ユ寮忔暟鎹祦銆?8. preview harness 涓嶇瓑浜庢寮?/world 鎺ュ叆銆?9. 鏈樁娈典笉淇敼 FormalVisualGenerator銆?10. 鏈樁娈典笉淇敼 FormalVisualModel schema銆?11. 鏈樁娈典笉淇敼 world-loop銆?12. 鏈樁娈典笉淇敼 HomeMapState銆?13. 鏈樁娈典笉鐢熸垚鐪熷疄 world object / placement / actor銆?14. 鏈樁娈典笉璇诲彇 PNG / WORLD_MAP_ASSETS銆?15. 鏈樁娈典笉榛樿鎺ュ叆 pet銆?
涓嬩竴姝ユ槸 FORMAL-VIEW-02 鎴?/world 姝ｅ紡鎺ュ叆鍓嶆鏌ワ紝鍏蜂綋浠ュ悗鍐嶅畾銆?
鍦ㄦ寮忓喅绛栧墠锛屼笉寰楁搮鑷帴鍏ユ寮?/world銆?
## 19. FORMAL-VIEW-02 /world 姝ｅ紡鎺ュ叆鍓嶆鏌ヨ褰?
FORMAL-VIEW-02 宸插畬鎴?/world 姝ｅ紡鎺ュ叆鍓嶆鏌ャ€?
鏈樁娈垫柊澧烇細

1. `src/world/engine-notes/FORMAL_VIEW_02_WORLD_ROUTE_PREFLIGHT.md`銆?
鏈樁娈电‘璁ゅ綋鍓嶅凡鏈夐摼璺細

1. `buildVisualState`锛欻omeMapState / EnvironmentState / placementGeometryAudit / actor projection -> VisualState銆?2. `buildRenderableWorldSnapshot`锛歏isualState -> RenderableWorldSnapshot銆?3. `buildFormalVisualModelFromSnapshot`锛歊enderableWorldSnapshot -> FormalVisualModel銆?4. `FormalWorldView`锛欶ormalVisualModel -> 鍙娓叉煋銆?
鏈樁娈电‘璁ゅ綋鍓?/world 鐘舵€侊細

1. /world 宸叉湁鐪熷疄 HomeMapState 鏉ユ簮銆?2. /world 宸叉湁鐪熷疄 RenderableWorldSnapshot 鏉ユ簮銆?3. EnvironmentState 涓?placementGeometryAudit 宸插湪涓婃父娲剧敓骞惰繘鍏?VisualState銆?4. /world 灏氭湭鏋勫缓鐪熷疄 FormalVisualModel銆?5. /world 灏氭湭鎺ュ叆 FormalWorldView銆?6. preview mock 鏈帴鍏?/world锛屼笖涓嶈兘鎺ュ叆 /world銆?7. actorRuntimeGeometryProjections 鍦ㄦ寮忓垏鎹㈠墠闇€瑕佺‘璁ゆ墍鏈夌湡瀹?snapshot 璺緞涓€鑷淬€?8. 褰撳墠涓嶅簲鐩存帴鍒囨崲鍒?FormalWorldView銆?
涓嬩竴姝ュ彧鏈夊湪纭鐪熷疄閾捐矾瀹屾暣鍚庯紝鎵嶅厑璁歌繘鍏ワ細

```text
FORMAL-VIEW-03锛?world 鍙鎺ュ叆 FormalVisualModel
```

## 20. FORMAL-VIEW-03 /world 鍙鎺ュ叆 FormalVisualModel 瀹屾垚璁板綍

FORMAL-VIEW-03 宸插畬鎴?/world 鍙鎺ュ叆 FormalVisualModel銆?
鏈樁娈垫柊澧烇細

1. `src/world/engine-notes/FORMAL_VIEW_03_WORLD_ROUTE_READONLY_FORMAL_VISUAL_MODEL.md`銆?
鏈樁娈典慨鏀癸細

1. `src/app/world/world-route-page.tsx`銆?2. `src/app/world/world-route-page.styles.module.css`銆?
褰撳墠鐪熷疄閾捐矾锛?
```text
runtimeState.currentRenderableSnapshot
-> buildFormalVisualModelFromSnapshot
-> FormalVisualModel
-> FormalWorldView
```

鏈樁娈电‘璁わ細

1. FormalVisualModel 鍙粠 `runtimeState.currentRenderableSnapshot` 鏋勫缓銆?2. `/world` 鏈娇鐢?preview mock銆?3. `/world` 鏈紩鐢?`PREVIEW_FORMAL_VISUAL_MODEL`銆?4. `/world` 鏈?import `formal-world-view.preview`銆?5. 鏈樁娈垫湭淇敼 FormalWorldView銆?6. 鏈樁娈垫湭淇敼 FormalVisualGenerator銆?7. 鏈樁娈垫湭淇敼 FormalVisualModel schema銆?8. 鏈樁娈垫湭淇敼 renderer銆?9. 鏈樁娈垫湭淇敼 world-loop銆?10. 鏈樁娈垫湭淇敼 HomeMapState銆?11. 鏈樁娈垫湭鐢熸垚 world object / placement / actor銆?12. 鏈樁娈垫湭璇诲彇 PNG / WORLD_MAP_ASSETS銆?13. 鏈樁娈垫湭榛樿鎺ュ叆 pet銆?14. Debug Renderer 淇濈暀銆?15. FormalWorldView 璇诲彇鐪熷疄閾捐矾鐢熸垚鐨?FormalVisualModel銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
FORMAL-VIEW-04锛氭寮?/ Debug 瑙嗗浘鍒囨崲绛栫暐鎴栦富瑙嗚甯冨眬鏁寸悊
```

## 21. FORMAL-VIEW-04 姝ｅ紡 / Debug 瑙嗗浘鍒囨崲绛栫暐瀹屾垚璁板綍

FORMAL-VIEW-04 宸插畬鎴?Formal / Debug 瑙嗗浘鍒囨崲绛栫暐銆?
鏈樁娈垫柊澧烇細

1. `src/world/engine-notes/FORMAL_VIEW_04_FORMAL_DEBUG_VIEW_MODE.md`銆?
鏈樁娈典慨鏀癸細

1. `src/app/world/world-route-page.tsx`銆?2. `src/app/world/world-route-page.styles.module.css`銆?
褰撳墠 viewMode锛?
```ts
"formal" | "debug" | "both"
```

鏈樁娈电‘璁わ細

1. 榛樿 viewMode 涓?`"formal"`銆?2. Formal 妯″紡鍙樉绀?FormalWorldView銆?3. Debug 妯″紡鍙樉绀?ProceduralRendererView銆?4. Both 妯″紡鍚屾椂鏄剧ず FormalWorldView 涓?ProceduralRendererView銆?5. Debug Renderer 淇濈暀銆?6. Both 妯″紡鍙敤浜庡紑鍙戝鐓с€?7. viewMode 鍙槸鏈湴 UI 鐘舵€侊紝涓嶅啓鍏ユ寔涔呭寲銆?8. viewMode 涓嶈繘鍏?world-loop銆?9. viewMode 涓嶄慨鏀?HomeMapState銆?10. viewMode 涓嶅弬涓?FormalVisualModel 鐢熸垚銆?11. FormalVisualModel 浠嶇劧鏉ヨ嚜 `runtimeState.currentRenderableSnapshot`銆?12. 鏈樁娈垫湭浣跨敤 preview mock銆?13. 鏈樁娈垫湭鐢熸垚 world object / placement / actor銆?14. 鏈樁娈垫湭璇诲彇 PNG / WORLD_MAP_ASSETS銆?15. 鏈樁娈垫湭榛樿鎺ュ叆 pet銆?
涓嬩竴姝ユ槸 WORLD-GEN-00 鎴?FORMAL-VIEW-05锛屽緟妫€鏌ュ悗鍐冲畾銆?
## WORLD-GEN-00 涓栫晫鐢熸垚閾捐矾鐜扮姸瀹¤璁板綍

WORLD-GEN-00 宸插紑濮嬪苟瀹屾垚涓栫晫鐢熸垚閾捐矾瀹¤銆?
褰撳墠纭锛?
1. P8 Formal View 闃舵宸插畬鎴愮湡瀹為摼璺彧璇绘帴鍏ヤ笌 Formal / Debug 瑙嗗浘鍒囨崲銆?2. 涓嬩竴闃舵杩涘叆 WORLD-GEN锛屽洖鍒?MVP v1.5 鐨勪笘鐣岃嚜鍔ㄧ敓鎴愪富绾裤€?3. 鏈疆鍙璁★紝涓嶆敼浠ｇ爜銆?4. 褰撳墠宸叉湁 worldSeed銆両nitialHomeGenerator銆丠omeMapState銆丮apDiff銆丳lacementEngine銆乴ayout recipe銆?5. 褰撳墠 placements 宸茬粡閮ㄥ垎鍙楀埌 seed 涓?constructionStyle 褰卞搷锛屼絾杩樹笉鏄畬鏁寸殑闈炲浐瀹氬竷灞€瑙勫垯绯荤粺銆?6. 褰撳墠 constructionStyle 宸茶繘鍏ュ垵濮嬬敓鎴愰摼璺€?7. 褰撳墠娌℃湁鍙戠幇鏄庣‘ visualTendency 瀹炵幇鍏ュ彛銆?8. 褰撳墠缂哄皯涓嶅悓 seed / 浜烘牸 / 璧勬簮鐘舵€佷骇鐢熷彲瑙傚療甯冨眬宸紓鐨勯獙璇佹満鍒躲€?9. 褰撳墠鍒濆鐢熸垚涓瓨鍦?pet actor / pet placement / pet-bed / pet_arrival 鏃ч€昏緫椋庨櫓銆?10. pet 榛樿鐢熸垚椋庨櫓杩濆弽 MVP v1.5 瀹犵墿鍚庣疆鍘熷垯锛屾湰杞彧璁板綍锛屼笉鍒犻櫎銆?11. 鍚庣画 WORLD-GEN 涓嶈兘鎶?PNG / assetId 褰撲綔涓栫晫浜嬪疄鏉ユ簮銆?
涓嬩竴姝ヤ紭鍏堝缓璁繘鍏ワ細

```text
WORLD-GEN-01锛氬疇鐗╅粯璁ょ敓鎴愰€昏緫鍥炴粴 / 瀹犵墿鍚庣疆瀵归綈
```

瀹犵墿榛樿鐢熸垚椋庨櫓澶勭悊鍚庯紝鍐嶈繘鍏ワ細

```text
WORLD-GEN-02锛歸orldSeed + personality layout input schema
```

## WORLD-GEN-01A/B 姝ｅ紡棣栧睆鏂囨淇涓?pet runtime 鏂紑璁板綍

WORLD-GEN-01A/B 宸插畬鎴愩€?
褰撳墠纭锛?
1. 宸叉竻鐞?`world-first-scene-model.ts` 姝ｅ紡棣栧睆鏃у鍖栧櫒鏂囨銆?2. 姝ｅ紡棣栧睆涓嶅啀浣跨敤瀛靛寲鍣?/ 鑳氳儙 / 绛夊緟瀹犵墿鍑虹敓浣滀负榛樿璁惧畾銆?3. `/world` 鎵嬪姩 Tick 涓嶅啀榛樿鏋勯€?embryo pet runtime銆?4. `/world` 鎵嬪姩 Tick 涓嶅啀璋冪敤 pet runtime validation / summary銆?5. `/world` 鎵嬪姩 Tick 涓嶅啀鍚?`buildWorldLoopStep` 浼犲叆 petIntentContext銆?6. pet 鏈潵鑳藉姏鏈垹闄わ紝鍙槸浠庨粯璁ゆ寮忚繍琛岄摼璺柇寮€銆?7. 鏈樁娈垫湭淇敼 placement-engine銆?8. 鏈樁娈垫湭淇敼 initial-home-scene-recipe銆?9. 鏈樁娈垫湭淇敼 FormalVisualModel / FormalWorldView 閾捐矾銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
WORLD-GEN-01C锛氱Щ闄ゅ垵濮?pet actor / pet placement
```
## MVP-ALIGN-02 鏃у鍖栧櫒 / 榛樿瀹犵墿閾捐矾娓呯悊璁板綍

MVP-ALIGN-02 宸插畬鎴愭棫瀛靛寲鍣?/ 榛樿瀹犵墿閾捐矾娓呯悊銆?
鏈樁娈靛畬鎴愶細

1. 绉婚櫎褰撳墠姝ｅ紡閾捐矾涓殑鏃у鍖栧櫒璺嚎銆?2. 绉婚櫎榛樿 pet actor銆?3. 绉婚櫎榛樿 pet placement銆?4. 绉婚櫎榛樿 pet 涓撳睘璁炬柦銆?5. 绉婚櫎 `pet_arrival` / `pet_rest` 鍒濆鍖哄煙銆?6. 鏂紑 IncubatorSystem 褰撳墠姝ｅ紡鍏ュ彛銆?7. 绉婚櫎 WorldState incubator 瀛楁銆?8. 娓呯悊 /world銆乺untime銆亀orld-first-scene 涓棫瀛靛寲鍣ㄦ寮忔枃妗堛€?9. 淇濈暀瀹犵墿鏈潵鑳藉姏锛屼絾瀹犵墿鍙兘閫氳繃 LifeEvent / CompanionDecision / accept_companion 鍚庣疆杩涘叆銆?
涓嬩竴姝ヤ笉鍐嶅鐞嗗鍖栧櫒锛岃繘鍏ヤ笘鐣岀敓鎴愯鍒欏寮猴細

```text
WORLD-GEN-02锛歸orldSeed + personality layout input schema
```

