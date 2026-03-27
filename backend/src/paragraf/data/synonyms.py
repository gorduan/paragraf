"""Kuratiertes juristisches Synonym-Woerterbuch fuer Query Expansion.

Enthaelt handgepflegte Synonyme und Abkuerzungen aus dem deutschen Recht,
insbesondere aus Behinderten-, Arbeits-, Sozial- und Steuerrecht.
"""

from __future__ import annotations

LEGAL_SYNONYMS: dict[str, list[str]] = {
    # ── Behindertenrecht ──────────────────────────────────────────────────
    "gdb": ["Grad der Behinderung"],
    "grad der behinderung": ["GdB", "Schwerbehinderung"],
    "schwerbehindertenausweis": ["SBA", "Ausweis", "Schwerbehinderung"],
    "merkzeichen": ["Nachteilsausgleich", "Schwerbehindertenausweis"],
    "merkzeichen g": ["Gehbehinderung", "erhebliche Gehbehinderung"],
    "merkzeichen ag": ["aussergewoehnliche Gehbehinderung", "Parkerleichterung"],
    "merkzeichen h": ["Hilflosigkeit", "hilflos"],
    "merkzeichen bl": ["Blindheit", "blind"],
    "eingliederungshilfe": ["Teilhabe", "Rehabilitation"],
    # ── Arbeitsrecht ──────────────────────────────────────────────────────
    "kuendigung": ["Entlassung", "Kuendigungsschutz", "Beendigung"],
    "abfindung": ["Entlassung", "Kuendigung", "Aufhebungsvertrag"],
    "mutterschutz": ["Schwangerschaft", "MuSchG"],
    "elternzeit": ["BEEG", "Elterngeld"],
    # ── Sozialrecht ───────────────────────────────────────────────────────
    "buergergeld": ["Arbeitslosengeld II", "ALG II", "Hartz IV", "SGB II"],
    "hartz iv": ["Buergergeld", "SGB II", "Grundsicherung"],
    "grundsicherung": ["Buergergeld", "Sozialhilfe", "SGB XII"],
    "pflegegeld": ["Pflegeversicherung", "SGB XI"],
    "pflegegrad": ["Pflegebeduerftigkeit", "SGB XI"],
    "rente": ["Rentenversicherung", "SGB VI", "Altersrente"],
    "erwerbsminderung": ["Erwerbsminderungsrente", "SGB VI"],
    # ── Steuerrecht ───────────────────────────────────────────────────────
    "behindertenpauschbetrag": ["Pauschbetrag", "EStG", "Steuerermaessigung"],
    "steuerermaessigung": ["Freibetrag", "Pauschbetrag"],
}
