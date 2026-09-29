import { GameEngine } from './GameEngine';

async function bootstrap() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('game-canvas not found');
  }

  const engine = new GameEngine(canvas);
  (window as any).__GAME__ = engine;
  await engine.init();

  // ボタンイベント登録
  const btnRestart = document.getElementById('btn-restart');
  btnRestart?.addEventListener('click', () => {
    engine.restart();
  });

  const btnCamera = document.getElementById('btn-camera');
  btnCamera?.addEventListener('click', () => {
    engine.toggleCamera();
    if (btnCamera) {
      const modeText = engine.cameraMode === 'dramatic' ? 'カメラ: 追従' : engine.cameraMode === 'side' ? 'カメラ: 横' : 'カメラ: 自由';
      btnCamera.textContent = modeText;
    }
  });

  // メインループ
  let lastTime = performance.now();
  function animate(now: number) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    engine.update(delta);
  }

  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(err => {
    console.error('Failed to initialize mini-game:', err);
  });
});
