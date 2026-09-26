import { useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { BUILTIN_ENVIRONMENTS, type FieldMeta } from '@anime-vrm/scenario';
import { useI18n } from '../i18n';
import { Icon } from './Icon';
import './SchemaForm.css';

/**
 * zod スキーマ（packages/scenario）から編集フォームを組み立てる。
 * 表示名・数値の範囲・入力方法は各項目の meta（FieldMeta）を使う
 */

type AnySchema = z.ZodType & { _zod: { def: { type: string } } };

interface Context {
  /** 画像を選ぶときの候補（assets/ 基準の URL） */
  images: string[];
  /** この深さまでのグループを最初から開いておく */
  openDepth: number;
  /** 3D背景に使える glb（assets/ 基準の URL） */
  environments: string[];
}

function kindOf(schema: AnySchema): string {
  return schema._zod.def.type;
}

function metaOf(schema: AnySchema): Partial<FieldMeta> {
  return (schema.meta() as Partial<FieldMeta> | undefined) ?? {};
}

function unwrap(schema: AnySchema): AnySchema {
  return kindOf(schema) === 'optional' ? ((schema as unknown as z.ZodOptional<z.ZodType>).unwrap() as AnySchema) : schema;
}

function shapeOf(schema: AnySchema): Record<string, AnySchema> {
  return (schema as unknown as z.ZodObject).shape as Record<string, AnySchema>;
}

/** 項目を新しく足すときの初期値 */
export function defaultValue(schema: AnySchema): unknown {
  const inner = unwrap(schema);
  const meta = metaOf(inner);
  if (meta.default !== undefined) return meta.default;
  switch (kindOf(inner)) {
    case 'object':
      return Object.fromEntries(
        Object.entries(shapeOf(inner))
          .filter(([, s]) => kindOf(s) !== 'optional')
          .map(([key, s]) => [key, defaultValue(s)])
      );
    case 'number': {
      const { min = 0, max = 1 } = meta;
      return min <= 0 && 0 <= max ? 0 : min;
    }
    case 'boolean':
      return false;
    case 'enum':
      return (inner as unknown as z.ZodEnum).options[0];
    default:
      if (meta.kind === 'environment') return Object.keys(BUILTIN_ENVIRONMENTS)[0];
      return meta.kind === 'color' ? '#ffffff' : '';
  }
}

export function SchemaForm({
  schema,
  value,
  onChange,
  images,
  environments = [],
  hidden = ['id'],
  openDepth = 0,
}: {
  schema: AnySchema;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  images: string[];
  environments?: string[];
  /** 表示しない項目（ID など、ここでは変えないもの） */
  hidden?: string[];
  /** この深さまでのグループを最初から開いておく（0 は最上位だけ） */
  openDepth?: number;
}) {
  return (
    <div className="schema-form">
      <ObjectFields schema={unwrap(schema)} value={value} onChange={onChange} ctx={{ images, openDepth, environments }} depth={0} skip={hidden} />
    </div>
  );
}

function ObjectFields({ schema, value, onChange, ctx, depth, skip = [] }: { schema: AnySchema; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void; ctx: Context; depth: number; skip?: string[] }) {
  const entries = Object.entries(shapeOf(schema)).filter(([key]) => !skip.includes(key));
  return (
    <>
      {entries.map(([key, fieldSchema]) => (
        <Field
          key={key}
          schema={fieldSchema}
          value={value[key]}
          depth={depth}
          ctx={ctx}
          onChange={(next) => {
            const copy = { ...value };
            if (next === undefined) delete copy[key];
            else copy[key] = next;
            onChange(copy);
          }}
        />
      ))}
    </>
  );
}

function Field({ schema, value, onChange, ctx, depth }: { schema: AnySchema; value: unknown; onChange: (v: unknown) => void; ctx: Context; depth: number }) {
  const { t, language } = useI18n();
  const optional = kindOf(schema) === 'optional';
  const inner = unwrap(schema);
  const meta = metaOf(inner);
  const label = meta.label?.[language] ?? '';
  const kind = kindOf(inner);

  if (kind === 'object') {
    return (
      <Group
        label={label}
        depth={depth}
        initiallyOpen={depth <= ctx.openDepth}
        present={value !== undefined}
        onAdd={optional ? () => onChange(defaultValue(inner)) : undefined}
        onRemove={optional ? () => onChange(undefined) : undefined}
      >
        {value !== undefined && (
          <ObjectFields schema={inner} value={value as Record<string, unknown>} onChange={onChange} ctx={ctx} depth={depth + 1} />
        )}
      </Group>
    );
  }

  // 未指定の項目（既定値で動く）
  if (value === undefined) {
    return (
      <Row label={label}>
        <span className="schema-unset">{meta.default !== undefined ? `${t.scenes.defaultValue}: ${String(meta.default)}` : t.scenes.unset}</span>
        <button type="button" className="schema-small-btn" onClick={() => onChange(defaultValue(inner))}>
          {t.scenes.set}
        </button>
      </Row>
    );
  }

  const removeButton = optional && (
    <button type="button" className="schema-icon-btn" title={t.scenes.unsetAction} onClick={() => onChange(undefined)}>
      <Icon name="close" size={12} />
    </button>
  );

  if (kind === 'number') {
    const { min = 0, max = 1, step = 0.01 } = meta;
    const num = value as number;
    return (
      <Row label={label} extra={removeButton}>
        <input className="schema-range" type="range" min={min} max={max} step={step} value={num} onChange={(e) => onChange(Number(e.target.value))} />
        <input
          className="input schema-number"
          type="number"
          step={step}
          value={num}
          onChange={(e) => e.target.value !== '' && Number.isFinite(Number(e.target.value)) && onChange(Number(e.target.value))}
        />
      </Row>
    );
  }

  if (kind === 'boolean') {
    return (
      <Row label={label} extra={removeButton}>
        <label className="schema-switch">
          <input type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
          <span />
        </label>
      </Row>
    );
  }

  if (kind === 'enum') {
    const options = (inner as unknown as z.ZodEnum).options as string[];
    return (
      <Row label={label} extra={removeButton}>
        <select className="select" value={value as string} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {meta.options?.[o]?.[language] ?? o}
            </option>
          ))}
        </select>
      </Row>
    );
  }

  // 座標などの数値の組（[x, y, z]）
  if (kind === 'tuple') {
    const values = value as number[];
    const { step = 0.01 } = meta;
    return (
      <Row label={label} extra={removeButton}>
        <div className="schema-tuple">
          {values.map((v, i) => (
            <label key={i}>
              <span>{'XYZW'[i]}</span>
              <input
                className="input schema-number"
                type="number"
                step={step}
                value={v}
                onChange={(e) => {
                  if (e.target.value === '' || !Number.isFinite(Number(e.target.value))) return;
                  onChange(values.map((old, j) => (j === i ? Number(e.target.value) : old)));
                }}
              />
            </label>
          ))}
        </div>
      </Row>
    );
  }

  const text = value as string;
  if (meta.kind === 'color') {
    return (
      <Row label={label} extra={removeButton}>
        <input className="schema-color" type="color" value={text} onChange={(e) => onChange(e.target.value)} />
        <input className="input schema-hex" value={text} onChange={(e) => onChange(e.target.value)} />
      </Row>
    );
  }
  if (meta.kind === 'image') {
    return (
      <Row label={label} extra={removeButton} tall>
        <div className="schema-image">
          {text && <img src={text} alt="" />}
          <select className="select" value={text} onChange={(e) => onChange(e.target.value)}>
            {!ctx.images.includes(text) && <option value={text}>{text}</option>}
            {ctx.images.map((url) => (
              <option key={url} value={url}>
                {url.replace(/^\/textures\//, '')}
              </option>
            ))}
          </select>
        </div>
      </Row>
    );
  }
  if (meta.kind === 'environment') {
    const builtins = Object.entries(BUILTIN_ENVIRONMENTS);
    return (
      <Row label={label} extra={removeButton}>
        <select className="select" value={text} onChange={(e) => onChange(e.target.value)}>
          {!text && <option value="" />}
          {builtins.map(([key, name]) => (
            <option key={key} value={key}>
              {name[language]}
            </option>
          ))}
          {ctx.environments.map((url) => (
            <option key={url} value={url}>
              {url.replace(/^\/models\//, '')}
            </option>
          ))}
        </select>
      </Row>
    );
  }
  return (
    <Row label={label} extra={removeButton}>
      <input className="input" value={text} onChange={(e) => onChange(e.target.value)} />
    </Row>
  );
}

function Row({ label, children, extra, tall }: { label: string; children: ReactNode; extra?: ReactNode; tall?: boolean }) {
  return (
    <div className={`schema-row${tall ? ' tall' : ''}`}>
      <span className="schema-label">{label}</span>
      <div className="schema-control">{children}</div>
      <div className="schema-extra">{extra}</div>
    </div>
  );
}

function Group({
  label,
  depth,
  initiallyOpen,
  present,
  children,
  onAdd,
  onRemove,
}: {
  label: string;
  depth: number;
  initiallyOpen: boolean;
  present: boolean;
  children: ReactNode;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className={`schema-group depth-${Math.min(depth, 2)}${open && present ? ' open' : ''}`}>
      <header className="schema-group-header">
        <button type="button" className="schema-group-toggle" disabled={!present} onClick={() => setOpen(!open)}>
          <span className="schema-chevron">
            <Icon name="chevron" size={12} />
          </span>
          {label}
        </button>
        {!present && onAdd && (
          <button type="button" className="schema-small-btn" onClick={onAdd}>
            {t.scenes.set}
          </button>
        )}
        {present && onRemove && (
          <button type="button" className="schema-small-btn subtle" onClick={onRemove}>
            {t.scenes.unsetAction}
          </button>
        )}
      </header>
      {open && present && <div className="schema-group-body">{children}</div>}
    </section>
  );
}
