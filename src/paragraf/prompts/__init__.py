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
