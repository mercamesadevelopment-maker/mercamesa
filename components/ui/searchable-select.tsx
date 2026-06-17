import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  emoji?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  label?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  required = false,
  className = '',
  label,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value));
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.group || '').toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  // Group options if any options have groups
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];

    filteredOptions.forEach((opt) => {
      if (opt.group) {
        if (!groups[opt.group]) {
          groups[opt.group] = [];
        }
        groups[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    });

    return { groups, ungrouped };
  }, [filteredOptions]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="text-sm font-medium text-mm-txs ml-1">
          {label} {required && <span className="text-r">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-mm-crd bg-white text-sm focus:border-mm-g focus:ring-2 focus:ring-mm-g/10 outline-none transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[42px]"
        >
          <span className={selectedOption ? 'text-mm-g font-semibold' : 'text-mm-txw'}>
            {selectedOption ? (
              <span className="flex items-center gap-2">
                {selectedOption.emoji && <span>{selectedOption.emoji}</span>}
                {selectedOption.label}
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-mm-txw transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1.5 bg-white border border-mm-crd rounded-2xl shadow-xl max-h-72 overflow-hidden flex flex-col animate-fade-in">
            {/* Search Input bar */}
            <div className="p-2 border-b border-mm-crd flex items-center gap-2 bg-mm-gbg/10">
              <Search className="w-4 h-4 text-mm-txw shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-transparent border-none text-sm text-mm-g outline-none placeholder:text-mm-txw py-1"
              />
            </div>

            {/* Options List */}
            <div className="overflow-y-auto max-h-56 divide-y divide-mm-crd/30">
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-xs text-mm-txw font-medium">
                  No se encontraron resultados.
                </div>
              ) : (
                <>
                  {/* Ungrouped options */}
                  {groupedOptions.ungrouped.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all hover:bg-mm-gbg/30 text-left ${
                        String(value) === String(opt.value)
                          ? 'text-mm-g font-bold bg-mm-gbg/20'
                          : 'text-mm-g'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {opt.emoji && <span>{opt.emoji}</span>}
                        {opt.label}
                      </span>
                      {String(value) === String(opt.value) && (
                        <Check className="w-4 h-4 text-mm-g" />
                      )}
                    </button>
                  ))}

                  {/* Grouped options */}
                  {Object.entries(groupedOptions.groups).map(([groupName, opts]) => (
                    <div key={groupName} className="flex flex-col">
                      <div className="px-4 py-1.5 bg-mm-gbg/25 text-[10px] font-bold uppercase tracking-wider text-mm-txw border-y border-mm-crd/25">
                        {groupName}
                      </div>
                      {opts.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelect(opt.value)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all hover:bg-mm-gbg/30 text-left ${
                            String(value) === String(opt.value)
                              ? 'text-mm-g font-bold bg-mm-gbg/20'
                              : 'text-mm-g'
                          }`}
                        >
                          <span className="flex items-center gap-2 pl-2">
                            {opt.emoji && <span>{opt.emoji}</span>}
                            {opt.label}
                          </span>
                          {String(value) === String(opt.value) && (
                            <Check className="w-4 h-4 text-mm-g" />
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
