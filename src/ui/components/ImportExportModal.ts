import { exportConfigJSON, cloneConfig, DEFAULT_CONFIG, deepAssign, AvatarConfig } from '../../Config';
import { t } from '../../i18n';
import { showToast } from './Toast';

export function openImportModal(
  currentConfig: AvatarConfig,
  onApplyConfig: (cfg: AvatarConfig) => void
): void {
  let modal = document.getElementById('import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'import-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '10000';

    const tr = t();
    modal.innerHTML = `
      <div style="background: #242424; border: 1px solid #383838; border-radius: 6px; padding: 20px; width: 90%; max-width: 500px; box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.6); color: #cccccc;">
        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 15px; color: #ffffff;">${tr.render.importModalTitle}</h3>
        <p style="font-size: 11.5px; color: #aaaaaa; margin-bottom: 12px;">${tr.render.importModalDesc}</p>
        <textarea id="import-textarea" rows="12" style="width: 100%; box-sizing: border-box; font-family: monospace; font-size: 11.5px; padding: 8px; background: #181818; color: #e0e0e0; border: 1px solid #383838; border-radius: 4px; resize: vertical; outline: none;"></textarea>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
          <button id="modal-cancel-btn" style="padding: 6px 14px; background: #383838; border: 1px solid #484848; color: #cccccc; border-radius: 4px; cursor: pointer; font-size: 12px;">${tr.common.cancel}</button>
          <button id="modal-apply-btn" style="padding: 6px 14px; background: #4772b3; color: white; border: 1px solid #385e94; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">${tr.render.applyConfig}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
      modal!.style.display = 'none';
    });

    document.getElementById('modal-apply-btn')?.addEventListener('click', () => {
      const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
      if (textarea && textarea.value) {
        try {
          const parsed = JSON.parse(textarea.value);
          if (!parsed.shortAnimation || !Array.isArray(parsed.shortAnimation.cuts)) {
            parsed.shortAnimation = cloneConfig(DEFAULT_CONFIG).shortAnimation;
          }
          deepAssign(currentConfig, parsed);
          onApplyConfig(currentConfig);
          modal!.style.display = 'none';
          showToast(t().toasts.configImported);
        } catch (err) {
          alert(t().render.parseError);
        }
      }
    });
  }

  const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
  if (textarea) textarea.value = exportConfigJSON(currentConfig);
  modal.style.display = 'flex';
}
