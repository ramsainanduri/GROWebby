import { HelpCircle } from "lucide-react";
import { InfoPopover } from "./InfoPopover";

interface SliderProps {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}

export function Slider({ label, help, value, min, max, step, suffix, onChange }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-1.5">
          {label} {help && <InfoPopover title={label} body={help} />}
        </div>
        <div className="text-slate-500">
          {value}
          {suffix}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="h-2 w-full appearance-none rounded-full bg-slate-200 accent-ocean-600 dark:bg-slate-700 dark:accent-ocean-500" />
    </div>
  );
}

export function SelectField({ label, help, value, options, onChange }: { label: string; help?: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="mb-4">
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        {label} {help && <InfoPopover title={label} body={help} />}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800">
        {options.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NumberField({ label, help, value, min, step, onChange }: { label: string; help?: string; value: number; min: number; step: number; onChange: (value: number) => void }) {
  return (
    <div className="mb-4">
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        {label} {help && <InfoPopover title={label} body={help} />}
      </label>
      <input type="number" min={min} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800" />
    </div>
  );
}

export function ToggleField({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex items-center gap-3 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <div className="relative">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
        <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-ocean-600 dark:bg-slate-700 dark:peer-checked:bg-ocean-500"></div>
        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}
