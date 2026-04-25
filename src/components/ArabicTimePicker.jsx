import React, { useMemo } from 'react';

// ── Conversion helpers ────────────────────────────────────────────────────────

/**
 * Parse a 24-hour "HH:mm" string → { hour12, minute, period }
 * Returns null if the string is invalid.
 */
export function parse24To12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  let hour12;
  let period;
  if (h === 0)       { hour12 = 12; period = 'am'; }
  else if (h < 12)   { hour12 = h;  period = 'am'; }
  else if (h === 12) { hour12 = 12; period = 'pm'; }
  else               { hour12 = h - 12; period = 'pm'; }

  return { hour12, minute: m, period };
}

/**
 * Convert (hour12, minute, period) → 24-hour "HH:mm" string.
 */
export function to24(hour12, minute, period) {
  let h = parseInt(hour12, 10);
  const m = parseInt(minute, 10);
  if (period === 'am') {
    h = h === 12 ? 0 : h;
  } else {
    h = h === 12 ? 12 : h + 12;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Format a 24-hour "HH:mm" string for display in Arabic 12-hour format.
 * e.g. "13:00" → "01:00 مساءً"
 * Falls back to the original string on failure.
 */
export function formatArabic12(hhmm) {
  const parsed = parse24To12(hhmm);
  if (!parsed) return hhmm || '—';
  const { hour12, minute, period } = parsed;
  const h = String(hour12).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  const label = period === 'am' ? 'صباحًا' : 'مساءً';
  return `${h}:${m} ${label}`;
}

// ── Select style helper ───────────────────────────────────────────────────────
const SELECT_CLS =
  'flex-1 px-2 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-[#8B0000] outline-none text-sm font-semibold bg-white text-center appearance-none cursor-pointer';

// ── ArabicTimePicker ──────────────────────────────────────────────────────────
/**
 * Props:
 *   label    – string label shown above the picker
 *   value    – current value in "HH:mm" 24-hour format (or "")
 *   onChange – called with "HH:mm" 24-hour string
 *   required – boolean
 *   id       – optional id for the first select
 */
export default function ArabicTimePicker({ label, value, onChange, required, id }) {
  // Derive picker state from the HH:mm value prop
  const parsed = useMemo(() => parse24To12(value), [value]);

  const hour12 = parsed?.hour12 ?? 6;
  const minute = parsed?.minute ?? 0;
  const period = parsed?.period ?? 'pm';

  const emit = (h, m, p) => onChange(to24(h, m, p));

  const handleHour   = (e) => emit(e.target.value, minute, period);
  const handleMinute = (e) => emit(hour12, e.target.value, period);
  const handlePeriod = (e) => emit(hour12, minute, e.target.value);

  const isMorning = value && parse24To12(value)?.period === 'am';

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </label>
      )}

      {/* Three dropdowns side by side */}
      <div className="flex gap-2 items-center" dir="rtl">
        {/* Hour */}
        <select
          id={id}
          value={hour12}
          onChange={handleHour}
          required={required}
          className={SELECT_CLS}
          aria-label="الساعة"
        >
          {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
          ))}
        </select>

        <span className="text-gray-400 font-bold flex-shrink-0">:</span>

        {/* Minute */}
        <select
          value={minute}
          onChange={handleMinute}
          className={SELECT_CLS}
          aria-label="الدقيقة"
        >
          {[0, 15, 30, 45].map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>

        {/* Period */}
        <select
          value={period}
          onChange={handlePeriod}
          className={`${SELECT_CLS} min-w-[90px]`}
          aria-label="ص / م"
        >
          <option value="am">صباحًا</option>
          <option value="pm">مساءً</option>
        </select>
      </div>

      {/* Morning warning */}
      {isMorning && (
        <p className="text-amber-600 text-xs font-semibold flex items-center gap-1">
          ⚠️ الوقت المختار صباحًا، تأكد أن هذا هو المقصود
        </p>
      )}
    </div>
  );
}
