import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';

// Generate all times in 15-minute steps: 00:00 → 23:45
function generateTimes() {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
}

const ALL_TIMES = generateTimes();

export default function TimePickerInput({ value, onChange, placeholder = 'HH:MM', id }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const listRef      = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Scroll selected item into view when dropdown opens
  useEffect(() => {
    if (open && listRef.current && value) {
      const el = listRef.current.querySelector('[data-selected="true"]');
      if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [open, value]);

  const filtered = search
    ? ALL_TIMES.filter((t) => t.startsWith(search))
    : ALL_TIMES;

  const handleManualChange = (e) => {
    onChange(e.target.value);
  };

  const handleSelect = (time) => {
    onChange(time);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input row */}
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#8B0000] focus-within:border-[#8B0000] transition-shadow bg-white">
        <Clock className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
        <input
          id={id}
          type="text"
          value={value}
          onChange={handleManualChange}
          placeholder={placeholder}
          maxLength={5}
          dir="ltr"
          className="flex-1 py-3 pr-2 pl-2 outline-none text-gray-900 font-mono text-base bg-transparent w-full"
        />
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setSearch(''); }}
          className="px-3 py-3 border-r border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-[#8B0000] transition-colors flex-shrink-0"
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Quick search inside dropdown */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث... مثال: 09"
              dir="ltr"
              className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#8B0000] font-mono"
              autoFocus
            />
          </div>

          <ul
            ref={listRef}
            className="max-h-52 overflow-y-auto py-1"
          >
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-center text-gray-400 text-sm">لا توجد نتائج</li>
            )}
            {filtered.map((time) => {
              const isSelected = time === value;
              return (
                <li
                  key={time}
                  data-selected={isSelected}
                  onClick={() => handleSelect(time)}
                  className={`px-4 py-2 cursor-pointer text-sm font-mono flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#8B0000] text-white font-bold'
                      : 'text-gray-700 hover:bg-red-50 hover:text-[#8B0000]'
                  }`}
                >
                  {time}
                  {isSelected && <span className="text-white text-xs">✓</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
