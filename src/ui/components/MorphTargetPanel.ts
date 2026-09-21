import type { AvatarManager } from '../../avatar/AvatarManager';
import type { MorphTargetPreview } from '../../avatar/MorphTargetPreview';
import { t } from '../../i18n';

/** A disposable panel: weights belong to the avatar and survive panel/language rebuilds. */
export class MorphTargetPanel {
  private editor: MorphTargetPreview | null = null;
  private rows = new Map<string, { element: HTMLElement; range: HTMLInputElement; number: HTMLInputElement }>();
  private details: HTMLDetailsElement;
  private enabled: HTMLInputElement;
  private search: HTMLInputElement;
  private category: HTMLSelectElement;
  private activeOnly: HTMLInputElement;
  private list: HTMLElement;
  private empty: HTMLElement;
  private count: HTMLElement;
  private presetName: HTMLInputElement;
  private json: HTMLTextAreaElement;
  private status: HTMLElement;

  constructor(private host: HTMLElement, private manager: AvatarManager, open = false) {
    const labels = t().character.morphTargets;
    host.innerHTML = `
      <details class="morph-editor" id="morph-target-editor">
        <summary>${labels.title}</summary>
        <div class="morph-editor-content">
          <label class="morph-editor-enable"><input id="morph-preview-enabled" type="checkbox"> ${labels.enable}</label>
          <p class="morph-editor-hint">${labels.hint}</p>
          <div class="morph-editor-actions">
            <button type="button" id="morph-capture">${labels.capture}</button>
            <button type="button" id="morph-reset">${labels.reset}</button>
          </div>
          <input type="search" id="morph-search" placeholder="${labels.search}" aria-label="${labels.search}">
          <div class="morph-editor-filters">
            <select id="morph-category" aria-label="${labels.category}">
              ${(['all', 'brows', 'eyes', 'mouth', 'other'] as const).map((key) => `<option value="${key}">${labels[key]}</option>`).join('')}
            </select>
            <label><input id="morph-active-only" type="checkbox"> ${labels.activeOnly}</label>
          </div>
          <p id="morph-count" class="morph-editor-hint"></p>
          <div id="morph-target-list" class="morph-target-list"></div>
          <p id="morph-empty" class="morph-editor-hint"></p>
          <label class="morph-preset-label" for="morph-preset-name">${labels.name}</label>
          <input id="morph-preset-name" type="text" value="custom_expression" spellcheck="false">
          <label class="morph-preset-label" for="morph-preset-json">${labels.preset}</label>
          <textarea id="morph-preset-json" rows="6" readonly spellcheck="false"></textarea>
          <button type="button" id="morph-copy">${labels.copy}</button>
          <p id="morph-copy-status" class="morph-editor-hint" role="status"></p>
        </div>
      </details>
    `;
    const get = <T extends HTMLElement>(selector: string) => host.querySelector<T>(selector)!;
    this.details = get<HTMLDetailsElement>('details');
    this.details.open = open;
    this.enabled = get<HTMLInputElement>('#morph-preview-enabled');
    this.search = get<HTMLInputElement>('#morph-search');
    this.category = get<HTMLSelectElement>('#morph-category');
    this.activeOnly = get<HTMLInputElement>('#morph-active-only');
    this.list = get('#morph-target-list');
    this.empty = get('#morph-empty');
    this.count = get('#morph-count');
    this.presetName = get<HTMLInputElement>('#morph-preset-name');
    this.json = get<HTMLTextAreaElement>('#morph-preset-json');
    this.status = get('#morph-copy-status');
    this.enabled.addEventListener('change', () => this.editor?.setEnabled(this.enabled.checked));
    get('#morph-capture').addEventListener('click', () => this.editor?.captureCurrent());
    get('#morph-reset').addEventListener('click', () => this.editor?.reset());
    this.search.addEventListener('input', this.sync);
    this.category.addEventListener('change', this.sync);
    this.activeOnly.addEventListener('change', this.sync);
    this.presetName.addEventListener('input', this.sync);
    get('#morph-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.json.value);
        this.status.textContent = labels.copied;
      } catch {
        this.json.focus();
        this.json.select();
        this.status.textContent = labels.copyFailed;
      }
    });
    window.addEventListener('avatar-model-change', this.refreshModel);
    this.refreshModel();
  }

  get isOpen(): boolean { return this.details.open; }

  private refreshModel = (): void => {
    const editor = this.manager.avatarInstance?.morphTargetPreview ?? null;
    if (editor === this.editor && this.rows.size > 0) return;
    this.editor?.removeEventListener('change', this.sync);
    this.editor = editor;
    this.editor?.addEventListener('change', this.sync);
    this.rows.clear();
    this.list.replaceChildren();
    this.status.textContent = '';
    for (const [index, target] of (this.editor?.getControls() ?? []).entries()) {
      const element = document.createElement('div');
      element.className = 'morph-target-row';
      element.dataset.morph = target.name;
      element.innerHTML = `
        <label for="morph-number-${index}" class="morph-target-name"></label>
        <div class="morph-target-values">
          <input class="morph-target-range" type="range" min="0" max="1" step="0.001">
          <input id="morph-number-${index}" class="morph-target-number" type="number" min="0" max="1" step="0.01">
        </div>
      `;
      const label = element.querySelector<HTMLLabelElement>('label')!;
      label.textContent = target.name;
      label.title = target.meshes.join('\n');
      const range = element.querySelector<HTMLInputElement>('input[type="range"]')!;
      const number = element.querySelector<HTMLInputElement>('input[type="number"]')!;
      range.setAttribute('aria-label', target.name);
      range.addEventListener('input', () => this.editor?.setWeight(target.name, range.valueAsNumber));
      number.addEventListener('input', () => {
        if (Number.isFinite(number.valueAsNumber)) this.editor?.setWeight(target.name, number.valueAsNumber);
      });
      number.addEventListener('change', () => {
        this.editor?.setWeight(target.name, Number.isFinite(number.valueAsNumber) ? number.valueAsNumber : 0);
        const value = this.editor?.getControls().find((control) => control.name === target.name)?.weight ?? 0;
        number.value = String(value);
      });
      this.rows.set(target.name, { element, range, number });
      this.list.append(element);
    }
    this.sync();
  };

  private sync = (): void => {
    const labels = t().character.morphTargets;
    const controls = this.editor?.getControls() ?? [];
    const available = controls.length > 0;
    this.enabled.checked = this.editor?.enabled ?? false;
    this.enabled.disabled = !available;
    for (const button of this.host.querySelectorAll<HTMLButtonElement>('button')) button.disabled = !available;
    const query = this.search.value.trim().toLowerCase();
    let visible = 0;
    for (const control of controls) {
      const row = this.rows.get(control.name)!;
      const matches = (!query || control.name.toLowerCase().includes(query))
        && (this.category.value === 'all' || this.category.value === control.category)
        && (!this.activeOnly.checked || control.weight !== 0);
      row.element.hidden = !matches;
      if (matches) visible++;
      row.element.classList.toggle('has-weight', control.weight !== 0);
      row.range.value = String(control.weight);
      if (document.activeElement !== row.number) row.number.value = String(control.weight);
      row.range.disabled = row.number.disabled = !this.enabled.checked;
    }
    this.count.textContent = `${labels.count}: ${visible} / ${controls.length} · ${labels.nonzero}: ${controls.filter((target) => target.weight !== 0).length}`;
    this.empty.hidden = visible > 0;
    this.empty.textContent = available ? labels.noMatches : labels.empty;
    this.json.value = this.editor ? JSON.stringify(this.editor.exportPreset(this.presetName.value, this.manager.currentModelUrl), null, 2) : '';
    this.status.textContent = '';
  };

  dispose(): void {
    window.removeEventListener('avatar-model-change', this.refreshModel);
    this.editor?.removeEventListener('change', this.sync);
  }
}
