import React from "react";

export function Disclaimer() {
  return (
    <div className="mt-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-200">
      <strong>Hinweis:</strong> Dies ist eine allgemeine Rechtsinformation, keine
      Rechtsberatung im Sinne des Rechtsdienstleistungsgesetzes (RDG). Für eine
      individuelle Beratung wenden Sie sich bitte an eine Rechtsanwältin / einen
      Rechtsanwalt oder eine EUTB-Beratungsstelle (
      <span className="underline">www.teilhabeberatung.de</span>).
    </div>
  );
}
