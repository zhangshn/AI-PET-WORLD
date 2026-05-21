# World Engine Development Guardrails

褰撳墠闃舵鏆傚仠璐村浘寮?Renderer 杩唬锛岄」鐩噸蹇冭浆鍚戔€滀汉鏍奸┍鍔ㄨ鍒欎笘鐣屾ā鎷熷紩鎿庘€濈殑搴曞眰鍗忚寤鸿銆?

## 褰撳墠浼樺厛灞?

褰撳墠闃舵鍏堝缓璁撅細

- World Rule Layer
- Spatial Geometry Layer
- EntityGeometry / Footprint / Collision / Support / Influence

## 寮€鍙戠孩绾?

1. Renderer 鍙兘璇诲彇 WorldState锛屼笉鑳界敓鎴愪笘鐣屻€?
2. Intent 涓嶈兘鐩存帴鏀逛笘鐣岋紝蹇呴』缁忚繃锛欼ntent -> Plan -> Validator -> Diff -> WorldState銆?
3. 涓嶅厑璁镐负浜嗚瑙夋晥鏋滅粫杩囪鍒欍€?
4. 涓栫晫瑙勫垯鍐冲畾浠€涔堣兘鍙戠敓銆?
5. 绠″浜烘牸鍐冲畾鎯充笉鎯冲彂鐢熴€?
6. 绌洪棿缁撴瀯鍐冲畾鍦ㄥ摢閲屽彂鐢熴€?

## 鏋舵瀯鍒ゆ柇

涓栫晫涓嶆槸璐村浘鎽嗘斁銆備笘鐣岀敱瑙勫垯銆佺偣绾块潰銆佺敓鎬併€佹剰鍥惧拰鍙樺寲鍏卞悓鎺ㄥ銆備换浣曟柊鐨勮瑙夊憟鐜伴兘蹇呴』鏈嶄粠 WorldState 鍜岃鍒欏眰杈撳嚭锛屼笉鑳藉弽鍚戝閫犱笘鐣屼簨瀹炪€?

## P5 涓栫晫鍙樺寲灞傝ˉ鍏呯孩绾?

1. IntentDecision 浠嶇劧涓嶈兘鐩存帴淇敼 HomeMapState銆?
2. WorldChangePlan 鍙槸璁″垝灞傘€?
3. WorldDiffProposal 鍙槸鎻愭灞傘€?
4. validateMapDiffs 鍙牎楠岋紝涓嶅啓鍏ャ€?
5. WorldEvolutionAuditReport 鍙垽鏂闄╀笌瀹夊叏鎬с€?
6. WorldEvolutionExecutionResult 褰撳墠鍙敤浜?debug锛屼笉浠ｈ〃姝ｅ紡涓栫晫宸茬粡鑷姩鍐欏叆銆?
7. 姝ｅ紡鍐欏叆蹇呴』绛?P7 MVP 闂幆闃舵鍐嶅喅瀹氥€?
8. Renderer 浠嶇劧涓嶈兘璇诲彇 proposal 鎴?execution 鐩存帴鐢诲浘锛屽繀椤昏鍙栨渶缁?WorldState銆?

## P6 Renderer 灞傝ˉ鍏呯孩绾?

1. Renderer 鍙兘璇诲彇鏈€缁?WorldState / HomeMapState / Geometry / Terrain銆?
2. Renderer 涓嶈兘璇诲彇 WorldDiffProposal 褰撲綔鐜板疄銆?
3. Renderer 涓嶈兘璇诲彇 WorldEvolutionAuditReport 褰撲綔鐜板疄銆?
4. Renderer 涓嶈兘璇诲彇 WorldEvolutionExecutionResult 褰撲綔鐜板疄銆?
5. Renderer 涓嶈兘涓轰簡瑙嗚鏁堟灉鍒涢€犱笉瀛樺湪鐨?placement銆?
6. Renderer 涓嶈兘鐩存帴淇敼 HomeMapState銆?
7. Renderer 涓嶈兘鏇夸唬 WorldEngine銆?
8. P6 绗竴闃舵鍙厑璁稿仛 debug visual锛屼笉鍏佽杩芥眰婕備寒鐢婚潰銆?

## P6.7 姝ｅ紡涓栫晫鎺ュ叆璇勪及绾㈢嚎

1. 姝ｅ紡 /world 涓嶈兘鐩存帴鎺?debug wireframe銆?
2. 姝ｅ紡 /world 涓嶈兘鐩存帴浣跨敤 /world-debug/procedural-renderer 鐨勯〉闈㈢粍浠躲€?
3. 姝ｅ紡 /world 鎺ュ叆鍓嶏紝蹇呴』鍏堟湁姝ｅ紡 ProceduralRenderer 缁勪欢璁捐銆?
4. 姝ｅ紡 ProceduralRenderer 鍙兘璇诲彇 RenderableWorldSnapshot 鎴栨渶缁?VisualState銆?
5. 姝ｅ紡 ProceduralRenderer 涓嶈兘璇诲彇 IntentDecision / WorldChangePlan / WorldDiffProposal / Audit / Execution銆?
6. 姝ｅ紡鎺ュ叆鍓嶅繀椤婚€氳繃 debug 椤甸獙璇?VisualState 涓?DrawCommand 绋冲畾銆?
7. HomeMapRenderer placeholder 鍦ㄦ寮忔帴鍏ュ墠缁х画淇濈暀銆?
8. 涓嶅厑璁镐负浜嗏€滅湅璧锋潵鍍忎笘鐣屸€濇仮澶嶆棫璐村浘鍋囦笘鐣屻€?

## P6.8 姝ｅ紡 ProceduralRenderer 缁勪欢璁捐绾㈢嚎

1. P6.8 鍙厑璁稿啓璁捐鏂囨。锛屼笉鍏佽鏂板姝ｅ紡 Renderer 缁勪欢銆?
2. 姝ｅ紡 ProceduralRenderer 鏈潵鍙兘璇诲彇 RenderableWorldSnapshot銆?
3. 姝ｅ紡 ProceduralRenderer 涓嶈兘璇诲彇 debug scenario銆?
4. 姝ｅ紡 ProceduralRenderer 涓嶈兘璇诲彇 IntentDecision / WorldChangePlan / WorldDiffProposal / Audit / Execution銆?
5. 姝ｅ紡 ProceduralRenderer 涓嶈兘浠?assetId 鎺ㄥ璐村浘鎴栧亣瀵硅薄銆?
6. 姝ｅ紡 ProceduralRenderer 涓嶈兘鐢熸垚 placement 鎴栦慨鏀?HomeMapState銆?
7. Debug wireframe 涓嶈兘鐩存帴鎼繘姝ｅ紡 /world銆?
8. HomeMapRenderer placeholder 蹇呴』淇濈暀鍒?P6.12 涔嬪悗鍐嶈瘎浼版浛鎹€?

## P6.13 Renderer 瑙嗚澧炲己涓庢敹鍙ｇ孩绾?

1. P6.13 鍙厑璁稿啓鏀跺彛鏂囨。锛屼笉鍏佽鍐欐柊瑙嗚浠ｇ爜銆?
2. 姝ｅ紡 Renderer 褰撳墠鍙兘璇诲彇 RenderableWorldSnapshot銆?
3. 鍚庣画瑙嗚澧炲己蹇呴』浠?DrawCommand / VisualState 娲剧敓銆?
4. 瑙嗚澧炲己涓嶈兘寮曞叆璐村浘鍋囦笘鐣屻€?
5. 瑙嗚澧炲己涓嶈兘鏍规嵁 assetId 鐩存帴鍔犺浇绱犳潗銆?
6. 瑙嗚澧炲己涓嶈兘鍒涢€犱笉瀛樺湪鐨?placement銆?
7. 瑙嗚澧炲己涓嶈兘淇敼 HomeMapState銆?
8. P7 涔嬪墠 Renderer 涓嶈兘鎵挎媴涓栫晫鎺ㄨ繘鑱岃矗銆?
9. P7 涔嬪墠 Renderer 涓嶈兘鎺ョ world-evolution execution銆?
10. 浠讳綍姝ｅ紡瑙嗚鍏冪礌閮藉繀椤昏兘杩芥函鍒?WorldState / VisualState / DrawCommand銆?

## P7 MVP 涓栫晫闂幆绾㈢嚎

1. P7 涓嶈兘缁曡繃 Intent -> Plan -> Proposal -> Validation -> Audit -> Execution銆?
2. 姝ｅ紡鍐欏叆 HomeMapState 蹇呴』缁忚繃 audit.canApplySafely銆?
3. 姝ｅ紡鍐欏叆涓嶈兘鐩存帴浣跨敤 debug scenario銆?
4. Renderer 浠嶇劧涓嶈兘鎵ц MapDiff銆?
5. Renderer 浠嶇劧涓嶈兘淇敼 HomeMapState銆?
6. world-evolution execution 涓嶈兘鏃犳潯浠惰嚜鍔ㄥ啓鍏ャ€?
7. 鏃?construction flow 涓嶈兘琚獊鐒剁‖鍒狅紝蹇呴』鏈夎縼绉荤瓥鐣ャ€?
8. 澶?Tick 鎺ㄨ繘蹇呴』淇濇寔鍙璁°€?
9. 鎵€鏈夋寮忎笘鐣屽彉鍖栧繀椤昏兘杩芥函鍒?MapDiff銆?
10. P7 绗竴闃舵鍙厑璁歌璁★紝涓嶅厑璁哥洿鎺ュ啓 runtime loop 浠ｇ爜銆?

## P7.7 WorldLoop 鎸佷箙鍖栫孩绾?

1. P7.7 鍙厑璁稿啓鎸佷箙鍖栫瓥鐣ユ枃妗ｏ紝涓嶅厑璁稿啓鎸佷箙鍖栦唬鐮併€?
2. 涓嶈兘鐩存帴鎶婂畬鏁?RuntimeWorldState 鏃犺鍓啓鍏?localStorage銆?
3. 涓嶈兘鎸佷箙鍖?debug scenario 缁撴灉銆?
4. 涓嶈兘鎸佷箙鍖?Renderer 娲剧敓瀵硅薄浣滀负鍞竴涓栫晫浜嬪疄銆?
5. 鎸佷箙鍖栫殑鏍稿績浜嬪疄蹇呴』鏄?HomeMapState 鎴栧彲鎭㈠ HomeMapState 鐨勫畨鍏ㄥ揩鐓с€?
6. auditTrail 蹇呴』鏈夎鍓瓥鐣ャ€?
7. 涓栫晫鐘舵€佸繀椤绘寜 worldId / ownerId 闅旂銆?
8. 鎭㈠鐘舵€佸繀椤绘牎楠岀増鏈笌 worldId銆?
9. 鎸佷箙鍖栧け璐ュ繀椤昏兘 fallback 鍒?firstSceneModel銆?
10. Renderer 涓嶈兘鍙備笌鎸佷箙鍖栧喅绛栥€?

## P7.8 鏃?construction flow 鏀剁缉绾㈢嚎

1. P7.8 鍙厑璁稿啓鏀剁缉鏂囨。锛屼笉鍏佽鍒犻櫎鎴栭噸鍐?construction flow銆?
2. construction flow 缁х画淇濈暀鍒濆涓栫晫鐢熸垚鑱岃矗銆?
3. construction flow 鍙互缁х画鏈嶅姟 debug scenario銆?
4. construction flow 涓嶅啀鎵╁睍涓洪暱鏈熶笘鐣屾帹杩涚郴缁熴€?
5. 闀挎湡涓栫晫鍙樺寲蹇呴』杩涘叆 world-loop / world-evolution / SafeApply 閾捐矾銆?
6. /world 姝ｅ紡 Tick 涓嶈兘鐩存帴璋冪敤 construction debug scenario銆?
7. Renderer 涓嶈兘璇诲彇 construction debug result 褰撲綔姝ｅ紡涓栫晫浜嬪疄銆?
8. 鍚庣画鏂板寤鸿琛屼负蹇呴』浼樺厛杩涘叆 WorldChangePlan / WorldDiffProposal銆?
9. construction flow 鐨勫悗缁亴璐ｆ槸鏀剁缉锛屼笉鏄墿寮犮€?
10. 鍒犻櫎鏃ч€昏緫鍓嶅繀椤诲厛瀹屾垚鏇夸唬閾捐矾涓庤縼绉绘枃妗ｃ€?

## P7.9 MVP 涓栫晫闂幆鏀跺彛绾㈢嚎

1. P7.9 鍙厑璁稿啓鏀跺彛鏂囨。锛屼笉鍏佽鍐欐柊浠ｇ爜銆?
2. 褰撳墠 MVP 闂幆鍙敮鎸佹墜鍔?Tick锛屼笉鏀寔鑷姩 Tick銆?
3. 褰撳墠 RuntimeWorldState 鍙瓨鍦?React memory state锛屼笉鍋氭寔涔呭寲銆?
4. Renderer 浠嶇劧鍙兘璇诲彇 RenderableWorldSnapshot銆?
5. Renderer 涓嶈兘鎵ц world-loop銆?
6. UI 涓嶈兘缁曡繃 buildWorldLoopStep / applyWorldLoopStep銆?
7. SafeApplyDecision 浠嶇劧鏄寮忛噰鐢?nextHomeMapState 鐨勫敮涓€寮€鍏炽€?
8. construction flow 缁х画鏀剁缉涓?initial generation / debug support銆?
9. P7.10 涔嬪墠涓嶅厑璁告柊澧?persistence schema銆?
10. P7.10 涔嬪墠涓嶅厑璁稿啓 localStorage adapter銆?

## P7.11-P7.14 WorldLoop 鎸佷箙鍖栨帴鍏ョ孩绾?

1. persistence adapter 鍙兘淇濆瓨 PersistedWorldLoopState锛屼笉鍏佽淇濆瓨瀹屾暣 RuntimeWorldState銆?
2. /world 鎭㈠ persisted state 鏃跺繀椤婚噸鏂版淳鐢?RenderableWorldSnapshot銆?
3. /world 鎭㈠澶辫触蹇呴』 fallback 鍒?firstSceneModel銆?
4. 鎵嬪姩淇濆瓨蹇呴』鐢辩敤鎴风偣鍑昏Е鍙戙€?
5. 绂佹鑷姩淇濆瓨銆?
6. 绂佹 Tick 鍚庤嚜鍔ㄥ啓 localStorage銆?
7. 绂佹鎸佷箙鍖?RenderableWorldSnapshot / VisualState / DrawCommand銆?
8. 绂佹 Renderer 鍙備笌淇濆瓨鎴栨仮澶嶃€?
9. 绂佹璺宠繃 worldId / ownerId 鏍￠獙銆?
10. P7.14 鍙瘎浼拌嚜鍔ㄤ繚瀛橈紝涓嶅疄鐜拌嚜鍔ㄤ繚瀛樸€?

## P7.15 鐪熷疄绠″ / 瀹犵墿 runtime context 绾㈢嚎

1. P7.15 鍙厑璁稿啓绛栫暐鏂囨。锛屼笉鐩存帴鎺ョ湡瀹?context 浠ｇ爜銆?
2. 绠″ / 瀹犵墿 runtime context 鍙兘浣滀负 world-loop 杈撳叆锛屼笉鑳界洿鎺ヤ慨鏀?HomeMapState銆?
3. context 涓嶈兘鐩存帴鐢熸垚 placement銆?
4. context 涓嶈兘缁曡繃 IntentDecision / WorldChangePlan / WorldDiffProposal銆?
5. context 涓嶈兘缁曡繃 SafeApply銆?
6. /world 椤甸潰涓嶈兘鐩存帴鎷煎鏉備汉鏍肩畻娉曘€?
7. world-loop 涓嶈兘娣卞眰渚濊禆 personality-core銆?
8. Renderer 鐘舵€佷笉鑳戒綔涓?intent context銆?
9. debug scenario result 涓嶈兘浣滀负姝ｅ紡 context銆?
10. 鍦ㄦ病鏈?schema 鍓嶄笉鑳芥妸 context 鍐欏叆鎸佷箙鍖栥€?

## P7.16 闀挎湡寤鸿 proposal 鎵╁睍绾㈢嚎

1. P7.16 鍙厑璁稿啓绛栫暐鏂囨。锛屼笉鐩存帴鎵╁睍 proposal 浠ｇ爜銆?
2. 闀挎湡寤鸿蹇呴』杩涘叆 WorldChangePlan / WorldDiffProposal / validation / audit / SafeApply 閾捐矾銆?
3. proposal 涓嶈兘鐩存帴淇敼 HomeMapState銆?
4. proposal 涓嶈兘鐩存帴璋冪敤 applyMapDiffs銆?
5. proposal 涓嶈兘缁曡繃 validation / audit / SafeApply銆?
6. 绂佹涓轰簡瑙嗚鏁堟灉鐢熸垚鏃犳潵婧?placement銆?
7. Renderer 涓嶈兘鍙備笌 proposal 鐢熸垚銆?
8. construction debug scenario 涓嶈兘杩涘叆姝ｅ紡 Tick銆?
9. rejected proposal 涓嶈兘琚綋浣滀笘鐣屼簨瀹炪€?
10. 闀挎湡寤鸿鑳藉姏蹇呴』鍒嗛樁娈垫墿灞曪紝涓嶈兘涓€娆℃€у鍏ユ墍鏈夎涓恒€?

## P7.17 persistence / context / proposal 鏀跺彛绾㈢嚎

1. P7.17 鍙厑璁稿啓鏀跺彛鏂囨。锛屼笉鏂板浠ｇ爜銆?
2. 褰撳墠淇濆瓨鍙兘淇濆瓨 PersistedWorldLoopState锛屼笉鑳戒繚瀛樺畬鏁?RuntimeWorldState銆?
3. 褰撳墠鎭㈠蹇呴』浠?HomeMapState 閲嶆柊娲剧敓 RenderableWorldSnapshot銆?
4. 褰撳墠浠嶇劧绂佹鑷姩淇濆瓨銆?
5. 褰撳墠浠嶇劧绂佹鑷姩 Tick銆?
6. 鐪熷疄 context 鍦ㄦ病鏈?schema 鍓嶄笉鑳藉啓鍏ユ寔涔呭寲銆?
7. 闀挎湡寤鸿 proposal 鍦ㄦ病鏈夋墿灞?schema 鍓嶄笉鑳借繘鍏ユ寮?Tick銆?
8. Renderer 涓嶈兘鍙備笌 context銆乸roposal銆佷繚瀛樻垨鎭㈠銆?
9. construction debug scenario 涓嶈兘杩涘叆姝ｅ紡 Tick銆?
10. 涓嬩竴闃舵蹇呴』鍏堝仛 ButlerRuntimeContext / PetRuntimeContext schema锛屽啀鎺ョ湡瀹?context銆?

## P7.25 context + proposal 鏀跺彛绾㈢嚎

1. P7.25 鍙厑璁稿啓鏀跺彛鏂囨。锛屼笉鏂板杩愯鏃朵唬鐮併€?
2. context 鍙兘浣滀负 world-loop 杈撳叆锛屼笉鑳界洿鎺ヤ慨鏀?HomeMapState銆?
3. context 涓嶈兘缁曡繃 IntentDecision / WorldChangePlan / WorldDiffProposal / SafeApply銆?
4. proposal 鍙兘鐢熸垚鍊欓€?MapDiff锛屼笉鑳界洿鎺ュ啓鍏ヤ笘鐣屻€?
5. build_path / clean_area / repair_facility / plant_nature 浠嶇劧蹇呴』缁忚繃 validation / audit / execution / SafeApply銆?
6. proposal debug 椤甸潰鍙兘鐢ㄤ簬瀹¤锛屼笉寰椾綔涓烘寮?/world 鍏ュ彛銆?
7. Renderer 鍙兘璇诲彇鏈€缁堜笘鐣屼簨瀹烇紝涓嶈兘璇诲彇 proposal 褰撲綔鐜板疄銆?
8. P8 瑙嗚澧炲己涓嶈兘涓轰簡濂界湅鍒涢€犱笉瀛樺湪鐨?placement銆?
9. 鑷姩 Tick 涓庤嚜鍔ㄤ繚瀛樹粛鐒剁姝€?
10. 杩涘叆 P8 鍓嶅繀椤荤‘璁?Renderer 浠嶇劧鍙 RenderableWorldSnapshot / VisualState / DrawCommand銆?

## P8.0 姝ｅ紡瑙嗚闃舵瑙勫垝绾㈢嚎

1. P8.0 鍙厑璁稿啓瑙勫垝鏂囨。锛屼笉鍐欒瑙変唬鐮併€?
2. P8 璐熻矗鏄剧ず涓栫晫浜嬪疄锛屼笉璐熻矗鐢熸垚涓栫晫浜嬪疄銆?
3. 姝ｅ紡 Renderer 鍙兘璇诲彇 RenderableWorldSnapshot / VisualState / DrawCommand銆?
4. 姝ｅ紡 Renderer 涓嶈兘璇诲彇 IntentDecision / WorldChangePlan / WorldDiffProposal / Audit / Execution銆?
5. 姝ｅ紡 Renderer 涓嶈兘鐢熸垚 placement銆?
6. 姝ｅ紡 Renderer 涓嶈兘淇敼 HomeMapState銆?
7. 姝ｅ紡 Renderer 涓嶈兘涓轰簡瑙嗚鏁堟灉浼€犲璞°€?
8. debug renderer / debug scenario 涓嶈兘鐩存帴鍙樻垚姝ｅ紡涓栫晫浜嬪疄銆?
9. P8 绗竴闃舵涓嶅仛鍔ㄧ敾銆佷笉鍋氭嫋鎷姐€佷笉鍋氱紪杈戝櫒銆?
10. P8 瑙嗚澧炲己蹇呴』鑳借拷婧埌宸查噰鐢ㄧ殑 HomeMapState銆?## P8 Geometry Renderer 绾犲亸绾㈢嚎

1. 瀹氱増鏂囨。浼樺厛浜?P8.1 / P8.2 涓存椂璐村浘瀹炵幇銆?2. 姝ｅ紡 Renderer 涓嶈兘浠?WORLD_MAP_ASSETS + backgroundImage 浣滀负涓栫晫鏄剧ず涓昏矾寰勩€?3. 姝ｅ紡 Renderer 涓嶈兘鎶?PNG 璐村浘褰撲綔涓栫晫瀵硅薄鏈綋銆?4. 涓栫晫瀵硅薄蹇呴』鍏堣鐞嗚В鎴愮偣銆佺嚎銆侀潰涓庡嚑浣曠粨鏋勩€?5. 鏍戜笉鏄?tree.png锛屾埧灞嬩笉鏄?house.png锛岄亾璺笉鏄?path.png銆?6. Renderer 鍙兘鏍规嵁 WorldState / VisualState / DrawCommand / Geometry 缁樺埗銆?7. Renderer 涓嶈兘缁曡繃瑙勫垯鐩存帴鎽嗙礌鏉愩€?8. Renderer 涓嶈兘鐢熸垚 placement銆?9. Renderer 涓嶈兘淇敼 HomeMapState銆?10. 璐村浘璧勬簮鍙兘浣滀负闈炴寮忚皟璇曡祫婧愭垨鏈潵瑙嗚鍙傝€冿紝涓嶅緱浣滀负姝ｅ紡涓栫晫鏈綋銆?11. 鍚庣画鏍?/ 鎴垮眿 / 閬撹矾蹇呴』杩涘叆鍑犱綍鎷嗚В鍗忚銆?12. P8.2 PNG 璐村浘鐗堝彧鑳戒綔涓哄巻鍙蹭复鏃堕獙璇侊紝涓嶈兘缁х画鎵╁睍銆?

## P8-G1 Shape Grammar 绾㈢嚎

1. 鐐圭嚎闈㈠浘褰㈢敓鎴愬熀纭€灞傛棭浜?Point / Line / Polygon 宸ョ▼鍗忚銆?2. 鏍戙€佹埧灞嬨€侀亾璺繀椤讳紭鍏堟媶瑙ｄ负鐐广€佺嚎銆侀潰銆?3. ShapeGrammar 涓嶈兘璇诲彇 PNG銆?4. ShapeGrammar 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?5. ShapeGrammar 涓嶈兘鐢熸垚 placement銆?6. ShapeGrammar 涓嶈兘淇敼 HomeMapState銆?7. ShapeGrammar 涓嶈兘缁曡繃 world rules銆?8. ShapeGrammar 鍙弿杩扮粨鏋勶紝涓嶅喅瀹氫笘鐣屾槸鍚﹀彂鐢熷彉鍖栥€?9. 鍚庣画鎺ュ叆蹇呴』缁忚繃 Intent / Plan / Validate / Diff / WorldState銆?10. Renderer 鍙兘璇诲彇鏈€缁?WorldState / Geometry 娲剧敓缁撴灉銆?
## P8-G2 ShapeGrammar Adapter 绾㈢嚎

1. MapPlacement 杩涘叆 EntityGeometry 鏃讹紝tree / house / road 搴斾紭鍏堢粡杩?ShapeGrammar銆?2. ShapeGrammar projection 鍙兘鐢熸垚 footprint / collision / support / influence銆?3. Adapter 涓嶈兘鐢熸垚 placement銆?4. Adapter 涓嶈兘淇敼 HomeMapState銆?5. Adapter 涓嶈兘璇诲彇 PNG銆?6. Adapter 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?7. Adapter 涓嶈兘淇敼 Renderer銆?8. Adapter 涓嶈兘缁曡繃 world rules銆?9. fallback rectangle 閫昏緫蹇呴』淇濈暀锛岄伩鍏嶆湭鏄犲皠瀵硅薄涓柇銆?10. 鍚庣画 geometry audit 蹇呴』鑳界湅鍑?geometry_source銆?
## P8-G3 Geometry Audit 绾㈢嚎

1. Geometry audit 鍙兘璇诲彇 EntityGeometry 涓庤鍒欐牎楠岀粨鏋溿€?2. Geometry audit 涓嶈兘鐢熸垚 placement銆?3. Geometry audit 涓嶈兘淇敼 HomeMapState銆?4. Geometry audit 涓嶈兘璇诲彇 PNG銆?5. Geometry audit 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?6. Geometry audit 涓嶈兘淇敼 Renderer銆?7. geometrySource 蹇呴』鏉ヨ嚜 EntityGeometry.tags銆?8. shapeGrammarCount 鍙兘缁熻 shape_grammar_* 鏉ユ簮銆?9. fallback rectangle 蹇呴』鍙锛屼笉鑳借浼鎴?ShapeGrammar銆?10. unknown source 蹇呴』淇濈暀锛屼笉鑳介潤榛樺悶鎺夈€?
## P8-G4 Renderer Geometry Projection 绾㈢嚎

1. Renderer 璇诲彇 VisualPlacement.footprint / collision / support / influence 缁樺埗銆?2. Renderer 涓嶈兘璇诲彇 PNG銆?3. Renderer 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?4. Renderer 涓嶈兘鐢熸垚 placement銆?5. Renderer 涓嶈兘淇敼 HomeMapState銆?6. Renderer 涓嶈兘璇诲彇 proposal 褰撲綔鐜板疄銆?7. SVG geometry layer 鏄寮忓嚑浣曚富缁樺埗灞傘€?8. CSS procedural fallback 鍙兘浣滀负涓存椂鍙灞傘€?9. ground / path / zone / edge 涓嶈兘缁х画鐢ㄥぇ閲?CSS fallback 閾烘弧閬尅鍑犱綍灞傘€?10. 鍚庣画瑙嗚澧炲己蹇呴』缁х画杩芥函鍒?Geometry / VisualState / WorldState銆?
## P8-G5 Geometry Visual Readability 绾㈢嚎

1. G5 鍙寮?Renderer 鍑犱綍鍙鎬э紝涓嶄慨鏀逛笘鐣岀敓鎴愩€?2. geometry source 蹇呴』鏉ヨ嚜 VisualPlacement.tags / EntityGeometry.tags銆?3. Renderer 涓嶈兘閲嶆柊鎺ㄦ柇涓栫晫浜嬪疄銆?4. Renderer 涓嶈兘鐢熸垚 placement銆?5. Renderer 涓嶈兘淇敼 HomeMapState銆?6. Renderer 涓嶈兘璇诲彇 PNG銆?7. Renderer 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?8. CSS fallback 鍙兘浣滀负杈呭姪鍙灞傘€?9. ground / path / zone / edge 涓嶈兘閲嶆柊鐢?fallback 澶ч噺閾烘弧銆?10. tree / house / road 鐨勮瑙夊尯鍒嗗繀椤昏拷婧埌 ShapeGrammar / Geometry 鏉ユ簮銆?
## P8-G5.1 VisualState Geometry Tags 绾㈢嚎

1. VisualState 鍙互閫忎紶 EntityGeometry.tags锛屼絾涓嶈兘鐢熸垚鏂扮殑涓栫晫浜嬪疄銆?2. VisualState 涓嶈兘鐢熸垚 placement銆?3. VisualState 涓嶈兘淇敼 HomeMapState銆?4. geometry_source 蹇呴』鏉ヨ嚜 EntityGeometry.tags銆?5. VisualPlacement.tags 蹇呴』淇濈暀 placement.tags / visual_rule / placement_layer銆?6. tags 蹇呴』鍘婚噸銆?7. Renderer 鐨?geometry source 鍒ゆ柇鍙兘渚濊禆 VisualPlacement.tags銆?8. 鏈樁娈典笉鑳戒慨鏀?Renderer銆?9. 鏈樁娈典笉鑳借鍙?PNG銆?10. 鏈樁娈典笉鑳借鍙?WORLD_MAP_ASSETS銆?
## P8-G6 Geometry Source Diagnostics 绾㈢嚎

1. Diagnostics 鍙兘璇诲彇 VisualPlacement.tags銆?2. Diagnostics 涓嶈兘璇诲彇 PNG銆?3. Diagnostics 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?4. Diagnostics 涓嶈兘鐢熸垚 placement銆?5. Diagnostics 涓嶈兘淇敼 HomeMapState銆?6. Diagnostics 涓嶈兘閲嶆柊鎺ㄦ柇涓栫晫浜嬪疄銆?7. Diagnostics 涓嶈兘璇诲彇 proposal 褰撲綔鐜板疄銆?8. Diagnostics 鍙敤浜庨〉闈㈠璁★紝涓嶅弬涓庝笘鐣岃繍琛屻€?9. 姣忎釜 source 鍒嗙粍蹇呴』淇濈暀 unknown銆?10. 姣忎釜 source 鍒嗙粍蹇呴』鑳界湅鍑?footprint / collision / support / influence 鏄惁瀛樺湪銆?
## P8-G7 World Geometry Overview Debug 绾㈢嚎

1. Overview Debug 鍙兘璇诲彇 Geometry Source Diagnostics 鐨勫彧璇荤粨鏋溿€?2. Overview Debug 涓嶆槸鏈€缁堢帺瀹?UI銆?3. Overview Debug 涓嶈兘璇诲彇 PNG銆?4. Overview Debug 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?5. Overview Debug 涓嶈兘鐢熸垚 placement銆?6. Overview Debug 涓嶈兘淇敼 HomeMapState銆?7. Overview Debug 涓嶈兘閲嶆柊鎺ㄦ柇涓栫晫浜嬪疄銆?8. Overview Debug 涓嶅弬涓庝笘鐣岃繍琛屻€?9. Overview Debug 鍙兘鎶?geometry_source 缈昏瘧鎴愬紑鍙戞湡鍙鎽樿銆?10. fallback 鍜?unknown 蹇呴』淇濈暀鏄剧ず銆?11. 寮€鍙戞湡鍙琛ㄨ揪涓嶈兘鎺╃洊搴曞眰 Geometry / ShapeGrammar 鏉ユ簮銆?
## P8-G8 Geometry Visual Stage Closeout 绾㈢嚎

1. P8-G8 鍙仛鏂囨。鏀跺彛锛屼笉鏂板杩愯鏃跺姛鑳姐€?2. P8-G 鏀跺彛鍚庯紝姝ｅ紡 Renderer 浠嶇劧鍙兘璇诲彇 WorldState / VisualState / Geometry 娲剧敓缁撴灉銆?3. Renderer 涓嶈兘璇诲彇 PNG 浣滀负姝ｅ紡涓栫晫鏈綋銆?4. Renderer 涓嶈兘璇诲彇 WORLD_MAP_ASSETS 浣滀负姝ｅ紡鏄剧ず涓昏矾寰勩€?5. Renderer 涓嶈兘浣跨敤 backgroundImage 浣滀负姝ｅ紡涓栫晫瀵硅薄缁樺埗鏂瑰紡銆?6. Renderer 涓嶈兘鐢熸垚 placement銆?7. Renderer 涓嶈兘淇敼 HomeMapState銆?8. Renderer 涓嶈兘璇诲彇 proposal 褰撲綔鐜板疄銆?9. World Geometry Overview Debug / Geometry Source Diagnostics 浠嶇劧鏄紑鍙戞湡 Debug 璇婃柇鍖猴紝涓嶆槸鏈€缁堢帺瀹?UI銆?10. 涓嬩竴闃舵 P8-H 瑙掕壊鍗犱綅浠嶅繀椤绘潵鑷笘鐣岀姸鎬佷笌鍑犱綍閾捐矾锛屼笉寰楃敤 UI 涓存椂鐘舵€佷吉閫犲瓨鍦ㄣ€?

## P8-H0 Actor Geometry Placeholder Plan 绾㈢嚎

1. P8-H0 鍙仛瑙勫垝鏂囨。锛屼笉鏂板杩愯鏃跺姛鑳姐€?2. 绠″ / 瀹犵墿鏄剧ず蹇呴』鏉ヨ嚜涓栫晫鐘舵€佹垨 actor runtime projection銆?3. Renderer 涓嶈兘鐢熸垚 actor銆?4. Renderer 涓嶈兘鐢熸垚 placement銆?5. Renderer 涓嶈兘淇敼 HomeMapState銆?6. Renderer 涓嶈兘鐢?UI 涓存椂鐘舵€佷吉閫犺鑹插瓨鍦ㄣ€?7. 绠″鏄鐞嗚€咃紝涓嶆槸鐜╁鎵嬪姩鎿嶆帶瑙掕壊銆?8. 瀹犵墿鏄嫭绔嬬敓鍛斤紝涓嶆槸鎸夐挳椹卞姩瀵硅薄銆?9. 瀹犵墿涓嶈兘閫氳繃浜嬩欢鏂囨湰璇翠汉璇濄€?10. Actor geometry 涓嶈兘璇诲彇 PNG銆?11. Actor geometry 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?12. Actor geometry 涓嶈兘浣跨敤 backgroundImage / img / next/image 浣滀负姝ｅ紡瑙掕壊鏄剧ず銆?13. Actor projection 涓嶈兘鍐欏洖 placement銆?14. Actor Debug Diagnostics 涓嶆槸鏈€缁堢帺瀹?UI銆?15. 鍚庣画鍔ㄧ敾蹇呴』鐢?runtime state / behavior state 娲剧敓銆?

## P8-H1 Actor Geometry Projection Protocol 绾㈢嚎

1. Actor Geometry Projection 鏄彧璇诲嚑浣曟姇褰憋紝涓嶆槸 MapPlacement銆?2. Actor Geometry 涓嶈兘鍐欏洖 HomeMapState銆?3. Actor Geometry 涓嶈兘鐢熸垚 placement銆?4. Actor Geometry 涓嶈兘鑷繁鍐冲畾瑙掕壊鏄惁瀛樺湪銆?5. Actor Geometry 涓嶈兘鑷繁鍐冲畾瑙掕壊浣嶇疆锛宎nchor 蹇呴』鏉ヨ嚜杈撳叆銆?6. Actor Geometry builder 蹇呴』 deterministic銆?7. Actor Geometry 涓嶈兘璇诲彇 PNG銆?8. Actor Geometry 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?9. Actor Geometry 涓嶈兘瀵煎叆 map-assets銆?10. Actor Geometry 涓嶈兘瀵煎叆 Renderer銆?11. Actor Geometry 涓嶈兘瀵煎叆 HomeMapState銆?12. Actor Geometry 涓嶈兘淇敼 runtime銆?13. 绠″ / 瀹犵墿鍚庣画鏄剧ず蹇呴』鏉ヨ嚜涓栫晫鐘舵€佹垨 actor runtime projection銆?14. 瀹犵墿涓嶈兘閫氳繃浜嬩欢鏂囨湰璇翠汉璇濄€?15. 绠″涓嶈兘鏇垮疇鐗╁仛鍐冲畾銆?

## P8-H2 Actor Runtime Projection Input Boundary 绾㈢嚎

1. Actor Runtime Projection 鍙兘瀹氫箟杞婚噺杈撳叆杈圭晫锛屼笉鎺?Renderer銆?2. Actor Runtime Projection 涓嶈兘鎺?VisualState銆?3. Actor Runtime Projection 涓嶈兘淇敼 world-loop銆?4. Actor Runtime Projection 涓嶈兘淇敼 HomeMapState銆?5. Actor Runtime Projection 涓嶈兘鐢熸垚 placement銆?6. Actor Runtime Projection 涓嶈兘瀵煎叆 ButlerRuntimeContext銆?7. Actor Runtime Projection 涓嶈兘瀵煎叆 PetState銆?8. Actor Runtime Projection 涓嶈兘璇诲彇 PNG銆?9. Actor Runtime Projection 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?10. Actor Runtime Projection 涓嶈兘瀵煎叆 map-assets銆?11. Actor Runtime Projection 涓嶈兘瀵煎叆 Renderer銆?12. projection 蹇呴』 deterministic銆?13. anchor 缂虹渷鏃跺彧鑳戒娇鐢?deterministic placeholder anchor锛屽苟蹇呴』閫氳繃 reason / tags 鍙瘑鍒€?14. pet isBorn === false 鏃?presence 蹇呴』鏄?not_ready锛宑anProject 蹇呴』鏄?false銆?15. placeholder 涓嶈兘浠ｈ〃鏈€缁?autonomous movement锛屼笉鑳藉啓鍥?HomeMapState銆?

## P8-H3 Actor Runtime To Geometry Projection 绾㈢嚎

1. H3 鍙厑璁告妸 ActorRuntimeProjectionResult 杞崲涓?ActorGeometryProjection銆?2. H3 涓嶆帴 Renderer銆?3. H3 涓嶆帴 VisualState銆?4. H3 涓嶈兘淇敼 world-loop銆?5. H3 涓嶈兘淇敼 HomeMapState銆?6. H3 涓嶈兘鐢熸垚 placement銆?7. runtimeProjection.canProject === false 鏃剁粷涓嶈兘鐢熸垚 geometryProjection銆?8. pet 鏈嚭鐢?not_ready 鏃跺繀椤昏繑鍥?skipped_not_ready銆?9. deterministic placeholder anchor 蹇呴』閫氳繃 geometrySource / tags 淇濇寔鍙銆?10. placeholder 涓嶈兘浠ｈ〃鏈€缁?autonomous movement銆?11. H3 涓嶈兘璇诲彇 PNG銆?12. H3 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?13. H3 涓嶈兘瀵煎叆 map-assets銆?14. H3 涓嶈兘瀵煎叆 Renderer / HomeMapState / ButlerRuntimeContext / PetState銆?15. H3 涓嶈兘淇敼 runtime state銆?

## P8-H4 VisualState Actor Geometry Projection 绾㈢嚎

1. VisualState 鍙兘鎵胯浇 actor geometry projection锛屼笉鑳界敓鎴?actor銆?2. VisualState 涓嶈兘鐢熸垚 placement銆?3. VisualState 涓嶈兘淇敼 HomeMapState銆?4. VisualActorGeometryProjection 涓嶆槸 VisualPlacement銆?5. VisualActorGeometryProjection 涓嶆槸 MapPlacement銆?6. actorRuntimeGeometryProjections 缂虹渷鏃跺繀椤讳负绌烘暟缁勩€?7. canProject === false 鏃朵笉鑳藉己琛岃ˉ geometryProjection銆?8. pet 鏈嚭鐢?skipped_not_ready 鍙兘琚壙杞斤紝涓嶈兘琚樉绀哄眰浼鎴?present銆?9. 鏈樁娈典笉鑳戒慨鏀?Renderer 缁勪欢銆?10. 鏈樁娈典笉鑳戒慨鏀?/world 椤甸潰銆?11. 鏈樁娈典笉鑳戒慨鏀?world-loop / runtime state銆?12. 鏈樁娈典笉鑳借鍙?PNG銆?13. 鏈樁娈典笉鑳借鍙?WORLD_MAP_ASSETS銆?14. 鏈樁娈典笉鑳戒娇鐢?backgroundImage / img / next/image銆?15. Renderer 鍚庣画鍙兘鍙 VisualState.actorGeometryProjections銆?

## P8-H5 Renderer Actor Geometry Display 绾㈢嚎

1. Renderer 鍙兘璇诲彇 VisualState.actorGeometryProjections銆?2. Renderer 涓嶈兘鐢熸垚 actor銆?3. Renderer 涓嶈兘鐢熸垚 actor projection銆?4. Renderer 涓嶈兘鍐冲畾瑙掕壊鏄惁瀛樺湪銆?5. Renderer 涓嶈兘濉粯璁?anchor銆?6. Renderer 涓嶈兘鐢熸垚 placement銆?7. Renderer 涓嶈兘淇敼 HomeMapState銆?8. Renderer 涓嶈兘璇诲彇 PNG銆?9. Renderer 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?10. Renderer 涓嶈兘浣跨敤 backgroundImage / img / next/image銆?11. VisualState.actorGeometryProjections 涓虹┖鏃跺繀椤绘樉绀?0锛屼笉鑳戒吉閫犵瀹舵垨瀹犵墿銆?12. canProject === false 鏃朵笉鑳界粯鍒?actor geometry銆?13. pet 鏈嚭鐢?skipped_not_ready 鏃朵笉鑳界粯鍒跺疇鐗?actor銆?14. Actor Geometry Diagnostics 涓嶆槸鏈€缁堢帺瀹?UI銆?15. 鍚庣画 actor 鏁版嵁蹇呴』鐢变笂娓?world snapshot / VisualState 杈撳叆锛屼笉鑳界敱 Renderer 鏋勯€犮€?

## P8-H6 Actor Projection World Snapshot Integration 绾㈢嚎

1. world-loop renderable state 鍙互娲剧敓鍙 butler actor projection銆?2. 鏈樁娈靛彧鑳芥帴鍏?butler锛屼笉鑳芥帴鍏?pet 榛樿 actor銆?3. pet 涓嶆槸寮€灞€榛樿璧勪骇锛屼笉鑳戒负浜嗙敾闈㈠畬鏁磋€屼吉閫犮€?4. actor projection 蹇呴』浠?HomeMapState 娲剧敓 anchor銆?5. actor projection 涓嶈兘鐢熸垚 MapPlacement銆?6. actor projection 涓嶈兘淇敼 HomeMapState銆?7. actor projection 涓嶈兘鍐欏叆 mapDiff銆?8. Renderer 浠嶇劧涓嶈兘鐢熸垚 actor銆?9. Renderer 浠嶇劧涓嶈兘鍐冲畾瑙掕壊鏄惁瀛樺湪銆?10. Renderer 浠嶇劧涓嶈兘濉粯璁?anchor銆?11. 涓嶈兘璇诲彇 PNG銆?12. 涓嶈兘璇诲彇 WORLD_MAP_ASSETS銆?13. 涓嶈兘浣跨敤 backgroundImage / img / next/image銆?14. 绠″ projection v0 涓嶆槸鏈€缁堢瀹惰涓虹郴缁熴€?15. butler anchor 涓嶄唬琛ㄦ渶缁?autonomous movement銆?

## P8-H7 Actor Geometry Debug Readability Closeout 绾㈢嚎

1. H7 鍙寮?Actor Geometry Debug 鍙鎬э紝涓嶆敼鍙?actor projection 閾捐矾銆?2. 褰撳墠 actor 鍥惧舰蹇呴』鏍囪涓?Debug 鍑犱綍鍗犱綅銆?3. 褰撳墠 actor 鍥惧舰涓嶆槸鏈€缁堢帺瀹?UI銆?4. 褰撳墠 actor 鍥惧舰涓嶆槸鏈€缁堣鑹茬編鏈€?5. 褰撳墠 actor 鍥惧舰涓嶄唬琛ㄦ渶缁?autonomous movement銆?6. 鏈樁娈靛彧鎺ュ叆 butler锛屼笉鎺ュ叆 pet銆?7. Renderer 鍙兘璇诲彇 VisualState.actorGeometryProjections 涓?tags銆?8. Renderer 涓嶈兘閲嶆柊鎺ㄦ柇涓栫晫浜嬪疄銆?9. Renderer 涓嶈兘鐢熸垚 actor銆?10. Renderer 涓嶈兘濉粯璁?anchor銆?11. 鏈樁娈典笉鑳界敓鎴?MapPlacement銆?12. 鏈樁娈典笉鑳戒慨鏀?HomeMapState銆?13. 鏈樁娈典笉鑳藉啓鍏?mapDiff銆?14. 鏈樁娈典笉鑳借鍙?PNG / WORLD_MAP_ASSETS銆?15. 鏈樁娈典笉鑳戒娇鐢?backgroundImage / img / next/image銆?

## P8-H8 Actor Geometry Closeout / Formal World View Separation 绾㈢嚎

1. H8 鍙仛 Actor Geometry 闃舵鏀跺彛涓?Formal World View 鍒嗙瑙勫垝锛屼笉鏂板杩愯鏃跺姛鑳姐€?2. 褰撳墠 /world 鐨勫嚑浣?/ 绋嬪簭鍖栬瑙夐瑙?v1 蹇呴』琚涓?Debug View / Dev View銆?3. 褰撳墠澶ч潰绉綉鏍笺€佺嚎妗嗐€佽瘖鏂潰鏉夸笉鑳借褰撲綔鏈€缁堢帺瀹朵富瑙嗚銆?4. 褰撳墠 actor Debug 鍗犱綅涓嶈兘琚綋浣滄渶缁堣鑹茬編鏈€?5. 褰撳墠 actor Debug 鍗犱綅涓嶈兘琚綋浣滄渶缁?autonomous movement銆?6. Debug View 鍙互淇濈暀 raw geometry / raw tags / diagnostics / audit data銆?7. Formal World View 涓嶈兘鐩存帴鏄剧ず raw tags / source diagnostics / collision boxes / F-C-S-I銆?8. Formal World View 涓嶈兘鎶?Debug reason / anchor source 鍘熷 tag 鏆撮湶缁欐渶缁堢帺瀹朵富瑙嗚銆?9. Formal World View 浠嶇劧鍙兘璇诲彇 VisualState / RenderableWorldSnapshot 涓凡缁忓瓨鍦ㄧ殑浜嬪疄銆?10. Formal World View 涓嶈兘鐢熸垚 actor銆?11. Formal World View 涓嶈兘鐢熸垚 placement銆?12. Formal World View 涓嶈兘淇敼 HomeMapState銆?13. Formal World View 涓嶈兘璇诲彇 proposal 褰撶幇瀹炪€?14. Formal World View 涓嶈兘璇诲彇 PNG / WORLD_MAP_ASSETS 浣滀负姝ｅ紡涓昏矾寰勩€?15. pet 涓嶈兘浣滀负榛樿 actor 鎺ュ叆锛屽繀椤荤户缁伒瀹堢敓鍛藉叧绯讳簨浠跺悗缃師鍒欍€?

## P8-I Route Reset / FormalVisualModel 绾㈢嚎

1. P8-I0 / P8-I1 / P8-I2 / P8-I3 鐨勬棫 FormalWorldView 璺嚎鍏ㄩ儴浣滃簾銆?2. FormalWorldView 涓嶈兘鐢熸垚 FormalWorldVisualItem銆?3. FormalWorldView 涓嶈兘鐢熸垚 FormalActorVisualItem銆?4. FormalWorldView 涓嶈兘鍦ㄧ粍浠跺唴鍐冲畾鍦伴潰銆侀亾璺€佸缓绛戙€佹爲鏈ㄣ€佽鏂姐€乤ctor 鐨勬寮忚瑙夎〃鐜般€?5. 姝ｅ紡瑙嗚妯″瀷蹇呴』鏉ヨ嚜 src/world/formal-visual-model/銆?6. FormalVisualModel / FormalVisualGenerator 蹇呴』鏃╀簬鏂扮殑 FormalWorldView銆?7. FormalWorldView 鍙兘鍙 FormalVisualModel 娓叉煋銆?8. 鏈 reset 涓嶅疄鐜?FormalVisualModel schema銆?9. 鏈 reset 涓嶅疄鐜?FormalVisualGenerator銆?10. 鏈 reset 涓嶆柊澧炴柊鐨?FormalWorldView銆?11. 鏈 reset 涓嶄慨鏀?/world 椤甸潰銆?12. 鏈 reset 涓嶄慨鏀?ProceduralRendererView銆?13. P8-H Debug Geometry / Actor Projection 閾捐矾淇濈暀銆?14. 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?15. 涓嶇敓鎴?actor / placement锛屼笉淇敼 HomeMapState銆?

