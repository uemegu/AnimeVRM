import{r as e}from"./ToonShader-DJvQKLYz.js";import{Ft as t}from"./three-vrm.module-DoWqgAMq.js";import{D as n,E as r,F as i,N as a,O as o,P as s,_ as c,a as l,b as u,c as d,d as f,f as p,g as m,h,i as g,l as _,m as v,n as y,o as b,p as x,r as S,s as C,t as w,u as T,v as E}from"./ghostMassScenario-DY4CA6Rk.js";var D={id:`silver-week`,title:`シルバーウィークの黄昏 〜アオイとエミリの帰り道〜`,characters:[{id:`girl_01`,character:`/models/aoi/aoi-private.vrm`,position:`left`},{id:`girl_02`,character:`/models/emili/emili-private.vrm`,position:`right`}],bgmUrl:`/bgm/bgm.mp3`,bgmVolume:.22,chapters:[{id:`main`,title:`連休の終わりと夕焼けの街`,scenes:[{id:`sw_1`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`夕暮れの並木道`,scenePreset:`evening_outdoor`,background:`/textures/town_far.avif`,text:`「ふあぁ……楽しかったシルバーウィークも、とうとう今日で終わっちゃうね……」`,voiceUrl:`/voices/sw_1.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relax`,expressionWeight:1,lookAtCamera:!1,headLookAtCamera:!1,transitions:[{at:1.5,motion:`/animations/ardy_stretch.fbx`,expression:`sad`,expressionWeight:1},{at:4,motion:`/animations/ardy_shrug.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`partner`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`partner`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8},{id:`sw_2`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`partner`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「ほんと、あっという間だったよね！ でもアオイとショッピングもカフェも行けて、最高に充実してたよ！」`,voiceUrl:`/voices/sw_2.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relax`,expressionWeight:1,lookAtTarget:`partner`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:1.8,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`},{at:4.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1}]}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_3`,speaker:`アオイ`,speakerCharacterId:`girl_01`,dialogueTarget:`partner`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「うん！ エミリちゃんのおかげで、毎日すっごく笑ってた気がするな〜」`,voiceUrl:`/voices/sw_3.wav`,avatars:{girl_01:{motion:`/animations/Acknowledging.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`,transitions:[{at:2.5,motion:`/animations/ardy_shrug.fbx`,expression:`relax`,expressionWeight:1,effectText:`kirakira`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`partner`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_4`,speaker:`エミリ`,speakerCharacterId:`girl_02`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「ねえ、明日からまた学校だけど……放課後の約束、どうする？」`,voiceUrl:`/voices/sw_4.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`speaker`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.5},{id:`sw_choice`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:``,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`neutral`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,choices:[{text:`明日、みんなで一緒に登校しよう！`,goto:`sw_reaction_together`},{text:`次の連休も、また一緒に遊びに行こう！`,goto:`sw_reaction_next_trip`}]},{id:`sw_reaction_together`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「賛成！ じゃあ明日の朝、いつもの交差点で待ち合わせね！」`,voiceUrl:`/voices/sw_reaction_together.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.8,motion:`/animations/ardy_proud.fbx`,expression:`happy`,expressionWeight:1}]}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_reaction_next_trip`,speaker:`エミリ & アオイ`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「やったー！ 約束だよ！ 次はもっと遠くまでお出かけしちゃおう！」`,voiceUrl:`/voices/sw_reaction_next_trip.wav`,avatars:{girl_01:{motion:`/animations/Standing Idle.fbx`,expression:`relax`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.6,motion:`/animations/ardy_stretch.fbx`,expression:`happy`,expressionWeight:1}]},girl_02:{motion:`/animations/Standing Idle.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`,transitions:[{at:1.5,motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,effectText:`kirakira`}]}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.6},{id:`sw_end`,speaker:`アオイ & エミリ`,dialogueTarget:`player`,location:`夕暮れの並木道`,background:`/textures/town_far.avif`,text:`「それじゃあ、また明日ね！ 気をつけて帰ってね〜！」`,voiceUrl:`/voices/sw_end.wav`,avatars:{girl_01:{motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`},girl_02:{motion:`/animations/ardy_wave.fbx`,expression:`happy`,expressionWeight:1,lookAtTarget:`player`}},cameraZoom:`wide`,cameraTransitionEasing:`smooth`,cameraTransitionDuration:.8}]}]};function O(e=o()){return D}var k={"five-seconds-pv":{id:`five-seconds-pv`,title:`【PV】5秒の告白 〜5 Seconds Confession〜`,shortTitle:`5秒の告白 PV`,description:`たった5秒の勇気で、世界は変わる。楽曲と完全同期するAnimeVRMオリジナル短編アニメーションPV。`,ogpImage:`/ogp/five-seconds-pv.png`,getScenario:()=>S(),playOptions:{withInterlude:!0,interludeTitle:`5秒の告白`,interludeSubtitle:`5 SECONDS CONFESSION - OFFICIAL PV -`}},"rooftop-nap":{id:`rooftop-nap`,title:`屋上の昼寝と、覗き込みハプニング`,shortTitle:`屋上の昼寝`,description:`ぽかぽか陽気の屋上で居眠りしていたら……？アオイの覗き込みドキドキショートストーリー。`,ogpImage:`/ogp/rooftop-nap.png`,getScenario:(e=`ja`)=>y(e)},"park-confession":{id:`park-confession`,title:`夕暮れの公園と放課後の期待`,shortTitle:`夕暮れの公園`,description:`夕暮れの公園に呼び出されたあなた。茜色に染まる並木道で、アオイが伝えたかった想いとは――。`,ogpImage:`/ogp/park-confession.png`,getScenario:(e=`ja`)=>v(e)},"two-girls":{id:`two-girls`,title:`放課後の寄り道〜アオイとエミリ〜`,shortTitle:`放課後の寄り道`,description:`アオイとエミリの放課後カフェトーク。2人の掛け合いを楽しめるインタラクティブシナリオ。`,ogpImage:`/ogp/two-girls.png`,getScenario:(e=`ja`)=>x(e)},trio:{id:`trio`,title:`放課後トライアングル〜アオイとエミリとあなた〜`,shortTitle:`放課後トライアングル`,description:`アオイとエミリとあなたの3人。放課後どこに行くかをめぐるドキドキ作戦会議！`,ogpImage:`/ogp/trio.png`,getScenario:(e=`ja`)=>p(e)},harem:{id:`harem`,title:`放課後大波乱!? 一体誰が本命なのよ〜！`,shortTitle:`本命決着裁判`,description:`4人のヒロインが勢揃い！修羅場と選択肢が待ち受けるマルチキャラクター裁判シナリオ。`,ogpImage:`/ogp/harem.png`,getScenario:(e=`ja`)=>f(e)},"town-walk":{id:`town-walk`,title:`放課後の並木道 〜君と歩く帰り道〜`,shortTitle:`放課後の並木道`,description:`放課後の美しい並木道をアオイと一緒に歩く、臨場感あふれるスクロール背景シナリオ。`,ogpImage:`/ogp/town-walk.png`,getScenario:(e=`ja`)=>T(e)},"behind-you":{id:`behind-you`,title:`噂話は背後にご注意〜教室の秘密〜`,shortTitle:`背後にご注意`,description:`放課後の教室で噂話をしていたら……真後ろに気配が！？360度パノラマ視点シナリオ。`,ogpImage:`/ogp/behind-you.png`,getScenario:(e=`ja`)=>_(e)},nisa:{id:`nisa`,title:`夕暮れの校門とオルカンの憂鬱`,shortTitle:`オルカンの憂鬱`,description:`夕暮れの校門前で繰り広げられる、全力で真面目な新NISA・全世界株式インデックス投資相談ストーリー。`,ogpImage:`/ogp/nisa.png`,getScenario:(e=`ja`)=>d(e)},"fast-motion":{id:`fast-motion`,title:`疾風怒濤！高速アクション特訓`,shortTitle:`高速アクション特訓`,description:`アニメ作画風の残像やスピードリボン、ダイナミックブラーを駆使した高速アクション演出。`,ogpImage:`/ogp/fast-motion.png`,getScenario:(e=`ja`)=>C(e)},"door-peep":{id:`door-peep`,title:`🚪 覗き穴の訪問者〜深夜のヤンデレ〜`,shortTitle:`覗き穴の訪問者`,description:`深夜に響くインターホン……ドアスコープを覗くとそこに立っていたのは？魚眼レンズホラー演出。`,ogpImage:`/ogp/door-peep.png`,getScenario:(e=`ja`)=>b(e)},"private-date":{id:`private-date`,title:`休日デート〜私服のエミリと街歩き〜`,shortTitle:`休日デート`,description:`休日に私服のエミリと待ち合わせ。カフェテラスでの特別なひとときを過ごすデートシナリオ。`,ogpImage:`/ogp/private-date.png`,getScenario:(e=`ja`)=>l(e)},"ghost-mass":{id:`ghost-mass`,title:`👻 幽霊の質量（シャフト風）`,shortTitle:`幽霊の質量`,description:`単色キャラクター・白輪郭・ローポリ教室・赤緑カットイン・シャフ度を散りばめたシャフト風演出シナリオ。`,ogpImage:`/ogp/ghost-mass.png`,getScenario:()=>w},"teacher-gate":{id:`teacher-gate`,title:`校門の邂逅 〜シオンと桐島先生の秘密の推し〜`,shortTitle:`校門の邂逅`,description:`眠そうに登校するシオンと校門で待ち受けるクールな桐島先生。2人がまさかのニッチな古生物トークで意気投合！？`,ogpImage:`/ogp/teacher-gate.png`,getScenario:(e=`ja`)=>g(e)},"silver-week":{id:`silver-week`,title:`シルバーウィークの黄昏 〜アオイとエミリの帰り道〜`,shortTitle:`シルバーウィークの黄昏`,description:`連休最終日の夕暮れ。私服のアオイとエミリが街を歩きながら、名残惜しそうに語り合うショートシナリオ。`,ogpImage:`/ogp/silver-week.png`,getScenario:(e=`ja`)=>O(e)}};function A(e){return k[e]}var j=new URLSearchParams(window.location.search),M=document.body.dataset.scenarioId||j.get(`id`)||`five-seconds-pv`,N=A(M);N||console.error(`[ScenarioPlayer] Scenario not found: ${M}`);var P=i(s),F=new a,I=new e({}),L=new n(document.querySelector(`#app`),P);L.controls.enabled=!1;var R=new E({scene:L.scene,camera:L.camera,controls:L.controls,sharedEffectTextManager:L.sharedEffectTextManager,windController:F,getConfig:()=>P,renderer:L.renderer,onEnterTransparent:()=>{L.scene.background=null,L.hideSkyBackground(),L.midgroundMesh.visible=!1,L.neargroundMesh.visible=!1,L.sunEffect.sunGroup.visible=!1,L.sunEffect.flareGroup.visible=!1,L.renderer.setClearColor(0,0)},onExitTransparent:()=>{L.updateBackgroundDisplay(P),L.updateMidgroundDisplay(P),L.updateNeargroundDisplay(P),L.sunEffect.sunGroup.visible=(P.lighting.sunShafts?.enabled||P.lighting.lensFlare?.enabled)??!1,L.sunEffect.flareGroup.visible=P.lighting.lensFlare?.enabled??!1},onAvatarLoaded:()=>{V(P)}}),z=new m({avatarManager:R,viewerCore:L,audioLipSync:I,config:P.live2d}),B=new h({viewerCore:L,avatarManager:R,getConfig:()=>P});function V(e){L.applyConfig(e),R.isMultiAvatarScenarioActive?R.scenarioAvatars.forEach(t=>t.applyConfig(e)):R.avatarInstance?.applyConfig(e)}var H=new u({config:P,onConfigChange:e=>{V(e)},onInspectorsUpdate:()=>{}}),U=document.createElement(`div`);U.id=`scenario-player-ui`,U.innerHTML=`
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
      <span class="scenario-title-text">${N?.title??`Scenario`}</span>
    </div>
  </div>

  <!-- Start Overlay (Autoplay protection) -->
  <div id="start-overlay" class="start-overlay">
    <div class="start-card">
      <span class="scenario-badge" style="margin-bottom: 14px; display: inline-block;">AnimeVRM Scenario</span>
      <h1 class="start-title">${N?.title??`シナリオを再生`}</h1>
      <p class="start-desc">${N?.description??`再生ボタンを押してシナリオをお楽しみください。`}</p>
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
      <div class="replay-scenario-name">${N?.title??``}</div>
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
          ${Object.values(k).map(e=>`<option value="${e.id}" ${e.id===M?`selected`:``}>${e.title}</option>`).join(``)}
        </select>
      </div>
    </div>
  </div>
`,document.body.appendChild(U);var W=document.getElementById(`start-overlay`),G=document.getElementById(`replay-overlay`),K=document.getElementById(`start-btn`),q=document.getElementById(`replay-btn`);document.getElementById(`other-scenarios-select`)?.addEventListener(`change`,e=>{let t=e.target.value;t&&t!==M&&(window.location.href=`${t}.html`)});var J=!1,Y=new c({scene:L.scene,camera:L.camera,controls:L.controls,avatarManager:R,audioLipSync:I,sharedEffectTextManager:L.sharedEffectTextManager,windController:F,panoramaController:L.panoramaController,shaftModeController:B,getConfig:()=>P,onApplyConfig:e=>{V(e)},onSwitchScenePreset:e=>{H.switchScene(e,!1)},onFinished:()=>{J||G.classList.add(`visible`)}});async function X(){if(!J){J=!0,G.classList.remove(`visible`),W.classList.add(`hidden`);try{if(!N){r(`❌ シナリオ情報が見つかりません`);return}if(I.initAudioContext(),I.audioContext?.state===`suspended`)try{await I.audioContext.resume()}catch(e){console.warn(`Failed to resume AudioContext`,e)}Y.scenarioEngine.isPlaying&&Y.scenarioEngine.stop(),Y.scenarioPlayer.isPlaying&&Y.scenarioPlayer.stop(),L.panoramaController.isActive&&L.panoramaController.deactivate();let e=N.getScenario(`ja`);N.playOptions?.withInterlude?await Y.playWithInterlude(e,{title:N.playOptions.interludeTitle||e.title,subtitle:N.playOptions.interludeSubtitle||`SPECIAL PRESENTATION`}):await Y.scenarioEngine.play(e)}finally{J=!1}}}K.addEventListener(`click`,e=>{e.stopPropagation(),X()}),q.addEventListener(`click`,e=>{e.stopPropagation(),console.log(`[ScenarioPlayer] replayBtn clicked`),X()}),R.loadAvatarModel(R.currentModelUrl),H.switchTimeOfDay(`day`,!1);var Z=new t;Z.connect(document);function Q(e){L.stats.begin(),Z.update(e);let t=Math.min(Z.getDelta(),.1),n=Z.getElapsed();Y.dialogueCameraController?.isActive?Y.dialogueCameraController.update(t):R.animationPlayer.isPlaying?R.animationPlayer.update(t):L.panoramaController.isActive&&L.panoramaController.update(t,n),Y.update(t),B.update();let r=Y.dialogueCameraController?.isActive?Y.dialogueCameraController.getBackgroundTransform():null;L.updateBackgroundZoom(r),L.updateMidgroundTransform(P,r),L.updateNeargroundTransform(P,r),Y.scrollingBackgroundManager?.isVisible&&(Y.scrollingBackgroundManager.update(t,r),L.midgroundMesh.visible=!1,L.neargroundMesh.visible=!1);let i=Y.scenarioEngine.currentScene,a=i?.lipSyncCharacterId===void 0?i?.speakerCharacterId:i.lipSyncCharacterId??`none`;R.update(t,n,P,I,a),L.windParticles.update(t,n,P.wind,F.currentWindVector),L.rainEffect.setCameraPosition(L.camera.position),L.rainEffect.update(n);let o=R.getVrmMeshes();if(L.render(t,n,P,o),Y.scenarioEngine.isPlaying||Y.scenarioPlayer.isPlaying)if(i?.live2d!==void 0){let e=i.live2d,t=typeof e==`boolean`?e:e.enabled??!0;z.setSceneOverride(t)}else z.setSceneOverride(!1);else z.setSceneOverride(null);z.update(t),L.stats.end(),requestAnimationFrame(Q)}Q(),window.addEventListener(`resize`,()=>{L.onResize()}),window.addEventListener(`pointerdown`,()=>{I.audioContext?.state===`suspended`&&I.audioContext.resume().catch(()=>{})},{once:!0}),window.avatarManager=R,window.viewerCore=L,window.scenarioController=Y,window.live2DTransitionManager=z,window.audioLipSync=I;