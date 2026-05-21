# AI-PET-WORLD P8.0 姝ｅ紡瑙嗚闃舵瑙勫垝

## 1. P8.0 鐨勫畾浣?
P8.0 鏄寮忚瑙夐樁娈电殑寮€绡囪鍒掓枃妗ｃ€?
P7 宸茬粡瀹屾垚锛?
```text
鐪熷疄 runtime context 杈撳叆
-> intent context adapter
-> 鎵嬪姩 Tick
-> WorldChangePlan
-> WorldDiffProposal
-> MapDiff validation
-> Audit
-> Execution
-> SafeApply
-> HomeMapState 鏇存柊
-> Renderer 璇诲彇褰撳墠涓栫晫浜嬪疄
```

P8 涓嶇户缁墿灞曞簳灞備笘鐣岄棴鐜紝鑰屾槸璐熻矗鎶婂凡缁忓瓨鍦ㄧ殑涓栫晫浜嬪疄绋冲畾鏄剧ず鍑烘潵銆?
鏍规嵁瀹氱増鏂囨。锛孭8 鐨勬寮忚瑙夋柟鍚戜笉鏄创鍥惧湴鍥撅紝鑰屾槸鏍规嵁鐐广€佺嚎銆侀潰 / VisualState / DrawCommand / Geometry 绋嬪簭鍖栫粯鍒朵笘鐣屻€?
## 2. 褰撳墠瑙嗚鐘舵€?
褰撳墠 `/world` 宸茬粡鍏峰锛?
1. HomeMapState銆?2. RenderableWorldSnapshot銆?3. VisualState銆?4. DrawCommand銆?5. ProceduralRendererView銆?6. 鍩虹绾挎棰勮銆?7. 鍒濆涓栫晫鏁版嵁鍙鍖栥€?8. Tick 鍚?MapDiff 鍙互鏀瑰彉 HomeMapState銆?
褰撳墠鐩爣涓嶆槸璁╀笘鐣屽彉鎴?PNG 鎷艰创鐢伙紝鑰屾槸璁╀笘鐣屼粠瑙勫垯涓庡嚑浣曠粨鏋勪腑琚粯鍒跺嚭鏉ャ€?
## 3. P8 鐨勬牳蹇冪洰鏍?
P8 鐨勭洰鏍囦笉鏄 Renderer 鐢熸垚涓栫晫锛岃€屾槸璁?Renderer 蹇犲疄鏄剧ず涓栫晫宸茬粡瀛樺湪鐨勪簨瀹炪€?
鏍稿績鐩爣锛?
1. 灏?RenderableWorldSnapshot 涓殑 DrawCommand 绋冲畾鏄剧ず涓哄嚑浣曡緟鍔╀俊鎭€?2. 灏?VisualState 涓殑 placement 鏄剧ず涓虹▼搴忓寲鐐广€佺嚎銆侀潰瀵硅薄銆?3. 楠岃瘉 P7.23 鐨?world change 鍦ㄧ敾闈笂鍙銆?4. 淇濇寔 Renderer 鍙锛屼笉鍐欎笘鐣屻€?5. 淇濇寔瑙嗚澧炲己涓嶅弽鍚戝垱閫?placement銆?6. 涓虹瀹?/ 瀹犵墿鍑犱綍鍗犱綅鍜屽悗缁姩鐢绘墦鍩虹銆?
## 4. P8 涓?P7 鐨勮竟鐣?
P7 璐熻矗锛?
```text
涓栫晫浜嬪疄濡備綍鐢熸垚
```

P8 璐熻矗锛?
```text
涓栫晫浜嬪疄濡備綍鏄剧ず
```

P8 涓嶈兘鍙嶅悜鎵挎媴 P7 鐨勮亴璐ｃ€?
绂佹 P8 鍋氾細

1. 鐢熸垚 MapDiff銆?2. 淇敼 HomeMapState銆?3. 淇敼 RuntimeWorldState銆?4. 淇敼 intent decision銆?5. 淇敼 proposal銆?6. 缁曡繃 SafeApply銆?7. 鎶?debug scenario 褰撴寮忎笘鐣屻€?8. 涓轰簡濂界湅涓存椂琛ラ€犱笉瀛樺湪鐨勫璞°€?
## 5. 姝ｅ紡 Renderer 杈撳叆杈圭晫

姝ｅ紡瑙嗚灞傚彧鍏佽璇诲彇锛?
1. RenderableWorldSnapshot銆?2. VisualState銆?3. VisualPlacement銆?4. DrawCommand銆?5. Geometry 娲剧敓淇℃伅銆?6. HomeMapState 涓凡缁忓瓨鍦ㄧ殑 placement 娲剧敓缁撴灉銆?
姝ｅ紡瑙嗚灞備笉鑳借鍙栵細

1. IntentDecision銆?2. WorldChangePlan銆?3. WorldDiffProposal銆?4. WorldEvolutionAuditReport銆?5. WorldEvolutionExecutionResult銆?6. SafeApplyDecision 鍐呴儴鍒ゆ柇杩囩▼銆?7. Debug scenario result銆?8. 鏈粡閲囩敤鐨?proposal銆?9. localStorage 鍘熷 persisted JSON銆?10. personality-core 鍘熷鐩橀潰銆?11. WORLD_MAP_ASSETS 浣滀负姝ｅ紡鏄剧ず涓昏矾寰勩€?
## 6. P8 鍒嗛樁娈佃矾绾?
### P8.0锛氭寮忚瑙夐樁娈佃鍒?
鍙啓瑙勫垝鏂囨。锛屾槑纭?P8 瑙嗚杈圭晫銆?
### P8.1锛氳创鍥捐矾绾垮簾寮冧笌鍑犱綍璺嚎纭

鏄庣‘ `WORLD_MAP_ASSETS / assetId / PNG` 璺嚎涓嶈兘浣滀负姝ｅ紡 Renderer銆傛寮忚矾绾胯浆涓哄嚑浣?/ 绋嬪簭鍖栫粯鍒躲€?
### P8.2锛氬嚑浣?/ 绋嬪簭鍖?Renderer 绗竴鐗?
瀹炵幇姝ｅ紡 Renderer v1銆?
瑕佹眰锛?
1. 璇诲彇 RenderableWorldSnapshot銆?2. 璇诲彇 VisualState / VisualPlacement / DrawCommand銆?3. 鎸?layer 鎺掑簭銆?4. 鎸?placement anchor / scale / alpha 鍋氱▼搴忓寲缁樺埗銆?5. 鐢ㄧ▼搴忓寲 CSS 褰㈢姸琛ㄨ揪 ground / path / structure / facility / nature / surface-decoration / actor銆?6. 涓嶈鍙?PNG 鍥剧墖銆?7. 涓嶈鍙?WORLD_MAP_ASSETS銆?8. 涓嶅仛鍔ㄧ敾銆?9. 涓嶅仛澶嶆潅浜や簰銆?10. 涓嶄慨鏀逛笘鐣岀姸鎬併€?
### P8.3锛氬嚑浣曡瑙夊彉鍖栭獙璇?
楠岃瘉 P7.23 鐨勫彉鍖栬兘琚湅瑙侊細

1. plant_nature锛氭柊澧炶嚜鐒剁粏鑺傘€?2. build_path锛氭柊澧炶矾寰勩€?3. clean_area锛氭竻鐞?surface-decoration銆?4. repair_facility锛氳鏂界姸鎬佸彉鍖栥€?
楠岃瘉蹇呴』鍩轰簬 SafeApply 涔嬪悗鐨?HomeMapState 娲剧敓 RenderableWorldSnapshot銆?
### P8.4锛氱瀹朵笌瀹犵墿鍑犱綍鍗犱綅鏄剧ず

P8.4 鍙€冭檻绠″ / 瀹犵墿鍗犱綅锛屼絾涔熷繀椤绘槸鍑犱綍 / 绋嬪簭鍖栧崰浣嶏紝涓嶆槸 PNG 璐村浘銆?
### P8.5锛氳瑙夌姸鎬佷笌涓栫晫鐘舵€佹敹鍙?
纭姝ｅ紡 Renderer 娌℃湁鍙嶅悜鐢熸垚涓栫晫浜嬪疄銆?
## 7. P8.2 绗竴鐗堣寖鍥?
姝ｅ紡 Renderer v1 鍙仛鏈€灏忓彲瑙佺増鏈細

1. 鍦板浘瀹瑰櫒銆?2. 缃戞牸淇濈暀涓?debug overlay銆?3. ground / path / zone / structure / facility / nature / surface-decoration / actor 鍒嗗眰鏄剧ず銆?4. 鏍规嵁 placement 鐨?anchor / scale / alpha 鏄剧ず瀵硅薄銆?5. 鏍规嵁 layer 鍜屽嚑浣曞惈涔夐€夋嫨绋嬪簭鍖栧舰鐘躲€?6. 涓嶅仛鎷栨嫿銆?7. 涓嶅仛鐐瑰嚮缂栬緫銆?8. 涓嶅仛鍔ㄧ敾銆?9. 涓嶅仛鐩告満绯荤粺銆?10. 涓嶅仛缇庢湳閲嶅埗銆?
鐩爣鏄細

```text
鍏堣涓栫晫鍍忕敱瑙勫垯鍜屽嚑浣曠敓鎴愮殑涓栫晫
```

鑰屼笉鏄細

```text
鍏堣涓栫晫鍍忎竴缁勮创鍥剧礌鏉?```

## 8. P8.3 鍙鍙樺寲楠屾敹鏍囧噯

P8.3 鐨勯獙鏀舵爣鍑嗭細

1. plant_nature 鐢熸垚鐨勬柊鑷劧缁嗚妭鑳藉湪鍑犱綍 / 绋嬪簭鍖栬瑙変腑鐪嬭銆?2. build_path 鐢熸垚鐨勬柊璺緞鑳藉湪鍑犱綍 / 绋嬪簭鍖栬瑙変腑鐪嬭銆?3. clean_area 鍒犻櫎鐨?surface-decoration 鑳藉湪鐢婚潰涓婃秷澶便€?4. repair_facility 鏇存柊鐨?facility 鑷冲皯鑳介€氳繃 label / alpha / tags 鐘舵€佺‘璁ゃ€?5. 鎵€鏈夊彉鍖栦粛鐒舵潵鑷?SafeApply 涔嬪悗鐨?HomeMapState銆?6. Renderer 涓嶈鍙?proposal銆?7. Renderer 涓嶇敓鎴?placement銆?8. Renderer 涓嶄慨鏀?HomeMapState銆?
## 9. 绠″涓庡疇鐗╄瑙夊師鍒?
绠″鍜屽疇鐗╄瑙夎繘鍏?P8.4銆?
鍘熷垯锛?
1. 绠″鏄鐞嗚€咃紝涓嶆槸鐜╁鎵嬪姩鎿嶆帶瑙掕壊銆?2. 瀹犵墿鏄嫭绔嬬敓鍛斤紝涓嶆槸鎸夐挳椹卞姩瀵硅薄銆?3. 瑙掕壊鏄剧ず鏉ヨ嚜涓栫晫鐘舵€侊紝涓嶆潵鑷?UI 涓存椂鐘舵€併€?4. 瀹犵墿涓嶈兘閫氳繃浜嬩欢鏂囨湰璇翠汉璇濄€?5. 绠″ / 瀹犵墿鍔ㄧ敾鍚庣画蹇呴』鐢?runtime state / behavior state 娲剧敓銆?6. 鍒濇湡鍙厑璁稿嚑浣?/ 绋嬪簭鍖栧崰浣嶏紝涓嶆帴澶嶆潅鍔ㄧ敾鏍戙€?
## 10. 绂佹浜嬮」

P8 绂佹锛?
1. Renderer 鐢熸垚 placement銆?2. Renderer 淇敼 HomeMapState銆?3. Renderer 鐩存帴搴旂敤 MapDiff銆?4. Renderer 璇诲彇鏈噰鐢?proposal銆?5. Renderer 鏍规嵁瑙嗚闇€瑕佷吉閫犲璞°€?6. 姝ｅ紡 `/world` 浣跨敤 debug scenario 浣滀负涓栫晫浜嬪疄銆?7. 姝ｅ紡 Renderer 娣卞眰瀵煎叆 personality-core銆?8. 瑙嗚缁勪欢鎺ョ world-loop銆?9. 涓轰簡鍔ㄧ敾缁曡繃 runtime state銆?10. 浠?WORLD_MAP_ASSETS + PNG 浣滀负姝ｅ紡涓栫晫鏄剧ず涓昏矾寰勩€?11. 鎶婃爲銆佹埧灞嬨€侀亾璺悊瑙ｄ负鍥剧墖锛岃€屼笉鏄偣銆佺嚎銆侀潰涓庡嚑浣曠粨鏋勩€?
## 11. 褰撳墠缁撹

P8.0 閿佸畾姝ｅ紡瑙嗚闃舵杈圭晫銆?
褰撳墠姝ｅ紡璺嚎涓猴細

```text
VisualState / DrawCommand / VisualPlacement / Geometry
-> 鍑犱綍 / 绋嬪簭鍖栫粯鍒?-> Renderer 鏄剧ず褰撳墠涓栫晫浜嬪疄
```

PNG 璐村浘璺嚎宸茬粡绾犲亸锛屼笉鍐嶄綔涓烘寮?Renderer 璺嚎銆?
## 12. P8-G 鍑犱綍瑙嗚绾犲亸涓庢敹鍙ｈ褰?
P8 鍘熻鍒掍腑 P8.1 / P8.2 鏇剧粡鍑虹幇杩?PNG / asset 璐村浘璺嚎鍋忓樊銆?
鏍规嵁瀹氱増鏂囨。锛孭8 宸茬粡绾犲亸涓?Geometry / ShapeGrammar / VisualState 璺嚎銆?
宸插畬鎴愯ˉ鍏呴樁娈碉細

1. P8-GEOMETRY-REPAIR锛氱籂鍋忔寮?Renderer锛屼笉鍐嶄娇鐢?PNG / WORLD_MAP_ASSETS / backgroundImage銆?2. P8-G1锛氭柊澧?ShapeGrammar 鐐圭嚎闈㈠熀纭€鍗忚銆?3. P8-G2锛歋hapeGrammar 鎺ュ叆 placement geometry adapter銆?4. P8-G3锛欸eometry audit 鏄剧ず ShapeGrammar 鏉ユ簮銆?5. P8-G4锛歊enderer 璇诲彇 geometry projection 骞剁敤 SVG 缁樺埗銆?6. P8-G4.1锛氫慨澶嶄腑鏂囦贡鐮併€?7. P8-G5锛氬寮?geometry source 鍙鎬с€?8. P8-G5.1锛歏isualState 閫忎紶 EntityGeometry.tags銆?9. P8-G6锛氭柊澧?Geometry Source Diagnostics銆?10. P8-G7锛氭柊澧?World Geometry Overview銆?11. P8-G7.1锛氭槑纭?World Geometry Overview Debug 涓嶆槸鏈€缁堢帺瀹?UI銆?
褰撳墠 P8-G 鏀跺彛缁撹锛?
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

褰撳墠椤甸潰楠岃瘉浣嶇疆锛?
- /world
- 鍑犱綍 / 绋嬪簭鍖栬瑙夐瑙?v1
- World Geometry Overview Debug
- Geometry Source Diagnostics

褰撳墠 Debug 椤甸潰楠岃瘉浣嶇疆锛?
- /world-debug/visual-change-verification
- Before / After
- World Geometry Overview Debug
- Geometry Source Diagnostics

P8-G 涔嬪悗缁х画绂佹锛?
1. Renderer 璇诲彇 PNG 浣滀负姝ｅ紡涓栫晫鏈綋銆?2. Renderer 璇诲彇 WORLD_MAP_ASSETS 浣滀负姝ｅ紡鏄剧ず涓昏矾寰勩€?3. Renderer 浣跨敤 backgroundImage 浣滀负姝ｅ紡涓栫晫瀵硅薄缁樺埗鏂瑰紡銆?4. Renderer 鐢熸垚 placement銆?5. Renderer 淇敼 HomeMapState銆?6. Renderer 璇诲彇 proposal 褰撲綔鐜板疄銆?7. Renderer 涓轰簡瑙嗚鏁堟灉浼€犱笘鐣屽璞°€?8. Debug 璇婃柇鍖鸿鍖呰鎴愭渶缁堢帺瀹?UI銆?9. 绠″ / 瀹犵墿浣跨敤 UI 涓存椂鐘舵€佷吉閫犲瓨鍦ㄣ€?10. 娣锋穯涓栫晫浜嬪疄灞傘€佸嚑浣曟淳鐢熷眰銆丏ebug 灞曠ず灞傘€?
涓嬩竴闃舵寤鸿杩涘叆 P8-H锛氳鑹插嚑浣曞崰浣嶉樁娈点€?

## 13. P8-H 绠″ / 瀹犵墿 actor 鍑犱綍鍗犱綅鍏ュ彛

P8-G 宸插畬鎴愬嚑浣曡瑙夐樁娈垫敹鍙ｃ€?
P8-H 杩涘叆瑙掕壊鍑犱綍鍗犱綅闃舵銆?
P8-H 鐨勭洰鏍囦笉鏄渶缁堣鑹茬編鏈紝涔熶笉鏄鑹插姩鐢伙紝鑰屾槸寤虹珛绠″ / 瀹犵墿 actor 鍦ㄥ嚑浣曡瑙夌郴缁熶腑鐨勫彧璇绘姇褰便€?
P8-H 蹇呴』閬靛畧锛?
1. 瑙掕壊鏄剧ず鏉ヨ嚜涓栫晫鐘舵€佹垨 actor runtime projection銆?2. Renderer 涓嶈兘鐢熸垚 actor銆?3. Renderer 涓嶈兘鐢熸垚 placement銆?4. Renderer 涓嶈兘淇敼 HomeMapState銆?5. Renderer 涓嶈兘鐢?UI 涓存椂鐘舵€佷吉閫犺鑹插瓨鍦ㄣ€?6. 绠″鏄鐞嗚€咃紝涓嶆槸鐜╁鎵嬪姩鎿嶆帶瑙掕壊銆?7. 瀹犵墿鏄嫭绔嬬敓鍛斤紝涓嶆槸鎸夐挳椹卞姩瀵硅薄銆?8. 瀹犵墿涓嶈兘閫氳繃浜嬩欢鏂囨湰璇翠汉璇濄€?9. 鍒濇湡鍙厑璁稿嚑浣?/ 绋嬪簭鍖?actor 鍗犱綅銆?10. 鍚庣画鍔ㄧ敾蹇呴』鐢?runtime state / behavior state 娲剧敓銆?11. 涓嶈鍙?PNG銆?12. 涓嶈鍙?WORLD_MAP_ASSETS銆?13. 涓嶄娇鐢?backgroundImage 浣滀负姝ｅ紡瑙掕壊鏄剧ず銆?
P8-H 鎺ㄨ崘闃舵锛?
1. P8-H0锛歛ctor 鍑犱綍鍗犱綅瑙勫垝銆?2. P8-H1锛欰ctor Geometry Projection 鍗忚銆?3. P8-H2锛欰ctor Runtime Projection 杈撳叆杈圭晫銆?4. P8-H3锛歏isualState 鎺ュ叆 actor projection銆?5. P8-H4锛歊enderer 鏄剧ず actor geometry銆?6. P8-H5锛欰ctor Debug Diagnostics銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H1锛欰ctor Geometry Projection 鍗忚
```

## 14. P8-H1 Actor Geometry Projection 鍗忚璁板綍

P8-H1 宸叉柊澧?actor-geometry 灞傦紝鐢ㄤ簬鎻忚堪绠″ / 瀹犵墿鍦ㄥ嚑浣曡瑙夌郴缁熶腑鐨勫彧璇绘姇褰便€?
Actor Geometry Projection 鍙弿杩帮細

1. actorId銆?2. actorKind锛歜utler / pet銆?3. anchor銆?4. body銆?5. interactionRadius銆?6. pose銆?7. attentionDirection銆?8. source銆?9. tags銆?
P8-H1 涓嶅仛锛?
1. Renderer 鏄剧ず actor銆?2. VisualState 鎺ュ叆 actor銆?3. 鐢熸垚 placement銆?4. 淇敼 HomeMapState銆?5. 淇敼 world-loop銆?6. 淇敼 runtime state銆?7. 璇诲彇 PNG銆?8. 璇诲彇 WORLD_MAP_ASSETS銆?9. 浣跨敤 backgroundImage銆?10. 瑙掕壊鍔ㄧ敾銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H2锛欰ctor Runtime Projection 杈撳叆杈圭晫
```

## 15. P8-H2 Actor Runtime Projection 杈撳叆杈圭晫璁板綍

P8-H2 宸叉柊澧?actor-runtime-projection 灞傘€?
鏈樁娈靛畾涔変粠涓栫晫鐘舵€?/ runtime state 鍒?actor projection 鐨勮交閲忚緭鍏ヨ竟鐣屻€?
Actor Runtime Projection Result 鎻忚堪锛?
1. actorId銆?2. actorKind銆?3. worldId銆?4. presence銆?5. canProject銆?6. anchor銆?7. pose銆?8. attentionDirection銆?9. source銆?10. scale銆?11. reason銆?12. tags銆?
鏈樁娈典笉鐩存帴瀵煎叆 ButlerRuntimeContext / PetState锛岄伩鍏嶈繃搴﹁€﹀悎銆?
褰撳墠鍙彁渚?deterministic placeholder anchor锛?
1. butler锛歿 x: 6, y: 6 }銆?2. pet锛歿 x: 7, y: 6 }銆?
placeholder 鍙敤浜庤緭鍏ヨ竟鐣岄獙璇侊紝涓嶄唬琛ㄦ渶缁?autonomous movement銆?
P8-H2 涓嶅仛锛?
1. Renderer 鏄剧ず actor銆?2. VisualState 鎺ュ叆 actor銆?3. ActorGeometryProjection 涓茶仈銆?4. 鐢熸垚 placement銆?5. 淇敼 HomeMapState銆?6. 淇敼 world-loop銆?7. 淇敼 runtime state銆?8. 璇诲彇 PNG銆?9. 璇诲彇 WORLD_MAP_ASSETS銆?10. 浣跨敤 backgroundImage銆?11. 瑙掕壊鍔ㄧ敾銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H3锛欰ctor Runtime Projection -> Actor Geometry Projection 涓茶仈
```

## 16. P8-H3 Actor Runtime Projection -> Actor Geometry Projection 涓茶仈璁板綍

P8-H3 宸叉柊澧?actor runtime -> geometry adapter銆?
鏈樁娈靛皢 ActorRuntimeProjectionResult 杞崲涓?ActorGeometryProjection銆?
瑙勫垯锛?
1. runtimeProjection.canProject === true 鏃讹紝鎵嶅厑璁哥敓鎴?ActorGeometryProjection銆?2. runtimeProjection.canProject === false 鏃讹紝涓嶇敓鎴?geometryProjection銆?3. pet 鏈嚭鐢熸椂锛宲resence = not_ready锛岀粨鏋滃繀椤绘槸 skipped_not_ready銆?4. deterministic placeholder anchor 蹇呴』閫氳繃 geometrySource / tags 淇濈暀鍙銆?5. adapter 涓嶆帴 Renderer銆?6. adapter 涓嶆帴 VisualState銆?7. adapter 涓嶇敓鎴?placement銆?8. adapter 涓嶄慨鏀?HomeMapState銆?9. adapter 涓嶄慨鏀?runtime state銆?10. adapter 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H4锛歏isualState 鎺ュ叆 actor geometry projection
```

## 17. P8-H4 VisualState 鎺ュ叆 actor geometry projection 璁板綍

P8-H4 宸茶 VisualState 鍙互鎼哄甫 actor geometry projection銆?
鏂板锛?
VisualActorGeometryProjection
VisualState.actorGeometryProjections

VisualState builder 鏂板鍙€夎緭鍏ワ細

actorRuntimeGeometryProjections?: ActorRuntimeGeometryProjectionResult[]

鏈樁娈佃鍒欙細

1. actorRuntimeGeometryProjections 缂虹渷鏃朵负绌烘暟缁勩€?2. 鐜版湁 buildVisualState 璋冪敤涓嶄紶 actorRuntimeGeometryProjections 鏃朵笉鍙楀奖鍝嶃€?3. VisualActorGeometryProjection 涓嶆槸 VisualPlacement銆?4. Actor projection 涓嶅啓鍏?HomeMapState銆?5. Actor projection 涓嶇敓鎴?MapPlacement銆?6. canProject === false 鏃讹紝geometryProjection 鍙互涓虹┖銆?7. pet 鏈嚭鐢熸椂锛屽彧鑳芥壙杞?skipped_not_ready銆?8. 鏈樁娈典笉鎺?Renderer銆?9. 鏈樁娈典笉淇敼 /world銆?10. 鏈樁娈典笉璇诲彇 PNG / WORLD_MAP_ASSETS銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H5锛歊enderer 鏄剧ず actor geometry
```

## 18. P8-H5 Renderer 鏄剧ず actor geometry 璁板綍

P8-H5 宸茶 Renderer 鍙 VisualState.actorGeometryProjections銆?
鏈樁娈垫柊澧烇細

1. Actor Geometry Summary銆?2. Actor Geometry Diagnostics銆?3. SVG actor geometry layer銆?4. actor body 缁樺埗銆?5. actor interactionRadius 缁樺埗銆?
瑙勫垯锛?
1. Renderer 鍙鍙?VisualState.actorGeometryProjections銆?2. Renderer 涓嶇敓鎴?actor銆?3. Renderer 涓嶇敓鎴?actor projection銆?4. Renderer 涓嶅喅瀹氳鑹叉槸鍚﹀瓨鍦ㄣ€?5. Renderer 涓嶅～榛樿 anchor銆?6. canProject === false 鏃朵笉缁樺埗 actor geometry銆?7. VisualState.actorGeometryProjections 绌烘暟缁勬椂涓嶆樉绀鸿鑹层€?8. pet 鏈嚭鐢?skipped_not_ready 鏃朵笉缁樺埗瀹犵墿 actor銆?9. 鏈樁娈典笉淇敼 HomeMapState銆?10. 鏈樁娈典笉璇诲彇 PNG / WORLD_MAP_ASSETS銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H6锛欰ctor projection 鏁版嵁鎺ュ叆 world snapshot
```

## 19. P8-H6 Actor projection 鏁版嵁鎺ュ叆 world snapshot 璁板綍

P8-H6 宸茶 world-loop renderable state 鎺ュ叆 butler actor projection銆?
褰撳墠閾捐矾锛?
```text
HomeMapState
-> world-loop renderable state
-> buildButlerRuntimeProjection
-> buildActorGeometryProjectionFromRuntime
-> buildVisualState(actorRuntimeGeometryProjections)
-> VisualState.actorGeometryProjections
-> Renderer 鍙鏄剧ず
```

鏈樁娈佃鍒欙細

1. 鍙帴鍏?butler銆?2. 涓嶆帴鍏?pet銆?3. butler anchor 浠?HomeMapState 娲剧敓銆?4. anchor 浼樺厛鏉ヨ嚜 actor_kind:butler placement銆?5. 鍏舵鏉ヨ嚜 visual_center zone銆?6. 鍐嶆鏉ヨ嚜 temporary_shelter zone銆?7. 鏈€鍚?fallback 鍒?mapSize 涓績銆?8. 涓嶇敓鎴?MapPlacement銆?9. 涓嶄慨鏀?HomeMapState銆?10. 涓嶅啓鍏?mapDiff銆?11. 涓嶄慨鏀?Renderer銆?12. 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H7锛欰ctor Geometry Display 鍙鎬т笌 Debug 鏀跺彛
```

## 20. P8-H7 Actor Geometry Display 鍙鎬т笌 Debug 鏀跺彛璁板綍

P8-H7 宸插寮?Actor Geometry Diagnostics 鍙鎬с€?
鏈樁娈垫槑纭細

1. 褰撳墠 actor 鍥惧舰鏄?Debug 鍑犱綍鍗犱綅銆?2. 褰撳墠涓嶆槸鏈€缁堢帺瀹?UI銆?3. 褰撳墠涓嶆槸鏈€缁堣鑹茬編鏈€?4. 褰撳墠涓嶄唬琛ㄦ渶缁?autonomous movement銆?5. 褰撳墠鍙帴鍏?butler銆?6. 褰撳墠涓嶆帴鍏?pet銆?7. butler anchor source 浼氬湪 tags 涓樉绀恒€?8. Renderer 鍙 tags 灞曠ず anchor source锛屼笉閲嶆柊鎺ㄦ柇涓栫晫浜嬪疄銆?9. Renderer 涓嶇敓鎴?actor銆?10. Renderer 涓嶅～榛樿 anchor銆?11. 涓嶇敓鎴?MapPlacement銆?12. 涓嶄慨鏀?HomeMapState銆?13. 涓嶈鍙?PNG / WORLD_MAP_ASSETS銆?
涓嬩竴姝ヨ繘鍏ワ細

```text
P8-H8锛欰ctor Geometry 闃舵鏀跺彛涓?Formal World View 鍒嗙瑙勫垝
```

## 21. P8-H8 Actor Geometry 阶段收口与 FormalVisualModel 分离规划记录

P8-H8 已完成 Actor Geometry 阶段收口，并在本次 reset 后修正下一步路线。

当前确认：

1. 当前 /world 的几何 / 程序化视觉预览 v1 是 Debug View / Dev View。
2. 当前大面积网格、线框、诊断面板不是最终玩家主视觉。
3. 当前 actor 图形是 Debug 几何占位。
4. 当前 actor 图形不是最终角色美术。
5. 当前 actor 图形不代表最终 autonomous movement。
6. Renderer 仍然只读 VisualState / RenderableWorldSnapshot。
7. Renderer 不生成 actor。
8. Renderer 不生成 placement。
9. pet 不作为默认 actor 接入。
10. 旧 FormalWorldView 手写视觉路线已作废。
11. Debug View 可以保留工程诊断。
12. 未来正式玩家主视觉必须等待 FormalVisualModel / FormalVisualGenerator。
13. FormalWorldView 只能只读 FormalVisualModel 渲染。
14. FormalWorldView 不能伪造世界事实。
15. FormalWorldView 不能显示紫微斗数原始术语。

下一步重新进入：

```text
VISUAL-MODEL-00：FormalVisualModel schema
```

## P8-I 璺嚎鍥炴粴涓?v1.4 瀵归綈璁板綍

鏈宸插洖婊?P8-I0 / P8-I1 / P8-I2 / P8-I3 鐨勬棫 FormalWorldView 璺嚎銆?
鍥炴粴鍘熷洜锛?
1. 鏃ц矾绾胯 FormalWorldView 缁勪欢鎵挎媴姝ｅ紡瑙嗚妯″瀷鐢熸垚鑱岃矗銆?2. 鏃ц矾绾垮湪缁勪欢鍐呯敓鎴?FormalWorldVisualItem / FormalActorVisualItem銆?3. 鏃ц矾绾胯缁勪欢鍐冲畾涓栫晫瀵硅薄鍜?actor 鐨勬寮忚瑙夎〃鐜般€?4. 杩欒繚鍙?MVP v1.4 涓庤鍒欎笘鐣屽紩鎿?v1.2銆?5. 姝ｅ紡瑙嗚妯″瀷蹇呴』鐢?src/world/formal-visual-model/ 鐢熸垚銆?6. FormalWorldView 鍙兘鍙 FormalVisualModel 娓叉煋銆?
淇濈暀鍐呭锛?
1. P8-H Debug Geometry / Actor Projection 閾捐矾淇濈暀銆?2. VisualState / RenderableWorldSnapshot 淇濈暀銆?3. Renderer Debug View 淇濈暀銆?4. world-loop actor projection debug 鎺ュ叆淇濈暀銆?
鍒犻櫎鍐呭锛?
1. src/app/world/components/formal-world-view/ 鏃х粍浠躲€?2. P8_I0_FORMAL_WORLD_VIEW_PLAN.md銆?3. P8_I1_FORMAL_WORLD_VIEW_COMPONENT_SHELL.md銆?4. P8_I2_FORMAL_WORLD_CANVAS.md銆?5. P8_I3_FORMAL_ACTOR_PRESENTATION.md銆?
浣滃簾澹版槑锛?
1. P8-I0 鏃?Formal World View 瑙勫垝璁板綍浣滃簾銆?2. P8-I1 鏃?FormalWorldView 缁勪欢楠ㄦ灦璁板綍浣滃簾銆?3. P8-I2 鏃?Formal World Canvas 璁板綍浣滃簾銆?4. P8-I3 鏃?Formal Actor Presentation 璁板綍浣滃簾銆?5. 鍚庣画涓嶅緱娌跨敤缁勪欢鍐呯敓鎴愭寮忚瑙夋ā鍨嬬殑璺嚎銆?
涓嬩竴姝ラ噸鏂拌繘鍏ワ細

```text
VISUAL-MODEL-00锛欶ormalVisualModel schema
```


