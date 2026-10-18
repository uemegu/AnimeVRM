import { useI18n } from '../i18n';

interface Props {
  /** 寄る相手（省略で話者） */
  focus: string | undefined;
  /** 肩越し（ots）の手前の人（省略で自動） */
  over: string | undefined;
  /** 肩越しの構図か（手前の人を選べるのは肩越しのときだけ） */
  showOver: boolean;
  characters: { id: string; name: string }[];
  onChange: (focus: string | undefined, over: string | undefined) => void;
}

/** カメラが寄る相手と、肩越しの手前の人を選ぶ */
export function CameraSubjectFields({ focus, over, showOver, characters, onChange }: Props) {
  const { t } = useI18n();
  const options = (selected: string | undefined) => {
    // 一覧にない ID（ほかのキャラ帳のキャラなど）も選ばれたまま見せる
    const list = selected && !characters.some((c) => c.id === selected) ? [...characters, { id: selected, name: selected }] : characters;
    return list.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    ));
  };
  return (
    <>
      <label className="field">
        <span className="field-label">{t.scenarios.cameraFocus}</span>
        <select className="select" value={focus ?? ''} onChange={(e) => onChange(e.target.value || undefined, over)}>
          <option value="">{t.scenarios.cameraFocusSpeaker}</option>
          {options(focus)}
        </select>
      </label>
      {(showOver || over) && (
        <label className="field">
          <span className="field-label">{t.scenarios.cameraOver}</span>
          <select className="select" value={over ?? ''} onChange={(e) => onChange(focus, e.target.value || undefined)}>
            <option value="">{t.scenarios.auto}</option>
            {options(over)}
          </select>
        </label>
      )}
    </>
  );
}
