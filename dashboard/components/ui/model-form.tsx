'use client';

import { useState, useEffect } from 'react';
import type { FieldDef } from '@electricalwizard/shared';

interface ModelFormProps {
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  loading?: boolean;
}

const EMPTY_INITIAL: Record<string, unknown> = {};

export function ModelForm({
  fields,
  initial = EMPTY_INITIAL,
  onSubmit,
  loading,
}: ModelFormProps) {
  const editableFields = fields.filter((f) => !f.readOnly);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function buildInitialValues(init: Record<string, unknown>) {
    const result: Record<string, unknown> = {};
    for (const f of editableFields) {
      const val = init[f.name];
      if (f.type === 'date' && val) {
        result[f.name] = new Date(val as string).toISOString().slice(0, 16);
      } else if (f.type === 'object' && val) {
        result[f.name] = JSON.stringify(val, null, 2);
      } else {
        result[f.name] = val ?? '';
      }
    }
    return result;
  }

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    buildInitialValues(initial),
  );

  useEffect(() => {
    setValues(buildInitialValues(initial));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const set = (name: string, value: unknown) =>
    setValues((v) => ({ ...v, [name]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const data: Record<string, unknown> = {};
    for (const f of editableFields) {
      const val = values[f.name];
      if (val === '' || val === undefined) {
        if (f.required) newErrors[f.name] = 'Required';
        continue;
      }
      if (f.type === 'number') data[f.name] = Number(val);
      else if (f.type === 'boolean')
        data[f.name] = val === true || val === 'true';
      else if (f.type === 'object') {
        try {
          data[f.name] = JSON.parse(val as string);
        } catch {
          newErrors[f.name] = 'Invalid JSON';
        }
      } else data[f.name] = val;
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {editableFields.map((f) => (
        <div key={f.name}>
          <label className="block text-sm text-muted-foreground mb-1">
            {f.name}
            {f.required && <span className="text-destructive ml-1">*</span>}
          </label>
          {f.enum ? (
            <select
              value={String(values[f.name] ?? '')}
              onChange={(e) => set(f.name, e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm"
            >
              <option value="">--</option>
              {f.enum.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ) : f.type === 'boolean' ? (
            <input
              type="checkbox"
              checked={values[f.name] === true || values[f.name] === 'true'}
              onChange={(e) => set(f.name, e.target.checked)}
              className="accent-accent"
            />
          ) : f.type === 'date' ? (
            <input
              type="datetime-local"
              value={String(values[f.name] ?? '')}
              onChange={(e) => set(f.name, e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm"
            />
          ) : f.type === 'object' ? (
            <textarea
              value={String(values[f.name] ?? '')}
              onChange={(e) => set(f.name, e.target.value)}
              rows={3}
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm font-mono"
            />
          ) : (
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              value={String(values[f.name] ?? '')}
              onChange={(e) => set(f.name, e.target.value)}
              className="w-full bg-surface border border-border rounded px-3 py-1.5 text-sm"
            />
          )}
          {errors[f.name] && (
            <p className="text-destructive text-xs mt-1">{errors[f.name]}</p>
          )}
        </div>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
