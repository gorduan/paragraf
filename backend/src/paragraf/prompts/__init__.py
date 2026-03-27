"""MCP Prompts – Vordefinierte Prompt-Templates fuer haeufige Anfragen."""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP


def register_prompts(mcp: FastMCP) -> None:
    """Registriert vordefinierte Prompt-Templates am MCP-Server."""

    @mcp.prompt()
    def paragraf_legal_info(thema: str) -> str:
        """Allgemeine Rechtsauskunft zu einem rechtlichen Thema.

        Nutze dieses Prompt-Template fuer allgemeine Fragen zu deutschem Recht,
        Sozialrecht, Behindertenrecht, Sozialleistungen, Steuern und mehr.

        Args:
            thema: Das Thema, z.B. "Merkzeichen G", "Eingliederungshilfe",
                   "Grad der Behinderung", "Pflegegeld"
        """
        return (
            f"Erklaere die allgemeine Rechtslage zum Thema '{thema}' im deutschen Recht. "
            f"Verwende dafuer das Tool 'paragraf_search' mit der Anfrage '{thema}'. "
            f"Fasse die gefundenen Paragraphen verstaendlich zusammen. "
            f"Gib immer die genauen Paragraphen-Referenzen an (z.B. § 152 SGB IX). "
            f"Formuliere allgemein – keine Einzelfallberatung. "
            f"Weise am Ende auf EUTB-Beratungsstellen hin."
        )

    @mcp.prompt()
    def paragraf_easy_language(thema: str) -> str:
        """Erklaert ein rechtliches Thema in Leichter Sprache.

        Leichte Sprache folgt der DIN SPEC 33429:
        - Kurze Saetze (eine Aussage pro Satz)
        - Einfache Woerter, keine Fachbegriffe
        - Aktive Formulierungen
        - Medien-Trennstriche bei langen Woertern

        Args:
            thema: Das Thema in einfacher Formulierung
        """
        return (
            f"Erklaere das Thema '{thema}' in Leichter Sprache.\n\n"
            f"Verwende das Tool 'paragraf_search' um die rechtlichen Grundlagen zu finden.\n\n"
            f"Regeln fuer Leichte Sprache (DIN SPEC 33429):\n"
            f"- Schreibe kurze Saetze. Jeder Satz hat nur eine Aussage.\n"
            f"- Benutze einfache Woerter. Erklaere schwierige Woerter.\n"
            f"- Schreibe immer aktiv, nicht passiv.\n"
            f"- Trenne lange Woerter mit einem Medio·punkt: Schwer·behinderten·ausweis\n"
            f"- Verwende keine Abkuerzungen. Schreibe 'Sozial·gesetz·buch 9' statt 'SGB IX'.\n"
            f"- Nenne am Ende die Paragraphen-Nummern fuer die Fach·leute.\n"
            f"- Weise auf Beratungs·stellen hin (EUTB: 0800 11 10 111)."
        )

    @mcp.prompt()
    def paragraf_compensation(behinderungsart: str) -> str:
        """Findet Nachteilsausgleiche fuer eine bestimmte Behinderungsart.

        Args:
            behinderungsart: Art der Behinderung, z.B. "Gehbehinderung",
                           "Sehbehinderung", "Autismus", "chronische Erkrankung"
        """
        return (
            f"Finde alle Nachteilsausgleiche und Rechte fuer Menschen mit "
            f"'{behinderungsart}' im deutschen Recht.\n\n"
            f"Suche in folgenden Bereichen:\n"
            f"1. Suche 'Nachteilsausgleich {behinderungsart}' in SGB IX\n"
            f"2. Suche 'Merkzeichen' in SGB IX (fuer Schwerbehindertenausweis)\n"
            f"3. Suche '{behinderungsart}' in BGG (Gleichstellung)\n"
            f"4. Suche 'Eingliederungshilfe {behinderungsart}' in SGB IX\n\n"
            f"Strukturiere die Antwort nach:\n"
            f"- Feststellung der Behinderung (GdB)\n"
            f"- Merkzeichen und deren Vorteile\n"
            f"- Leistungen (Eingliederungshilfe, Hilfsmittel)\n"
            f"- Arbeitsrechtlicher Schutz\n"
            f"- Steuerliche Vorteile\n"
            f"- Mobilitaet und Verkehr\n\n"
            f"Gib immer die genauen Paragraphen-Referenzen an."
        )

    @mcp.prompt()
    def paragraf_benefits(leistung: str, situation: str = "") -> str:
        """Prueft Leistungsansprueche im deutschen Recht allgemein.

        Args:
            leistung: Art der Leistung, z.B. "Buergergeld", "Pflegegeld",
                     "Eingliederungshilfe", "Hilfsmittel"
            situation: Optionale Beschreibung der Lebensumstaende
        """
        return (
            f"Erklaere die allgemeinen Voraussetzungen fuer '{leistung}' "
            f"im deutschen Recht.\n\n"
            f"Verwende 'paragraf_search' fuer folgende Recherchen:\n"
            f"1. Suche '{leistung} Voraussetzungen'\n"
            f"2. Suche '{leistung} Antrag'\n"
            f"3. Suche '{leistung} Hoehe Umfang'\n\n"
            f"Strukturiere die Antwort:\n"
            f"- **Was ist {leistung}?** (Kurze Erklaerung)\n"
            f"- **Wer hat Anspruch?** (Allgemeine Voraussetzungen lt. Gesetz)\n"
            f"- **Wie beantragt man es?** (Zustaendige Stelle, Formular)\n"
            f"- **Wie viel/was wird geleistet?** (Umfang lt. Gesetz)\n"
            f"- **Welche Paragraphen sind relevant?**\n\n"
            f"WICHTIG: Nur allgemeine Informationen. Keine Einzelfallpruefung.\n"
            f"Verweise auf EUTB oder Rechtsberatung fuer individuelle Klaerung."
        )

    @mcp.prompt()
    def paragraf_legal_analysis(thema: str, gesetzbuch: str = "") -> str:
        """Umfassende Rechtsanalyse: Suche + Querverweise folgen + Zusammenfassung.

        Args:
            thema: Das Thema der Rechtsanalyse, z.B. "Eingliederungshilfe",
                   "Grad der Behinderung", "Pflegegeld"
            gesetzbuch: Optionaler Fokus auf ein bestimmtes Gesetzbuch, z.B. "SGB IX"
        """
        filter_hint = (
            f" Filtere die Suche nach '{gesetzbuch}'." if gesetzbuch else ""
        )
        return (
            f"Fuehre eine umfassende Rechtsanalyse zum Thema '{thema}' durch.\n\n"
            f"Gehe dabei in folgenden Schritten vor:\n"
            f"1. Suche mit 'paragraf_search' nach '{thema}'.{filter_hint}\n"
            f"2. Fuer die Top-3-Ergebnisse: Rufe 'paragraf_references' auf, "
            f"um Querverweise zu finden.\n"
            f"3. Schlage wichtige Querverweise mit 'paragraf_lookup' nach.\n"
            f"4. Fasse zusammen:\n"
            f"   - Hauptnormen zum Thema\n"
            f"   - Relevante Querverweise und deren Bedeutung\n"
            f"   - Widersprueche oder Ergaenzungen zwischen den Normen\n"
            f"5. Gib immer die exakten Paragraphen-Referenzen an.\n"
            f"6. Weise am Ende auf EUTB-Beratungsstellen hin "
            f"(www.teilhabeberatung.de, Tel: 0800 11 10 111)."
        )

    @mcp.prompt()
    def paragraf_norm_chain(start_paragraph: str, start_gesetz: str) -> str:
        """Verfolgt Kette von Querverweisen ab einem Startparagraphen.

        Args:
            start_paragraph: Der Startparagraph, z.B. "152"
            start_gesetz: Das Gesetzbuch, z.B. "SGB IX"
        """
        return (
            f"Verfolge die Kette von Querverweisen ab {start_paragraph} {start_gesetz}.\n\n"
            f"Gehe dabei in folgenden Schritten vor:\n"
            f"1. Schlage den Startparagraphen mit 'paragraf_lookup' nach: "
            f"{start_paragraph} in {start_gesetz}.\n"
            f"2. Rufe 'paragraf_references' fuer ausgehende Querverweise auf.\n"
            f"3. Fuer jeden wichtigen Querverweis:\n"
            f"   - Schlage ihn mit 'paragraf_lookup' nach\n"
            f"   - Rufe 'paragraf_references' fuer dessen Querverweise auf\n"
            f"   - Wiederhole bis zu 3 Ebenen tief\n"
            f"4. Baue eine Verweiskette, die zeigt, wie die Normen zusammenhaengen.\n"
            f"5. Fasse die rechtliche Kette und ihre Bedeutung zusammen.\n"
            f"6. Gib immer die exakten Paragraphen-Referenzen an."
        )

    @mcp.prompt()
    def paragraf_compare_areas(
        thema: str, rechtsgebiete: str = "SGB IX, SGB XII, SGB XI",
    ) -> str:
        """Vergleicht Regelungen zu einem Thema in verschiedenen Rechtsgebieten.

        Args:
            thema: Das Thema des Vergleichs, z.B. "Eingliederungshilfe",
                   "Pflegeleistungen", "Teilhabe"
            rechtsgebiete: Komma-getrennte Gesetzbuecher, z.B. "SGB IX, SGB XII, SGB XI"
        """
        gebiete_list = [g.strip() for g in rechtsgebiete.split(",")]
        steps = "\n".join(
            f"   - Suche mit 'paragraf_search' nach '{thema}' gefiltert auf '{g}'"
            for g in gebiete_list
        )
        return (
            f"Vergleiche die Regelungen zum Thema '{thema}' in den Rechtsgebieten "
            f"{rechtsgebiete}.\n\n"
            f"Gehe dabei in folgenden Schritten vor:\n"
            f"1. Fuer jedes Rechtsgebiet:\n{steps}\n"
            f"2. Vergleiche die gefundenen Regelungen:\n"
            f"   - Gemeinsamkeiten zwischen den Rechtsgebieten\n"
            f"   - Unterschiede in Voraussetzungen, Leistungsumfang, Zustaendigkeit\n"
            f"3. Pruefe Querverweise zwischen den Gebieten mit 'paragraf_references'.\n"
            f"4. Erstelle eine strukturierte Vergleichstabelle.\n"
            f"5. Gib immer die exakten Paragraphen-Referenzen an."
        )
