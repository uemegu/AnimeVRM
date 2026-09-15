import{r as e}from"./ToonShader-BO7Ze8Gq.js";import{wt as t}from"./three-vrm.module-VhWkSE5H.js";import{A as n,C as r,M as i,_ as a,a as o,c as s,d as c,f as l,h as u,i as d,j as f,l as p,m,n as h,o as g,p as _,r as v,s as y,t as b,u as x,w as S}from"./rooftopNapScenario-BrwyD3Ci.js";var C={"five-seconds-pv":{id:`five-seconds-pv`,title:`【PV】5秒の告白 〜5 Seconds Confession〜`,shortTitle:`5秒の告白 PV`,description:`たった5秒の勇気で、世界は変わる。楽曲と完全同期するAnimeVRMオリジナル短編アニメーションPV。`,ogpImage:`/ogp/five-seconds-pv.png`,getScenario:()=>h(),playOptions:{withInterlude:!0,interludeTitle:`5秒の告白`,interludeSubtitle:`5 SECONDS CONFESSION - OFFICIAL PV -`}},"rooftop-nap":{id:`rooftop-nap`,title:`屋上の昼寝と、覗き込みハプニング`,shortTitle:`屋上の昼寝`,description:`ぽかぽか陽気の屋上で居眠りしていたら……？アオイの覗き込みドキドキショートストーリー。`,ogpImage:`/ogp/rooftop-nap.png`,getScenario:(e=`ja`)=>b(e)},"park-confession":{id:`park-confession`,title:`夕暮れの公園と放課後の期待`,shortTitle:`夕暮れの公園`,description:`夕暮れの公園に呼び出されたあなた。茜色に染まる並木道で、アオイが伝えたかった想いとは――。`,ogpImage:`/ogp/park-confession.png`,getScenario:(e=`ja`)=>l(e)},"two-girls":{id:`two-girls`,title:`放課後の寄り道〜アオイとエミリ〜`,shortTitle:`放課後の寄り道`,description:`アオイとエミリの放課後カフェトーク。2人の掛け合いを楽しめるインタラクティブシナリオ。`,ogpImage:`/ogp/two-girls.png`,getScenario:(e=`ja`)=>c(e)},trio:{id:`trio`,title:`放課後トライアングル〜アオイとエミリとあなた〜`,shortTitle:`放課後トライアングル`,description:`アオイとエミリとあなたの3人。放課後どこに行くかをめぐるドキドキ作戦会議！`,ogpImage:`/ogp/trio.png`,getScenario:(e=`ja`)=>x(e)},harem:{id:`harem`,title:`放課後大波乱!? 一体誰が本命なのよ〜！`,shortTitle:`本命決着裁判`,description:`4人のヒロインが勢揃い！修羅場と選択肢が待ち受けるマルチキャラクター裁判シナリオ。`,ogpImage:`/ogp/harem.png`,getScenario:(e=`ja`)=>p(e)},"town-walk":{id:`town-walk`,title:`放課後の並木道 〜君と歩く帰り道〜`,shortTitle:`放課後の並木道`,description:`放課後の美しい並木道をアオイと一緒に歩く、臨場感あふれるスクロール背景シナリオ。`,ogpImage:`/ogp/town-walk.png`,getScenario:(e=`ja`)=>s(e)},"behind-you":{id:`behind-you`,title:`噂話は背後にご注意〜教室の秘密〜`,shortTitle:`背後にご注意`,description:`放課後の教室で噂話をしていたら……真後ろに気配が！？360度パノラマ視点シナリオ。`,ogpImage:`/ogp/behind-you.png`,getScenario:(e=`ja`)=>y(e)},nisa:{id:`nisa`,title:`夕暮れの校門とオルカンの憂鬱`,shortTitle:`オルカンの憂鬱`,description:`夕暮れの校門前で繰り広げられる、全力で真面目な新NISA・全世界株式インデックス投資相談ストーリー。`,ogpImage:`/ogp/nisa.png`,getScenario:(e=`ja`)=>g(e)},"fast-motion":{id:`fast-motion`,title:`疾風怒濤！高速アクション特訓`,shortTitle:`高速アクション特訓`,description:`アニメ作画風の残像やスピードリボン、ダイナミックブラーを駆使した高速アクション演出。`,ogpImage:`/ogp/fast-motion.png`,getScenario:(e=`ja`)=>o(e)},"door-peep":{id:`door-peep`,title:`🚪 覗き穴の訪問者〜深夜のヤンデレ〜`,shortTitle:`覗き穴の訪問者`,description:`深夜に響くインターホン……ドアスコープを覗くとそこに立っていたのは？魚眼レンズホラー演出。`,ogpImage:`/ogp/door-peep.png`,getScenario:(e=`ja`)=>d(e)},"private-date":{id:`private-date`,title:`休日デート〜私服のエミリと街歩き〜`,shortTitle:`休日デート`,description:`休日に私服のエミリと待ち合わせ。カフェテラスでの特別なひとときを過ごすデートシナリオ。`,ogpImage:`/ogp/private-date.png`,getScenario:(e=`ja`)=>v(e)}};function w(e){return C[e]}var T=new URLSearchParams(window.location.search),E=document.body.dataset.scenarioId||T.get(`id`)||`five-seconds-pv`,D=w(E);D||console.error(`[ScenarioPlayer] Scenario not found: ${E}`);var O=i(f),k=new n,A=new e({}),j=new S(document.querySelector(`#app`),O);j.controls.enabled=!1;var M=new u({scene:j.scene,camera:j.camera,controls:j.controls,sharedEffectTextManager:j.sharedEffectTextManager,windController:k,getConfig:()=>O,renderer:j.renderer,onEnterTransparent:()=>{j.scene.background=null,j.hideSkyBackground(),j.midgroundMesh.visible=!1,j.neargroundMesh.visible=!1,j.sunEffect.sunGroup.visible=!1,j.sunEffect.flareGroup.visible=!1,j.renderer.setClearColor(0,0)},onExitTransparent:()=>{j.updateBackgroundDisplay(O),j.updateMidgroundDisplay(O),j.updateNeargroundDisplay(O),j.sunEffect.sunGroup.visible=(O.lighting.sunShafts?.enabled||O.lighting.lensFlare?.enabled)??!1,j.sunEffect.flareGroup.visible=O.lighting.lensFlare?.enabled??!1},onAvatarLoaded:()=>{P(O)}}),N=new _({avatarManager:M,viewerCore:j,audioLipSync:A,config:O.live2d});function P(e){j.applyConfig(e),M.isMultiAvatarScenarioActive?M.scenarioAvatars.forEach(t=>t.applyConfig(e)):M.avatarInstance?.applyConfig(e)}var F=new a({config:O,onConfigChange:e=>{P(e)},onInspectorsUpdate:()=>{}}),I=document.createElement(`div`);I.id=`scenario-player-ui`,I.innerHTML=`
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
      <span class="scenario-title-text">${D?.title??`Scenario`}</span>
    </div>
  </div>

  <!-- Start Overlay (Autoplay protection) -->
  <div id="start-overlay" class="start-overlay">
    <div class="start-card">
      <span class="scenario-badge" style="margin-bottom: 14px; display: inline-block;">AnimeVRM Scenario</span>
      <h1 class="start-title">${D?.title??`シナリオを再生`}</h1>
      <p class="start-desc">${D?.description??`再生ボタンを押してシナリオをお楽しみください。`}</p>
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
      <div class="replay-scenario-name">${D?.title??``}</div>
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
          ${Object.values(C).map(e=>`<option value="${e.id}" ${e.id===E?`selected`:``}>${e.title}</option>`).join(``)}
        </select>
      </div>
    </div>
  </div>
`,document.body.appendChild(I);var L=document.getElementById(`start-overlay`),R=document.getElementById(`replay-overlay`),z=document.getElementById(`start-btn`),B=document.getElementById(`replay-btn`);document.getElementById(`other-scenarios-select`)?.addEventListener(`change`,e=>{let t=e.target.value;t&&t!==E&&(window.location.href=`${t}.html`)});var V=!1,H=new m({scene:j.scene,camera:j.camera,controls:j.controls,avatarManager:M,audioLipSync:A,sharedEffectTextManager:j.sharedEffectTextManager,windController:k,panoramaController:j.panoramaController,getConfig:()=>O,onApplyConfig:e=>{P(e)},onSwitchScenePreset:e=>{F.switchScene(e,!1)},onFinished:()=>{V||R.classList.add(`visible`)}});async function U(){if(!V){V=!0,R.classList.remove(`visible`),L.classList.add(`hidden`);try{if(!D){r(`❌ シナリオ情報が見つかりません`);return}if(A.audioContext?.state===`suspended`)try{await A.audioContext.resume()}catch(e){console.warn(`Failed to resume AudioContext`,e)}H.scenarioEngine.isPlaying&&H.scenarioEngine.stop(),H.scenarioPlayer.isPlaying&&H.scenarioPlayer.stop(),j.panoramaController.isActive&&j.panoramaController.deactivate();let e=D.getScenario(`ja`);D.playOptions?.withInterlude?await H.playWithInterlude(e,{title:D.playOptions.interludeTitle||e.title,subtitle:D.playOptions.interludeSubtitle||`SPECIAL PRESENTATION`}):await H.scenarioEngine.play(e)}finally{V=!1}}}z.addEventListener(`click`,e=>{e.stopPropagation(),U()}),B.addEventListener(`click`,e=>{e.stopPropagation(),console.log(`[ScenarioPlayer] replayBtn clicked`),U()}),M.loadAvatarModel(M.currentModelUrl),F.switchTimeOfDay(`day`,!1);var W=new t;W.connect(document);function G(e){j.stats.begin(),W.update(e);let t=Math.min(W.getDelta(),.1),n=W.getElapsed();H.dialogueCameraController?.isActive?H.dialogueCameraController.update(t):M.animationPlayer.isPlaying?M.animationPlayer.update(t):j.panoramaController.isActive&&j.panoramaController.update(t,n),H.update(t);let r=H.dialogueCameraController?.isActive?H.dialogueCameraController.getBackgroundTransform():null;j.updateBackgroundZoom(r),j.updateMidgroundTransform(O,r),j.updateNeargroundTransform(O,r),H.scrollingBackgroundManager?.isVisible&&(H.scrollingBackgroundManager.update(t,r),j.midgroundMesh.visible=!1,j.neargroundMesh.visible=!1);let i=H.scenarioEngine.currentScene,a=i?.lipSyncCharacterId===void 0?i?.speakerCharacterId:i.lipSyncCharacterId??`none`;M.update(t,n,O,A,a),j.windParticles.update(t,n,O.wind,k.currentWindVector),j.rainEffect.setCameraPosition(j.camera.position),j.rainEffect.update(n);let o=M.getVrmMeshes();if(j.render(t,n,O,o),i?.live2d!==void 0){let e=i.live2d,t=typeof e==`boolean`?e:e.enabled??!0;N.setSceneOverride(t)}else N.setSceneOverride(null);N.update(t),j.stats.end(),requestAnimationFrame(G)}G(),window.addEventListener(`resize`,()=>{j.onResize()}),window.addEventListener(`pointerdown`,()=>{A.audioContext?.state===`suspended`&&A.audioContext.resume().catch(()=>{})},{once:!0});