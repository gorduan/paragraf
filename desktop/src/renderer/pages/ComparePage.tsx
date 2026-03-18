import React, { useState } from "react";
import { api, type CompareItem } from "../lib/api";
import { Disclaimer } from "../components/Disclaimer";
import { Loader, Plus, X } from "lucide-react";

export function ComparePage() {
  const [refs, setRefs] = useState<string[]>(["", ""]);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRef = () => {
    if (refs.length < 5) setRefs([...refs, ""]);
  };

  const removeRef = (index: number) => {
    if (refs.length > 2) setRefs(refs.filter((_, i) => i !== index));
  };

  const updateRef = (index: number, value: string) => {
    const newRefs = [...refs];
    newRefs[index] = value;
    setRefs(newRefs);
  };

  const handleCompare = async () => {
    const valid = refs.filter((r) => r.trim());
    if (valid.length < 2) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.compare({ paragraphen: valid });
      setItems(res.items);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Paragraphen vergleichen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Bis zu 5 Paragraphen nebeneinander vergleichen
        </p>
      </div>

      {/* Input */}
      <div className="space-y-2 mb-4">
        {refs.map((ref, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={ref}
              onChange={(e) => updateRef(i, e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompare()}
              placeholder={`z.B. § ${36 + i} SGB XI`}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {refs.length > 2 && (
              <button
                onClick={() => removeRef(i)}
                className="p-2 text-slate-400 hover:text-red-500"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {refs.length < 5 && (
          <button
            onClick={addRef}
            className="flex items-center gap-1 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Plus size={14} />
            Hinzufügen
          </button>
        )}
        <button
          onClick={handleCompare}
          disabled={refs.filter((r) => r.trim()).length < 2}
          className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Vergleichen
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin text-primary-500" size={24} />
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Comparison Grid */}
      {!loading && items.length > 0 && (
        <div className="mt-6">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
            }}
          >
            {items.map((item, i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="font-semibold text-sm">
                    {item.found
                      ? `${item.paragraph} ${item.gesetz}`
                      : item.referenz}
                  </h3>
                  {item.found && item.titel && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.titel}
                    </p>
                  )}
                </div>
                <div className="p-4 max-h-96 overflow-auto">
                  {item.found ? (
                    <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {item.text}
                    </pre>
                  ) : (
                    <p className="text-sm text-red-500 italic">
                      Nicht gefunden
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Disclaimer />
        </div>
      )}
    </div>
  );
}
