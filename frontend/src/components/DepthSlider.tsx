interface DepthSliderProps {
  value: number;
  onChange: (n: number) => void;
}

export function DepthSlider({ value, onChange }: DepthSliderProps) {
  return (
    <div className="flex items-center gap-2 h-8">
      <label className="text-sm text-neutral-600 dark:text-neutral-300 min-w-[100px]">
        Suchtiefe: {value}
      </label>
      <input
        type="range"
        min={1}
        max={3}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[120px] accent-primary-500"
        aria-label="Suchtiefe"
        aria-valuemin={1}
        aria-valuemax={3}
        aria-valuenow={value}
      />
    </div>
  );
}
