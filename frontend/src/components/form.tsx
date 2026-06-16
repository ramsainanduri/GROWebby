import { HelpCircle } from "lucide-react";

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

export function Slider({
  label,
  help,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: SliderProps) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-1.5">
          {label}{" "}
          {help && (
            <span title={help} className="cursor-help">
              <HelpCircle
                size={14}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              />
            </span>
          )}
        </div>
        <div className="text-slate-500">
          {value}
          {suffix}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-2 w-full appearance-none rounded-full bg-slate-200 accent-ocean-600 dark:bg-slate-700 dark:accent-ocean-500"
      />
    </div>
  );
}

export function SelectField({
  label,
  help,
  value,
  options,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  options: { value: string; label: string }[] | string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        {label}{" "}
        {help && (
          <span title={help} className="cursor-help">
            <HelpCircle
              size={14}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            />
          </span>
        )}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
      >
        {options.map((opt) => {
          const isStr = typeof opt === "string";
          const val = isStr ? opt : opt.value;
          const lbl = isStr ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {lbl}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function NumberField({
  label,
  help,
  value,
  min,
  step,
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        {label}{" "}
        {help && (
          <span title={help} className="cursor-help">
            <HelpCircle
              size={14}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            />
          </span>
        )}
      </label>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
  );
}

export function ToggleField({
  label,
  help,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  help?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
        disabled
          ? "opacity-50"
          : "border-slate-200 bg-white hover:border-ocean-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-ocean-600 focus:ring-ocean-600 dark:border-slate-700 dark:bg-slate-800 dark:checked:bg-ocean-500"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {help && (
          <span className="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {help}
          </span>
        )}
      </span>
    </label>
  );
}

export function TextField({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        {label}{" "}
        {help && (
          <span title={help} className="cursor-help">
            <HelpCircle
              size={14}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            />
          </span>
        )}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800"
      />
    </div>
  );
}

export function TextAreaField({
  label,
  help,
  value,
  placeholder,
  onChange,
  onHelpClick,
}: {
  label: string;
  help?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onHelpClick?: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between text-sm font-medium">
        <span className="flex items-center gap-1.5">
          {label}{" "}
          {help && (
            <span title={help} className="cursor-help">
              <HelpCircle
                size={14}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              />
            </span>
          )}
        </span>
        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            title="View GROMACS options for this command"
            className="text-ocean-600 hover:text-ocean-700 text-xs flex items-center p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <HelpCircle size={16} />
          </button>
        )}
      </div>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:ring-1 focus:ring-ocean-500 dark:border-slate-700 dark:bg-slate-800 font-mono min-h-24"
      />
    </div>
  );
}
