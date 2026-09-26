import{i as e}from"./ToonShader-Cj87AYvl.js";import{Wt as t}from"./three-vrm.module-BSB1WpUY.js";import{D as n,F as r,I as i,O as a,P as o,_ as ee,a as te,c as ne,d as re,f as ie,g as ae,h as oe,i as se,k as s,l as ce,m as le,n as ue,o as de,p as fe,r as pe,s as me,t as he,u as ge,v as _e,x as ve,y as ye}from"./ghostMassScenario-Ofzqvvnn.js";import{t as c}from"./path-C-vF2-aM.js";import{n as be}from"./PaintedClassroom-Z1OIbhsq.js";import{i as l,u as xe}from"./PaintedLibrary-BQPpZYfk.js";var Se={id:`silver-week`,title:`シルバーウィークの黄昏 〜アオイとエミリの帰り道〜`,characters:[{id:`girl_01`,character:`/models/aoi/aoi-private.vrm`,position:`left`},{id:`girl_02`,character:`/models/emili/emili-private.vrm`,position:`right`}],bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.22,chapters:[{id:`main`,title:`連休の終わりと夕焼けの街`,scenes:[{id:`sw_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`夕暮れの並木道`,scenePreset:`evening_outdoor`,background:`/textures/town_far.avif`,text:`「ふあぁ……楽しかったシルバーウィークも、とうとう今日で終わっちゃうね……」`,voiceUrl:`/voices/sw_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relax`,expressionWeight:1,lookAtCamera:!1,headLookAtCamera:!1,transitions:[{at:1.5,motion:`/animations/ardy_stretch.fbx`,expression:`sad`,expressionWeight:1},{at:4,motion:`/animations/ardy_shrug.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`partner`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`partner`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8},{id:`sw_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「ほんと、あっという間だったよね！ でもアオイとショッピングもカフェも行けて、最高に充実してたよ！」`,voiceUrl:`/voices/sw_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relax`,expressionWeight:1,lookAtTarget:`partner`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:1.8,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`},{at:4.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1}]}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「うん！ エミリちゃんのおかげで、毎日すっごく笑ってた気がするな〜」`,voiceUrl:`/voices/sw_3.wav`,avatars:{girl_01:{motion:`/animations/Acknowledging.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:2.5,motion:`/animations/ardy_shrug.fbx`,expression:`relax`,expressionWeight:1,effectText:`kirakira`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_4`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「ねえ、明日からまた学校だけど……放課後の約束、どうする？」`,voiceUrl:`/voices/sw_4.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5},{id:`sw_choice`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:``,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,choices:[{text:`明日、みんなで一緒に登校しよう！`,goto:`sw_reaction_together`},{text:`次の連休も、また一緒に遊びに行こう！`,goto:`sw_reaction_next_trip`}]},{id:`sw_reaction_together`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「賛成！ じゃあ明日の朝、いつもの交差点で待ち合わせね！」`,voiceUrl:`/voices/sw_reaction_together.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.8,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1}]}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_reaction_next_trip`,speaker:`エミリ & アオイ`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「やったー！ 約束だよ！ 次はもっと遠くまでお出かけしちゃおう！」`,voiceUrl:`/voices/sw_reaction_next_trip.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relax`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.6,motion:`/animations/ardy_stretch.fbx`,expression:`happy`,expressionWeight:1}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_end`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「それじゃあ、また明日ね！ 気をつけて帰ってね〜！」`,voiceUrl:`/voices/sw_end.wav`,avatars:{girl_01:{motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8}]}]};function Ce(e=s()){return Se}var we={id:`gesture-battle`,title:`放課後全力ジェスチャー！ 〜アオイとエミリの表現力バトル〜`,characters:[{id:`girl_01`,character:`/models/aoi/aoi-school.vrm`,position:`left`},{id:`girl_02`,character:`/models/emili/emili.vrm`,position:`right`}],bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.22,chapters:[{id:`main`,title:`校門前の表現力バトル`,scenes:[{id:`gb_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`校門前`,scenePreset:`day_school`,background:`/textures/school-gate-far.avif`,text:`「ねえエミリちゃん！ 放課後の表現力勝負、どっちが全身で気持ちを伝えられるかバトルしよ！」`,voiceUrl:`/voices/gb_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:1.8,motion:`/animations/ardy_idea.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`},{at:5,motion:`/animations/ardy_point.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`partner`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8},{id:`gb_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「望むところだよアオイ！ 私の全力のリアクション、甘く見ないでよね！」`,voiceUrl:`/voices/gb_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:1,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1},{at:3.2,motion:`/animations/ardy_victory.fbx`,expression:`happy`,expressionWeight:1,effectText:`yatta`}]}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`gb_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「じゃあ行くよ！ どうしても宿題を教えてほしい時のお願い……からの、断られた時の顔！」`,voiceUrl:`/voices/gb_3.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:1.2,motion:`/animations/ardy_beg.fbx`,expression:`sad`,expressionWeight:1,lookAtTarget:`partner`},{at:5.5,motion:`/animations/ardy_troubled.fbx`,expression:`relax`,expressionWeight:1,lookAtTarget:`partner`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:6,motion:`/animations/ardy_laugh.fbx`,expression:`happy`,expressionWeight:1}]}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`gb_4`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「ふふん、まだまだね！ 私ならこう！ 限定スイーツをゲットできた歓喜……と、一口取られた怒り！」`,voiceUrl:`/voices/gb_4.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:4,motion:`/animations/ardy_shrug.fbx`,expression:`relax`,expressionWeight:1},{at:7.2,motion:`/animations/ardy_laugh.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:1,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1},{at:3.5,motion:`/animations/ardy_cheer.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`},{at:6.8,motion:`/animations/ardy_pout.fbx`,expression:`angry`,expressionWeight:1}]}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`gb_5`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「どうかな？ どっちの全身ジェスチャーがより気持ちが伝わってきた？」`,voiceUrl:`/voices/gb_5.wav`,avatars:{girl_01:{motion:`/animations/ardy_shrug.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8},{id:`gb_choice`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:``,avatars:{girl_01:{motion:`/animations/ardy_beg.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_victory.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,choices:[{text:`アオイの『必死なお願い』がめちゃくちゃ可愛かった！`,goto:`gb_reaction_aoi`},{text:`エミリの『スイーツ歓喜ジャンプ』が全力すぎて最高だった！`,goto:`gb_reaction_emili`}]},{id:`gb_reaction_aoi`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「やったー！ 私の勝ちだね！ エミリちゃん、放課後アイス奢ってね〜！」`,voiceUrl:`/voices/gb_reaction_aoi.wav`,avatars:{girl_01:{motion:`/animations/ardy_victory.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:3.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]},girl_02:{motion:`/animations/ardy_troubled.fbx`,expression:`sad`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:3.5,motion:`/animations/ardy_pout.fbx`,expression:`angry`,expressionWeight:1}]}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`gb_reaction_emili`,speaker:`エミリ & アオイ`,dialogueTarget:`player`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「よっしゃー！ やっぱり私の表現力は最強でしょ！ 次も勝っちゃうもんね！」`,voiceUrl:`/voices/gb_reaction_emili.wav`,avatars:{girl_01:{motion:`/animations/ardy_laugh.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:3.2,motion:`/animations/ardy_stretch.fbx`,expression:`relax`,expressionWeight:1}]},girl_02:{motion:`/animations/ardy_cheer.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:3.2,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`gb_end`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`校門前`,background:`/textures/school-gate-far.avif`,text:`「また放課後にいろんな動きで遊ぼうね！ 今日は付き合ってくれてありがとう！」`,voiceUrl:`/voices/gb_end.wav`,avatars:{girl_01:{motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8}]}]};function Te(e=s()){return we}var Ee=[.32,0,-.45],De=-.9,u=[-.32,0,-.45],d=.9,f={lookAtTarget:`partner`,shallowHeadAngle:!1},Oe={cameraPosition:[-.68,1.38,.98],cameraTarget:`aoi`},ke={cameraPosition:[-.31,1.36,.45],cameraTarget:`aoi`},p={cameraPosition:[.68,1.38,.98],cameraTarget:`emily`},m={enabled:!0,preset:`classroom`,opacity:.6},h=`2年の教室・休み時間`,Ae={id:`corridor_conversation`,title:`休み時間の教室 〜アオイとエミリ、同じ班になれたね〜`,stage:`classroom`,characters:[{id:`aoi`,character:c(`/models/aoi/aoi-school.vrm`),position:Ee,rotationY:De},{id:`emily`,character:c(`/models/emili/emili.vrm`),position:u,rotationY:d}],bgmUrl:c(`/bgm/bgm.mp3`),bgmVolume:.2,chapters:[{id:`main`,title:`休み時間の教室`,scenes:[{id:`cm_1`,speaker:`エミリ`,speakerCharacterId:`emily`,dialogueTarget:`partner`,location:h,text:`「アオイ〜！ 聞いて聞いて、次の理科の実験、同じ班になれたよ！」`,voiceUrl:c(`/voices/cm_1.wav`),crowd:m,cameraZoom:`wide`,cameraDistance:1.1,cameraTransitionDuration:0,cameraTransitionEasing:`cut`,avatars:{aoi:{visible:!0,motion:c(`/animations/Idle.fbx`),expression:`surprised`,expressionWeight:.6,position:Ee,rotationY:De,...f},emily:{visible:!0,motion:c(`/animations/Standing Greeting.fbx`),expression:`happy`,expressionWeight:1,position:u,rotationY:d,...f,transitions:[{at:3.9,motion:c(`/animations/Excited.fbx`),effectText:`yatta`}]}}},{id:`cm_2`,speaker:`アオイ`,speakerCharacterId:`aoi`,dialogueTarget:`partner`,location:h,text:`「ほんと！？ よかったぁ……。エミリちゃんと一緒なら心強いな。」`,voiceUrl:c(`/voices/cm_2.wav`),crowd:m,...Oe,cameraTransitionDuration:.7,cameraTransitionEasing:`smooth`,avatars:{aoi:{motion:c(`/animations/Idle.fbx`),expression:`surprised`,expressionWeight:.8,...f,transitions:[{at:1.7,motion:c(`/animations/Acknowledging.fbx`),expression:`happy`,expressionWeight:1}]},emily:{motion:c(`/animations/Idle.fbx`),expression:`happy`,expressionWeight:1,...f}}},{id:`cm_3`,speaker:`エミリ`,speakerCharacterId:`emily`,dialogueTarget:`partner`,location:h,text:`「でもさ〜、前回ビーカー割りそうになったの、誰だったっけ？」`,voiceUrl:c(`/voices/cm_3.wav`),crowd:m,...p,cameraTransitionDuration:.6,cameraTransitionEasing:`smooth`,avatars:{aoi:{motion:c(`/animations/Idle.fbx`),expression:`happy`,expressionWeight:.6,...f,transitions:[{at:3.9,expression:`surprised`,expressionWeight:.9}]},emily:{motion:c(`/animations/Idle.fbx`),expression:`relaxed`,expressionWeight:.8,...f,transitions:[{at:3.7,expression:`happy`,expressionWeight:1}]}}},{id:`cm_4`,speaker:`アオイ`,speakerCharacterId:`aoi`,dialogueTarget:`partner`,location:h,text:`「あ、あれはたまたまだってば！ 今日はちゃんと気をつけるもん……。」`,voiceUrl:c(`/voices/cm_4.wav`),crowd:m,...ke,cameraTransitionDuration:.4,cameraTransitionEasing:`gyuin`,avatars:{aoi:{motion:c(`/animations/Dismissing Gesture.fbx`),expression:`surprised`,expressionWeight:.9,...f,sweat:`fly4`,transitions:[{at:3.5,expression:`angry`,expressionWeight:.55,sweat:!1}]},emily:{motion:c(`/animations/Idle.fbx`),expression:`happy`,expressionWeight:1,...f}}},{id:`cm_5`,speaker:`エミリ`,speakerCharacterId:`emily`,dialogueTarget:`partner`,location:h,text:`「ふふっ、冗談だよ。ほら、チャイム鳴る前に理科室いこ！」`,voiceUrl:c(`/voices/cm_5.wav`),crowd:m,...p,cameraTransitionDuration:.6,cameraTransitionEasing:`smooth`,avatars:{aoi:{motion:c(`/animations/Idle.fbx`),expression:`angry`,expressionWeight:.35,...f,transitions:[{at:2,expression:`happy`,expressionWeight:.8}]},emily:{motion:c(`/animations/Idle.fbx`),expression:`happy`,expressionWeight:1,...f}}},{id:`cm_6`,speaker:`アオイ`,speakerCharacterId:`aoi`,dialogueTarget:`partner`,location:h,text:`「うん！ ノートと教科書、持った？ ……よし、出発！」`,voiceUrl:c(`/voices/cm_6.wav`),crowd:m,cameraZoom:`wide`,cameraDistance:1,cameraTransitionDuration:.8,cameraTransitionEasing:`smooth`,avatars:{aoi:{motion:c(`/animations/Idle.fbx`),expression:`happy`,expressionWeight:1,...f,transitions:[{at:4.4,motion:c(`/animations/Salute.fbx`)}]},emily:{motion:c(`/animations/Idle.fbx`),expression:`happy`,expressionWeight:1,...f,transitions:[{at:4.6,motion:c(`/animations/Excited.fbx`)}]}}}]}]};function je(){return Ae}var g=[.32,0,-1.9],_=-.55,v=[-.32,0,-1.9],y=.55,b=be[0],x={cameraPosition:[...b.position],cameraTarget:[...b.target],cameraFov:b.fov},S={cameraPosition:[0,1.3,-.55],cameraTarget:[0,1.22,-1.9],cameraFov:40},C={cameraPosition:[-.36,1.32,-.65],cameraTarget:[.26,1.28,-1.9],cameraFov:30},w={cameraPosition:[.3,1.32,-.65],cameraTarget:[-.12,1.28,-1.9],cameraFov:28},Me={cameraPosition:[-.22,1.37,-.95],cameraTarget:[.3,1.31,-1.9],cameraFov:28},T={cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`},E=e=>({cameraPreset:`hold`,cameraTransitionDuration:e,cameraTransitionEasing:`smooth`}),D=e=>c(`/animations/${e}.fbx`),O=e=>c(`/voices/${e}.wav`),k={lookAtTarget:`partner`,shallowHeadAngle:!1},A=e=>({visible:!0,position:g,rotationY:_,...k,...e}),j=e=>({visible:!0,position:v,rotationY:y,...k,...e}),M={enabled:!0,preset:`painted-classroom`,opacity:.65},N=`昼休みの教室`,P={speaker:`アオイ`,speakerCharacterId:`aoi`,dialogueTarget:`partner`,crowd:M},F={speaker:`エミリ`,speakerCharacterId:`emily`,dialogueTarget:`partner`,crowd:M};function Ne(){let e=[{id:`pc_1`,location:N,scenePreset:`day_school`,...x,...T,crowd:M,cameraPreset:`pushIn`,cameraStrength:.35,text:`昼休みの教室。クラスメイトたちの賑やかな声が響く中、窓際で二人が話していた。`,avatars:{aoi:A({motion:D(`Standing Idle`),expression:`neutral`,expressionWeight:1,lookAtTarget:`forward`}),emily:j({motion:D(`Idle`),expression:`neutral`,expressionWeight:1})}},{id:`pc_2`,location:N,...F,...w,...T,voiceUrl:O(`pc_2`),text:`「アオイ、午後の小テストの範囲、もう見直した？ 古典の文法が全然頭に入らなくて……！」`,avatars:{aoi:A({motion:D(`Standing Idle`),expression:`neutral`,expressionWeight:1}),emily:j({motion:D(`mob_chat_gesture`),expression:`surprised`,expressionWeight:1})}},{id:`pc_3`,location:N,...P,...C,...T,voiceUrl:O(`pc_3`),text:`「ふふ、大丈夫だよエミリちゃん。大事なところ、後で一緒におさらいしよっか」`,avatars:{aoi:A({motion:D(`clasp_hands_front`),expression:`happy`,expressionWeight:1}),emily:j({motion:D(`Idle`),expression:`neutral`,expressionWeight:1})}},{id:`pc_4`,location:N,...F,...S,...E(1.6),voiceUrl:O(`pc_4`),text:`「ほんと！？ さすがアオイ、頼りになる〜！ 助かったぁ……！」`,avatars:{aoi:A({motion:D(`clasp_hands_front`),expression:`happy`,expressionWeight:1}),emily:j({motion:D(`ardy_laugh`),expression:`happy`,expressionWeight:1})}},{id:`pc_5`,location:N,...P,...C,...T,voiceUrl:O(`pc_5`),text:`「もう、大げさなんだから。その代わり、今日の放課後は購買のパン、付き合ってね？」`,avatars:{aoi:A({motion:D(`Dismissing Gesture`),expression:`happy`,expressionWeight:1}),emily:j({motion:D(`Idle`),expression:`happy`,expressionWeight:1})}},{id:`pc_6`,location:N,...F,...w,...T,cameraPreset:`pushIn`,cameraStrength:.4,voiceUrl:O(`pc_6`),text:`「もちろん！ 新作のいちごデニッシュ、半分こしよ！」`,avatars:{aoi:A({motion:D(`Standing Idle`),expression:`neutral`,expressionWeight:1}),emily:j({motion:D(`Standing Greeting`),expression:`happy`,expressionWeight:1})}},{id:`pc_7`,location:N,...P,...Me,...E(2.2),voiceUrl:O(`pc_7`),text:`「うん、約束ね。……ふふっ、エミリちゃんといると、何気ない時間もすごく楽しいな」`,avatars:{aoi:A({motion:D(`Standing Idle`),expression:`relax`,expressionWeight:1}),emily:j({motion:D(`Idle`),expression:`neutral`,expressionWeight:1})}},{id:`pc_8`,location:N,...F,...S,...T,voiceUrl:O(`pc_8`),text:`「……なに急に、照れるじゃん。でも……私もだよ！」`,avatars:{aoi:A({motion:D(`Standing Idle`),expression:`happy`,expressionWeight:1}),emily:j({motion:D(`Acknowledging`),expression:`relax`,expressionWeight:1,lookAtTarget:`forward`})}},{id:`pc_9`,location:N,...P,...x,...E(3.5),voiceUrl:O(`pc_9`),text:`「さ、予習しよっか。午後の授業も一緒に頑張ろうね！」`,avatars:{aoi:A({motion:D(`ardy_wave`),expression:`happy`,expressionWeight:1}),emily:j({motion:D(`Idle`),expression:`happy`,expressionWeight:1})}}];return{id:`painted-classroom`,title:`昼休みの教室（簡易3D日常会話）`,stage:`painted-classroom`,bgmUrl:c(`/bgm/bgm.mp3`),bgmVolume:.15,characters:[{id:`aoi`,character:c(`/models/aoi/aoi-school.vrm`),position:g,rotationY:_},{id:`emily`,character:c(`/models/emili/emili.vrm`),position:v,rotationY:y}],chapters:[{id:`lunch-break`,title:`昼休みの教室`,scenes:e}]}}var I=e=>{let{position:t,target:n,fov:r}=xe[e];return{cameraPosition:[...t],cameraTarget:[...n],cameraFov:r}},Pe=I(0),Fe=I(1),Ie=I(2),Le=I(3),Re=I(4),L={cameraPreset:`hold`,cameraTransitionDuration:0,cameraTransitionEasing:`cut`},ze=e=>({cameraPreset:`hold`,cameraTransitionDuration:e,cameraTransitionEasing:`smooth`}),R=e=>({visible:!0,position:l,rotationY:0,seated:!0,motion:c(`/animations/chin_rest.fbx`),motionLoop:!0,lookAtTarget:`player`,expression:`neutral`,expressionWeight:1,...e}),z={speaker:`シオン`,speakerCharacterId:`shion`,dialogueTarget:`player`},B=e=>c(`/voices/${e}.wav`);function Be(){let e=(e,t,n,r,i,a)=>[{id:`${e}_1`,location:n,scenePreset:t,...Re,...L,cameraPreset:`pushIn`,cameraStrength:.3,text:r,autoNextSec:2.2,avatars:{shion:R({lookAtTarget:`forward`})}},{id:`${e}_2`,location:n,...z,...Pe,...ze(1.6),text:i,voiceUrl:B(`pl_${e}_2`),autoNextSec:.8,avatars:{shion:R({expression:a})}},{id:`${e}_3`,location:n,...z,...e===`evening`?Fe:e===`morning`?Ie:Le,...L,text:`「……用がないなら、静かにしてて」`,voiceUrl:B(`pl_${e}_3`),autoNextSec:e===`evening`?1.2:1,avatars:{shion:R({expression:`neutral`})}}],t=[...e(`morning`,`morning_school`,`朝の図書室`,`始業前の図書室。窓際の席で、シオンが頬杖をついてページをめくっている。`,`「……おはよう。朝から図書室なんて、珍しいのね」`,`neutral`),...e(`day`,`day_school`,`昼休みの図書室`,`昼休みの図書室。木漏れ日が机の上で揺れている。`,`「また来たの？ ……別に、嫌とは言ってない」`,`relax`),...e(`evening`,`evening_school`,`放課後の図書室`,`放課後の図書室。西日が本棚を橙色に染めている。`,`「もうこんな時間。……あなたといると、読むのが進まない」`,`relax`)];return{id:`painted-library`,title:`図書室のシオン（簡易3D）`,stage:`painted-library`,bgmUrl:c(`/bgm/bgm.mp3`),bgmVolume:.12,characters:[{id:`shion`,character:c(`/models/shion/shion-school.vrm`),position:l,rotationY:0}],chapters:[{id:`library`,title:`図書室`,scenes:t}]}}var Ve={id:`cafe-monitoring`,title:`窓越しの観測者 〜アオイの休日〜`,characters:[{id:`indoor_emily`,character:c(`/models/emili/emili-private.vrm`),position:[.3,-.12,.45],rotationY:-.35,renderOrder:0},{id:`outdoor_aoi`,character:c(`/models/aoi/aoi-private.vrm`),position:[-1.4,0,-2.9],rotationY:Math.PI*.5,daylight:.6,renderOrder:-2,fastMotion:!1}],bgmUrl:c(`/bgm/bgm.mp3`),bgmVolume:.25,chapters:[{id:`main`,title:`窓の外の観測`,scenes:[{id:`scene_01`,speaker:`エミリ`,speakerCharacterId:`indoor_emily`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:`「……ふぅ。ここのお店、落ち着いてていいね。外の光も綺麗だし……たまにはこういう静かな場所も悪くないかも。」`,voiceUrl:c(`/voices/cafe_mon_01.wav`),crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`relax`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.35,renderOrder:0,lookAtCamera:!1,headLookAtCamera:!1},outdoor_aoi:{motion:c(`/animations/Walking.fbx`),expression:`neutral`,expressionWeight:1,position:[-1.4,0,-2.9],rotationY:Math.PI*.5,daylight:.6,renderOrder:-2,fastMotion:!1}},cameraPosition:[.12,1.15,1.55],cameraTarget:[.08,1.15,-1]},{id:`scene_02`,speaker:`エミリ`,speakerCharacterId:`indoor_emily`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:`「……ん？ 待って。あの水色のカーディガン……あそこ歩いてるの、アオイじゃない？」`,voiceUrl:c(`/voices/cafe_mon_02.wav`),crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.35,renderOrder:0,lookAtCamera:!1,headLookAtCamera:!1,headOffset:[-.4,0]},outdoor_aoi:{motion:c(`/animations/Walking.fbx`),expression:`neutral`,expressionWeight:1,daylight:.6,renderOrder:-2,fastMotion:!1,moveTo:{target:[-.75,0,-2.9],duration:3,rotationY:Math.PI*.45}}},cameraPosition:[.12,1.14,1.55],cameraTarget:[-.1,1.14,-1.1]},{id:`scene_03`,speaker:`エミリ`,speakerCharacterId:`indoor_emily`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:`「誰か探してるみたい……待ち合わせかな。あんなにキョロキョロしてたら、すぐ迷子になっちゃいそうだけど。」`,voiceUrl:c(`/voices/cafe_mon_03.wav`),crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.35,renderOrder:0,lookAtCamera:!1,headLookAtCamera:!1,headOffset:[-.45,0]},outdoor_aoi:{motion:c(`/animations/Standing Idle.fbx`),expression:`surprised`,expressionWeight:1,position:[-.75,0,-2.9],rotationY:Math.PI*.35,daylight:.6,renderOrder:-2,fastMotion:!1,transitions:[{at:.6,headOffset:[-.4,0]},{at:2,headOffset:[.4,0]},{at:3.5,headOffset:[0,0]}]}},cameraPosition:[.12,1.15,1.55],cameraTarget:[-.12,1.15,-1.1]},{id:`scene_04`,speaker:`エミリ`,speakerCharacterId:`indoor_emily`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:`「……って、ちょっと！ 私といるのに、そんなにアオイのことばっかり凝視しないでよ。」`,voiceUrl:c(`/voices/cafe_mon_04.wav`),crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.15,renderOrder:0,lookAtCamera:!0,headLookAtCamera:!0,faceOverlays:{anger:!0}},outdoor_aoi:{motion:c(`/animations/Standing Idle.fbx`),expression:`neutral`,expressionWeight:1,position:[3.5,0,-2.9],daylight:.6,renderOrder:-2,visible:!1,fastMotion:!1}},cameraPosition:[.18,1.16,1.45],cameraTarget:[.28,1.15,.45]},{id:`scene_05_choice`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:``,crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`angry`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.15,renderOrder:0,lookAtCamera:!0,headLookAtCamera:!0,faceOverlays:{anger:!0}}},cameraPosition:[.18,1.16,1.45],cameraTarget:[.28,1.15,.45],choices:[{text:`「アオイを呼んで一緒に合流する？」`,goto:`scene_06a`},{text:`「今はエミリと二人の時間だからさ」`,goto:`scene_06b`}]},{id:`scene_06a`,speaker:`エミリ`,speakerCharacterId:`indoor_emily`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:`「まったく……お人好しなんだから。ほら、手振ったら気づくかもよ？ ……しょうがないなぁ。」`,voiceUrl:c(`/voices/cafe_mon_06a.wav`),isEnding:!0,crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`sad`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.15,renderOrder:0,lookAtCamera:!0,headLookAtCamera:!0,faceOverlays:{anger:!1,blush:!1}}},cameraPosition:[.18,1.16,1.45],cameraTarget:[.28,1.15,.45]},{id:`scene_06b`,speaker:`エミリ`,speakerCharacterId:`indoor_emily`,location:`cafe_indoor`,scenePreset:`dark_indoor_2`,text:`「……っ！ な、何よ急に真面目な顔して……バカ。……じゃあ、もうちょっとだけ、ここで二人で休んでいこっか。」`,voiceUrl:c(`/voices/cafe_mon_06b.wav`),isEnding:!0,crowd:{enabled:!0,preset:`cafe_street`,opacity:.85},avatars:{indoor_emily:{motion:c(`/animations/Standing Idle.fbx`),expression:`happy`,expressionWeight:1,position:[.3,-.12,.45],rotationY:-.15,renderOrder:0,lookAtCamera:!0,headLookAtCamera:!0,faceOverlays:{anger:!1,blush:!0}}},cameraPosition:[.22,1.16,1.3],cameraTarget:[.29,1.15,.45]}]}]};function He(e=`ja`){return Ve}var Ue={"cafe-monitoring":{id:`cafe-monitoring`,title:`窓越しの二重存在 〜カフェ監視任務〜`,shortTitle:`カフェ監視任務`,description:`暗いカフェの店内から、日差しの強い外の通りを歩く「もう一人の自分」を監視する日本アニメ映画風の高コントラスト短編シナリオ。`,ogpImage:`/textures/cafe_indoor_far.avif`,getScenario:He},"painted-classroom":{id:`painted-classroom`,title:`昼休みの教室 — 簡易3Dの教室で会話`,shortTitle:`昼休みの教室`,description:`床・壁・天井の1枚絵と机のアクスタで組んだ簡易3Dの昼の教室で、背景モブの生徒たちが談笑する中、アオイとエミリが午後の小テストや放課後の約束を交わす日常シーン。`,ogpImage:`/textures/school-classroom-far2.avif`,getScenario:Ne},"painted-library":{id:`painted-library`,title:`図書室のシオン — 簡易3Dの図書室`,shortTitle:`図書室のシオン`,description:`床・壁・天井の1枚絵と家具のアクスタで組んだ簡易3Dの図書室。窓際の閲覧机で頬杖をつくシオンを、向かいの席から朝・昼・放課後の光で見る。`,ogpImage:`/textures/school-library-far.avif`,getScenario:Be},"five-seconds-pv":{id:`five-seconds-pv`,title:`【PV】5秒の告白 〜5 Seconds Confession〜`,shortTitle:`5秒の告白 PV`,description:`たった5秒の勇気で、世界は変わる。楽曲と完全同期するAnimeVRMオリジナル短編アニメーションPV。`,ogpImage:`/ogp/five-seconds-pv.png`,getScenario:()=>pe(),playOptions:{withInterlude:!0,interludeTitle:`5秒の告白`,interludeSubtitle:`5 SECONDS CONFESSION - OFFICIAL PV -`}},"rooftop-nap":{id:`rooftop-nap`,title:`屋上の昼寝と、覗き込みハプニング`,shortTitle:`屋上の昼寝`,description:`ぽかぽか陽気の屋上で居眠りしていたら……？アオイの覗き込みドキドキショートストーリー。`,ogpImage:`/ogp/rooftop-nap.png`,getScenario:(e=`ja`)=>ue(e)},"park-confession":{id:`park-confession`,title:`夕暮れの公園と放課後の期待`,shortTitle:`夕暮れの公園`,description:`夕暮れの公園に呼び出されたあなた。茜色に染まる並木道で、アオイが伝えたかった想いとは――。`,ogpImage:`/ogp/park-confession.png`,getScenario:(e=`ja`)=>le(e)},"two-girls":{id:`two-girls`,title:`放課後の寄り道〜アオイとエミリ〜`,shortTitle:`放課後の寄り道`,description:`アオイとエミリの放課後カフェトーク。2人の掛け合いを楽しめるインタラクティブシナリオ。`,ogpImage:`/ogp/two-girls.png`,getScenario:(e=`ja`)=>fe(e)},trio:{id:`trio`,title:`放課後トライアングル〜アオイとエミリとあなた〜`,shortTitle:`放課後トライアングル`,description:`アオイとエミリとあなたの3人。放課後どこに行くかをめぐるドキドキ作戦会議！`,ogpImage:`/ogp/trio.png`,getScenario:(e=`ja`)=>ie(e)},harem:{id:`harem`,title:`放課後大波乱!? 一体誰が本命なのよ〜！`,shortTitle:`本命決着裁判`,description:`4人のヒロインが勢揃い！修羅場と選択肢が待ち受けるマルチキャラクター裁判シナリオ。`,ogpImage:`/ogp/harem.png`,getScenario:(e=`ja`)=>re(e)},"town-walk":{id:`town-walk`,title:`放課後の並木道 〜君と歩く帰り道〜`,shortTitle:`放課後の並木道`,description:`放課後の美しい並木道をアオイと一緒に歩く、臨場感あふれるスクロール背景シナリオ。`,ogpImage:`/ogp/town-walk.png`,getScenario:(e=`ja`)=>ge(e)},"behind-you":{id:`behind-you`,title:`噂話は背後にご注意〜教室の秘密〜`,shortTitle:`背後にご注意`,description:`放課後の教室で噂話をしていたら……真後ろに気配が！？360度パノラマ視点シナリオ。`,ogpImage:`/ogp/behind-you.png`,getScenario:(e=`ja`)=>ce(e)},nisa:{id:`nisa`,title:`夕暮れの校門とオルカンの憂鬱`,shortTitle:`オルカンの憂鬱`,description:`夕暮れの校門前で繰り広げられる、全力で真面目な新NISA・全世界株式インデックス投資相談ストーリー。`,ogpImage:`/ogp/nisa.png`,getScenario:(e=`ja`)=>ne(e)},"fast-motion":{id:`fast-motion`,title:`疾風怒濤！高速アクション特訓`,shortTitle:`高速アクション特訓`,description:`アニメ作画風の残像やスピードリボン、ダイナミックブラーを駆使した高速アクション演出。`,ogpImage:`/ogp/fast-motion.png`,getScenario:(e=`ja`)=>me(e)},"door-peep":{id:`door-peep`,title:`🚪 覗き穴の訪問者〜深夜のヤンデレ〜`,shortTitle:`覗き穴の訪問者`,description:`深夜に響くインターホン……ドアスコープを覗くとそこに立っていたのは？魚眼レンズホラー演出。`,ogpImage:`/ogp/door-peep.png`,getScenario:(e=`ja`)=>de(e)},"private-date":{id:`private-date`,title:`休日デート〜私服のエミリと街歩き〜`,shortTitle:`休日デート`,description:`休日に私服のエミリと待ち合わせ。カフェテラスでの特別なひとときを過ごすデートシナリオ。`,ogpImage:`/ogp/private-date.png`,getScenario:(e=`ja`)=>te(e)},"ghost-mass":{id:`ghost-mass`,title:`👻 幽霊の質量（シャフト風）`,shortTitle:`幽霊の質量`,description:`単色キャラクター・白輪郭・ローポリ教室・赤緑カットイン・シャフ度を散りばめたシャフト風演出シナリオ。`,ogpImage:`/ogp/ghost-mass.png`,getScenario:()=>he},"teacher-gate":{id:`teacher-gate`,title:`校門の邂逅 〜シオンと桐島先生の秘密の推し〜`,shortTitle:`校門の邂逅`,description:`眠そうに登校するシオンと校門で待ち受けるクールな桐島先生。2人がまさかのニッチな古生物トークで意気投合！？`,ogpImage:`/ogp/teacher-gate.png`,getScenario:(e=`ja`)=>se(e)},"silver-week":{id:`silver-week`,title:`シルバーウィークの黄昏 〜アオイとエミリの帰り道〜`,shortTitle:`シルバーウィークの黄昏`,description:`連休最終日の夕暮れ。私服のアオイとエミリが街を歩きながら、名残惜しそうに語り合うショートシナリオ。`,ogpImage:`/ogp/silver-week.png`,getScenario:(e=`ja`)=>Ce(e)},"gesture-battle":{id:`gesture-battle`,title:`放課後全力ジェスチャー！ 〜アオイとエミリの表現力バトル〜`,shortTitle:`放課後ジェスチャーバトル`,description:`アオイとエミリが昼の校門前で全身ジェスチャー対決！ひらめき、歓喜、おねだり、ツッコミが炸裂する多彩なモーションシナリオ。`,ogpImage:`/ogp/silver-week.png`,getScenario:(e=`ja`)=>Te(e)},"corridor-mob":{id:`corridor-mob`,title:`休み時間の教室 〜アオイとエミリ、同じ班になれたね〜`,shortTitle:`休み時間の教室`,description:`夕方の光が差す3Dの教室で、理科の実験で同じ班になったアオイとエミリが話す休み時間の会話。ペルソナ5風の半透明モブ生徒たちが背後で談笑する日常シーン。`,ogpImage:`/ogp/silver-week.png`,getScenario:()=>je()}};function We(e){return Ue[e]}var Ge=new URLSearchParams(window.location.search),V=document.body.dataset.scenarioId||Ge.get(`id`)||`five-seconds-pv`,H=We(V);H||console.error(`[ScenarioPlayer] Scenario not found: ${V}`);var U=i(r),W=new o,G=new e({}),K=new a(document.querySelector(`#app`),U);K.controls.enabled=!1;var q=new ye({scene:K.scene,camera:K.camera,hairShadow:K.hairShadow.uniforms,controls:K.controls,sharedEffectTextManager:K.sharedEffectTextManager,windController:W,getConfig:()=>U,renderer:K.renderer,onEnterTransparent:()=>{K.scene.background=null,K.hideSkyBackground(),K.midgroundMesh.visible=!1,K.neargroundMesh.visible=!1,K.sunEffect.sunGroup.visible=!1,K.sunEffect.flareGroup.visible=!1,K.renderer.setClearColor(0,0)},onExitTransparent:()=>{K.updateBackgroundDisplay(U),K.updateMidgroundDisplay(U),K.updateNeargroundDisplay(U),K.sunEffect.sunGroup.visible=(U.lighting.sunShafts?.enabled||U.lighting.lensFlare?.enabled)??!1,K.sunEffect.flareGroup.visible=U.lighting.lensFlare?.enabled??!1},onAvatarLoaded:()=>{Y(U)}}),J=new ae({avatarManager:q,viewerCore:K,audioLipSync:G,config:U.live2d}),Ke=new oe({viewerCore:K,avatarManager:q,getConfig:()=>U});function Y(e){K.applyConfig(e),q.isMultiAvatarScenarioActive?q.scenarioAvatars.forEach(t=>t.applyConfig(e)):q.avatarInstance?.applyConfig(e)}var qe=new ve({config:U,onConfigChange:e=>{Y(e)},onInspectorsUpdate:()=>{}}),X=document.createElement(`div`);X.id=`scenario-player-ui`,X.innerHTML=`
  <style>
    #scenario-player-ui {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 20000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Noto Sans CJK JP', sans-serif;
      user-select: none;
    }

    /* Top Left HUD */
    .scenario-top-bar {
      position: absolute;
      top: 14px;
      left: 18px;
      display: flex;
      align-items: center;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 50;
    }
    .scenario-branding {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(10, 10, 18, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 6px 14px;
      border-radius: 999px;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
    }
    .scenario-badge {
      background: linear-gradient(135deg, #f43f5e 0%, #a855f7 100%);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.05em;
      box-shadow: 0 2px 8px rgba(244, 63, 94, 0.4);
    }
    .scenario-title-text {
      color: #f1f5f9;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.6);
      max-width: 40vw;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Start Overlay */
    .start-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(15, 15, 25, 0.6) 0%, rgba(8, 8, 14, 0.92) 100%);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      pointer-events: auto;
      transition: opacity 0.5s ease, visibility 0.5s ease;
      z-index: 20001;
    }
    .start-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .start-card {
      background: rgba(24, 24, 38, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 36px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(244, 63, 94, 0.2);
      animation: cardPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes cardPop {
      0% { opacity: 0; transform: scale(0.92) translateY(20px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    .start-title {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 12px;
      line-height: 1.35;
      background: linear-gradient(135deg, #ffffff 0%, #fbcfe8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .start-desc {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .start-play-btn {
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 50%, #9333ea 100%);
      color: #ffffff;
      border: none;
      font-size: 16px;
      font-weight: 800;
      padding: 14px 36px;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(244, 63, 94, 0.45);
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .start-play-btn:hover {
      transform: scale(1.04);
      box-shadow: 0 8px 30px rgba(244, 63, 94, 0.65);
    }
    .start-play-btn:active {
      transform: scale(0.98);
    }

    /* Replay Overlay */
    .replay-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(12, 12, 22, 0.7) 0%, rgba(5, 5, 10, 0.94) 100%);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      pointer-events: auto;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.6s ease, visibility 0.6s ease;
      z-index: 20002;
    }
    .replay-overlay.visible {
      opacity: 1;
      visibility: visible;
    }
    .replay-card {
      background: rgba(22, 22, 36, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 50px rgba(244, 63, 94, 0.25);
      animation: cardPop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .replay-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 800;
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 14px;
      letter-spacing: 0.05em;
    }
    .replay-title {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 10px;
    }
    .replay-scenario-name {
      font-size: 14px;
      color: #cbd5e1;
      margin-bottom: 28px;
    }
    .replay-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }
    .replay-btn {
      background: linear-gradient(135deg, #f43f5e 0%, #ec4899 50%, #8b5cf6 100%);
      color: #ffffff;
      border: none;
      font-size: 16px;
      font-weight: 800;
      padding: 15px 32px;
      border-radius: 12px;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(244, 63, 94, 0.4);
      transition: all 0.25s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .replay-btn:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 10px 32px rgba(244, 63, 94, 0.6);
    }
    .replay-btn:active {
      transform: translateY(0) scale(0.98);
    }
    .home-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.18);
      color: #e2e8f0;
      font-size: 14px;
      font-weight: 700;
      padding: 13px 28px;
      border-radius: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .home-btn:hover {
      background: rgba(255, 255, 255, 0.16);
      border-color: rgba(255, 255, 255, 0.35);
      color: #ffffff;
      transform: translateY(-1px);
    }

    /* Scenario Selector Dropdown */
    .other-scenarios-container {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      flex-direction: column;
      gap: 8px;
      text-align: left;
    }
    .other-scenarios-label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .other-scenarios-select {
      background: #181824;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #f1f5f9;
      font-size: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      width: 100%;
      outline: none;
    }
  </style>

  <!-- Top Bar HUD -->
  <div class="scenario-top-bar">
    <div class="scenario-branding">
      <span class="scenario-badge">AnimeVRM</span>
      <span class="scenario-title-text">${H?.title??`Scenario`}</span>
    </div>
  </div>

  <!-- Start Overlay (Autoplay protection) -->
  <div id="start-overlay" class="start-overlay">
    <div class="start-card">
      <span class="scenario-badge" style="margin-bottom: 14px; display: inline-block;">AnimeVRM Scenario</span>
      <h1 class="start-title">${H?.title??`シナリオを再生`}</h1>
      <p class="start-desc">${H?.description??`再生ボタンを押してシナリオをお楽しみください。`}</p>
      <button id="start-btn" class="start-play-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        タップして再生を開始
      </button>
    </div>
  </div>

  <!-- Replay Overlay (Shown onFinished) -->
  <div id="replay-overlay" class="replay-overlay">
    <div class="replay-card">
      <div class="replay-badge">✨ PLAYBACK COMPLETED</div>
      <h2 class="replay-title">シナリオが終了しました</h2>
      <div class="replay-scenario-name">${H?.title??``}</div>
      <div class="replay-actions">
        <button id="replay-btn" class="replay-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
          もう1回再生する
        </button>
        <a href="../index.html" class="home-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          通常ビューワーを開く
        </a>
      </div>

      <div class="other-scenarios-container">
        <label class="other-scenarios-label">他のシナリオを再生する</label>
        <select id="other-scenarios-select" class="other-scenarios-select">
          <option value="" disabled selected>シナリオを選択...</option>
          ${Object.values(Ue).map(e=>`<option value="${e.id}" ${e.id===V?`selected`:``}>${e.title}</option>`).join(``)}
        </select>
      </div>
    </div>
  </div>
`,document.body.appendChild(X);var Je=document.getElementById(`start-overlay`),Ye=document.getElementById(`replay-overlay`),Xe=document.getElementById(`start-btn`),Ze=document.getElementById(`replay-btn`);document.getElementById(`other-scenarios-select`)?.addEventListener(`change`,e=>{let t=e.target.value;t&&t!==V&&(window.location.href=`${t}.html`)});var Z=!1,Qe=new ee({scene:K.scene,dirLight:K.dirLight,getConfig:()=>U,onApplyConfig:e=>{Y(e)}}),Q=new _e({scene:K.scene,camera:K.camera,controls:K.controls,avatarManager:q,audioLipSync:G,sharedEffectTextManager:K.sharedEffectTextManager,windController:W,panoramaController:K.panoramaController,shaftModeController:Ke,classroomStage:Qe,getConfig:()=>U,onApplyConfig:e=>{Y(e)},onSwitchScenePreset:e=>{qe.switchScene(e,!1)},onFinished:()=>{Z||Ye.classList.add(`visible`)}});async function $e(){if(!Z){Z=!0,Ye.classList.remove(`visible`),Je.classList.add(`hidden`);try{if(!H){n(`❌ シナリオ情報が見つかりません`);return}if(G.initAudioContext(),G.audioContext?.state===`suspended`)try{await G.audioContext.resume()}catch(e){console.warn(`Failed to resume AudioContext`,e)}Q.scenarioEngine.isPlaying&&Q.scenarioEngine.stop(),Q.scenarioPlayer.isPlaying&&Q.scenarioPlayer.stop(),K.panoramaController.isActive&&K.panoramaController.deactivate();let e=H.getScenario(`ja`);H.playOptions?.withInterlude?await Q.playWithInterlude(e,{title:H.playOptions.interludeTitle||e.title,subtitle:H.playOptions.interludeSubtitle||`SPECIAL PRESENTATION`}):await Q.scenarioEngine.play(e)}finally{Z=!1}}}Xe.addEventListener(`click`,e=>{e.stopPropagation(),$e()}),Ze.addEventListener(`click`,e=>{e.stopPropagation(),console.log(`[ScenarioPlayer] replayBtn clicked`),$e()});var et=H?.getScenario(`ja`);(!et?.characters||et.characters.length<=1)&&q.loadAvatarModel(q.currentModelUrl),qe.switchTimeOfDay(`day`,!1);var $=new t;$.connect(document);function tt(e){K.stats.begin(),$.update(e);let t=Math.min($.getDelta(),.1),n=$.getElapsed();Q.dialogueCameraController?.isActive?Q.dialogueCameraController.update(t):q.animationPlayer.isPlaying?q.animationPlayer.update(t):K.panoramaController.isActive&&K.panoramaController.update(t,n),Q.update(t),Ke.update();let r=Q.dialogueCameraController?.isActive?Q.dialogueCameraController.getBackgroundTransform():null;K.updateBackgroundZoom(r),K.updateMidgroundTransform(U,r),K.updateNeargroundTransform(U,r),Q.scrollingBackgroundManager?.isVisible&&(Q.scrollingBackgroundManager.update(t,r),K.midgroundMesh.visible=!1,K.neargroundMesh.visible=!1);let i=Q.scenarioEngine.currentScene,a=i?.lipSyncCharacterId===void 0?i?.speakerCharacterId:i.lipSyncCharacterId??`none`;q.update(t,n,U,G,a),K.windParticles.update(t,n,U.wind,W.currentWindVector),K.rainEffect.setCameraPosition(K.camera.position),K.rainEffect.update(n);let o=q.getVrmMeshes();if(K.render(t,n,U,o),Q.scenarioEngine.isPlaying||Q.scenarioPlayer.isPlaying)if(i?.live2d!==void 0){let e=i.live2d,t=typeof e==`boolean`?e:e.enabled??!0;J.setSceneOverride(t)}else J.setSceneOverride(!1);else J.setSceneOverride(null);J.update(t),K.stats.end(),requestAnimationFrame(tt)}tt(),window.addEventListener(`resize`,()=>{K.onResize()}),window.addEventListener(`pointerdown`,()=>{G.audioContext?.state===`suspended`&&G.audioContext.resume().catch(()=>{})},{once:!0}),window.avatarManager=q,window.viewerCore=K,window.scenarioController=Q,window.live2DTransitionManager=J,window.audioLipSync=G;