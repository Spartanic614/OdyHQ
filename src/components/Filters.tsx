// Lightweight filter controls for table toolbars.

export function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs text-muted">
      {label}
      <select
        className="input py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

// Multi-select rendered as toggle chips (used by the calendar).
export function ChipFilter({
  options,
  selected,
  onToggle,
  colorFor,
}: {
  options: string[]
  selected: Set<string>
  onToggle: (v: string) => void
  colorFor?: (v: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.has(o)
        const color = colorFor?.(o)
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              on
                ? 'border-transparent text-white'
                : 'border-ink-500 text-muted hover:text-text'
            }`}
            style={on && color ? { backgroundColor: color } : undefined}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

// Unique, sorted, non-empty values of a field across rows.
export function uniqueValues<T>(
  rows: T[],
  pick: (r: T) => string | null | undefined,
): string[] {
  const set = new Set<string>()
  for (const r of rows) {
    const v = pick(r)
    if (v != null && String(v).trim() !== '') set.add(String(v))
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}
