/**
 * Internationalization (i18n) Engine for SolarRoofFit
 * Supported Languages: English ('en') and German ('de')
 */

export const TRANSLATIONS = {
  en: {
    // Document
    docTitle: "SolarRoofFit — Solar PV Flat Roof Planner & Simulator",
    docDesc: "SolarRoofFit: Interactive solar PV flat roof planning simulator. Customize roof dimensions, module sizes, rotate panels, auto-fill optimal layouts, and snap to raster grids.",

    // Brand
    brandSubtitle: "Flat Roof Photovoltaic Array Simulator",

    // Metrics HUD
    metricModules: "Modules",
    metricPower: "Power",
    metricCoverage: "Coverage",
    metricDensity: "Density",
    statusOptimal: "Optimal",
    statusWarning: "Warning",
    statusWarnings: "Warnings",
    statusOptimalTitle: "All modules within safe setback without collisions",

    // Header Exports
    exportSVG: "SVG",
    exportSVGTitle: "Export Vector SVG Blueprint",
    exportPNG: "PNG",
    exportPNGTitle: "Export High-Resolution PNG Image",
    exportBOM: "BOM (CSV)",
    exportBOMTitle: "Export Bill of Materials (CSV)",

    // Sidebar: Roof Dimensions
    panelRoofDimensions: "Roof Dimensions",
    labelRoofWidth: "Width (X-Axis)",
    labelRoofLength: "Length (Y-Axis)",
    labelSetback: "Perimeter Setback",
    setbackLinked: "Linked",
    setbackUnlinked: "Individual",
    setbackLinkedTitle: "Unlink to configure each side independently",
    setbackUnlinkedTitle: "Link all 4 sides uniformly",
    dirNorth: "Top (North)",
    dirSouth: "Bottom (South)",
    dirWest: "Left (West)",
    dirEast: "Right (East)",

    // Sidebar: PV Module Specs
    panelModuleSpecs: "PV Module Specifications",
    labelModulePreset: "Module Model Preset",
    labelModWidth: "Width",
    labelModHeight: "Length",
    labelModPower: "Peak Power",
    labelClampGap: "Clamp Gap",

    // Sidebar: Maintenance Walkways
    panelWalkways: "Maintenance Walkways",
    toggleWalkwayTitle: "Toggle maintenance walk space corridors",
    labelWalkwayWidth: "Walkway Corridor Width",
    labelWalkwayInterval: "Walkway Insertion Frequency",
    labelWalkwayDirection: "Walkway Corridor Direction",
    dirHorizontal: "Horizontal",
    dirVertical: "Vertical",
    dirCrossGrid: "Cross Grid",

    // Sidebar: Raster Grid & Snapping
    panelRasterGrid: "Raster Grid & Snapping",
    labelSnapPanels: "Snap to Neighbor Panels",
    sublabelSnapPanels: "Magnetic clamp gap & edge alignment",
    labelSnapGrid: "Snap Modules to Grid",
    sublabelSnapGrid: "Fallback background raster",
    hintAltDrag: "💡 Hold Alt while dragging to freely bypass snapping",
    labelGridStep: "Raster Step Resolution",
    labelShowGrid: "Show Grid Overlay Lines",

    // Canvas Toolbar
    btnAddModule: "Add Module",
    btnAddModuleTitle: "Add a single PV module onto roof",
    btnDrawWalkway: "Draw Walkway",
    btnDrawWalkwayTitle: "Draw custom maintenance walkway (snaps to module rows & roof)",
    hintDrawWalkway: "Walkway Tool: Click & drag along module rows or across roof. Snaps magnetically. Esc to cancel.",
    toastWalkwayCreated: "Custom walkway corridor added",
    toastWalkwayDeleted: "Custom walkway removed",
    historyAddWalkway: "Add custom walkway",
    historyDeleteWalkway: "Delete custom walkway",
    historyMoveWalkway: "Move custom walkway",
    customWalkwaysTitle: "Custom Walkways",
    clearCustomWalkways: "Clear Walkways",
    noCustomWalkways: "No custom walkways placed yet",
    hintDrawWalkwayBar: "Draw Walkway Active — Click & drag on roof to place corridor (Esc to exit)",
    drawWalkwayBadge: "Draw Walkway",
    editWalkwayWidthTitle: "Edit Walkway Width",
    historyChangeWalkwayWidth: "Change walkway width to {width}m",
    toastWalkwayWidthChanged: "Walkway width set to {width}m",
    btnAutoMixed: "Auto (Mixed)",
    btnAutoSame: "Auto (Same)",
    autoMixedTitle: "Calculate best layout with mixed horizontal & vertical panels for max output",
    autoSameTitle: "Calculate best layout with all panels in the same alignment (uniform rails)",
    autoDropdownTitle: "Choose Auto Alignment: Mixed vs Same",
    autoDropdownHeader: "Auto Alignment Strategy",
    strategyMixedTitle: "Mixed Alignment",
    strategyMixedBadge: "Max Yield",
    strategyMixedDesc: "Mix horizontal & vertical panels to squeeze maximum kWp into residual roof areas",
    strategySameTitle: "Same Alignment",
    strategySameBadge: "Uniform Rails",
    strategySameDesc: "All panels face the same direction (chooses best pure portrait vs landscape)",
    btnPortrait: "Portrait",
    btnPortraitTitle: "Fill roof with portrait-aligned modules",
    btnLandscape: "Landscape",
    btnLandscapeTitle: "Fill roof with landscape-aligned modules",
    btnRotate: "Rotate (R)",
    btnRotateTitle: "Rotate Selected Module 90° (Hotkey: R)",
    btnDuplicate: "Duplicate",
    btnDuplicateTitle: "Duplicate Selected (Ctrl+D)",
    btnDelete: "Delete",
    btnDeleteTitle: "Delete Selected (Del/Backspace)",
    btnUndoTitle: "Undo (Ctrl+Z)",
    btnRedoTitle: "Redo (Ctrl+Y)",
    btnClear: "Clear",
    btnClearTitle: "Clear all modules",
    btnResetDefault: "Reset",
    btnResetDefaultTitle: "Reset all settings & layout to factory defaults",
    historyResetDefault: "Reset all to defaults",
    toastResetDefault: "Reset all settings to defaults",
    btnApply: "Apply",
    btnCancel: "Cancel",

    // Bottom Quick Hints
    hintMove: "Move Module",
    hintRotate: "Rotate 90°",
    hintDelete: "Delete",
    hintFree: "Free (No Snap)",
    hintMulti: "Multi-select",
    hintZoom: "Zoom & Pan",

    // Preset Options
    intervalOpt1: "Every 1 Row (Frequent)",
    intervalOpt2: "Every 2 Rows (Standard)",
    intervalOpt3: "Every 3 Rows",
    intervalOpt4: "Every 4 Rows (High Density)",

    // Module presets names
    modStandard: "Standard Residential (430 Wp)",
    modHighPower: "High Efficiency N-Type (450 Wp)",
    modCommercial: "Commercial Heavy (550 Wp)",
    modCompact: "Compact / Balcony (380 Wp)",
    modCustom: "Custom Module",

    // Toasts & Messages
    toastAddedModule: "Added 1 PV module",
    toastSelectedAll: "Selected all {n} modules",
    toastRotated: "Rotated {n} module(s) 90°",
    toastDuplicated: "Duplicated {n} module(s)",
    toastDeleted: "Deleted {n} module(s)",
    toastCleared: "Cleared all modules",
    toastAutoFilled: "Auto-filled {count} modules ({summary})",
    toastExportSVG: "Exported SVG layout blueprint",
    toastExportPNG: "Exported high-resolution PNG image",
    toastExportBOM: "Exported Bill of Materials (CSV)",
    toastSelectedModule: "Selected module: {name}",

    // History Actions
    historyInitial: "Initial State",
    historyAddModule: "Add module",
    historyDelete: "Delete module(s)",
    historyRotate: "Rotate module(s)",
    historyDuplicate: "Duplicate module(s)",
    historyDimensions: "Change roof dimensions",
    historyClear: "Clear roof",
    historyAutoFill: "Auto-fill: {summary}",
    historyMove: "Move module(s)",

    // Blueprint / Document Export Headers
    exportCADTitle: "SolarRoofFit CAD",
    exportFlatRoof: "Flat Roof",
    exportBOMHeader: "SOLARROOFFIT - SOLAR PV BILL OF MATERIALS & SYSTEM SPECIFICATION"
  },

  de: {
    // Document
    docTitle: "SolarRoofFit — Flachdach Photovoltaik Planer & Simulator",
    docDesc: "SolarRoofFit: Interaktiver CAD-Simulator zur PV-Flachdachbelegung. Dachmaße anpassen, Module drehen, automatische Belegungsoptimierung und präzises Einrasten.",

    // Brand
    brandSubtitle: "Flachdach-Photovoltaik Planer & Simulator",

    // Metrics HUD
    metricModules: "Module",
    metricPower: "Leistung",
    metricCoverage: "Belegung",
    metricDensity: "Dichte",
    statusOptimal: "Optimal",
    statusWarning: "Warnung",
    statusWarnings: "Warnungen",
    statusOptimalTitle: "Alle Module innerhalb des Sicherheitsbereichs ohne Kollisionen",

    // Header Exports
    exportSVG: "SVG",
    exportSVGTitle: "Vektor-SVG Bauplan exportieren",
    exportPNG: "PNG",
    exportPNGTitle: "Hochauflösendes PNG-Bild exportieren",
    exportBOM: "Stückliste",
    exportBOMTitle: "Stückliste als CSV-Tabelle exportieren",

    // Sidebar: Roof Dimensions
    panelRoofDimensions: "Dachabmessungen",
    labelRoofWidth: "Breite (X-Achse)",
    labelRoofLength: "Länge (Y-Achse)",
    labelSetback: "Randabstand",
    setbackLinked: "Gekoppelt",
    setbackUnlinked: "Individuell",
    setbackLinkedTitle: "Trennen, um jede Dachkante unabhängig einzustellen",
    setbackUnlinkedTitle: "Alle 4 Seiten einheitlich koppeln",
    dirNorth: "Oben (Nord)",
    dirSouth: "Unten (Süd)",
    dirWest: "Links (West)",
    dirEast: "Rechts (Ost)",

    // Sidebar: PV Module Specs
    panelModuleSpecs: "PV-Modul Spezifikationen",
    labelModulePreset: "Modul-Voreinstellung",
    labelModWidth: "Breite",
    labelModHeight: "Länge",
    labelModPower: "Nennleistung",
    labelClampGap: "Klemmenabstand",

    // Sidebar: Maintenance Walkways
    panelWalkways: "Wartungsgänge",
    toggleWalkwayTitle: "Wartungskorridore aktivieren/deaktivieren",
    labelWalkwayWidth: "Korridorbreite",
    labelWalkwayInterval: "Einfüge-Häufigkeit",
    labelWalkwayDirection: "Laufrichtung Korridor",
    dirHorizontal: "Horizontal",
    dirVertical: "Vertikal",
    dirCrossGrid: "Kreuzgitter",

    // Sidebar: Raster Grid & Snapping
    panelRasterGrid: "Raster & Fangfunktion",
    labelSnapPanels: "An Nachbarmodulen fangen",
    sublabelSnapPanels: "Magnetischer Klemmenabstand & Bündigkeit",
    labelSnapGrid: "Am Raster einrasten",
    sublabelSnapGrid: "Hintergrund-Rasterteilung",
    hintAltDrag: "💡 Alt gedrückt halten zum freien Verschieben ohne Einrasten",
    labelGridStep: "Raster-Schrittweite",
    labelShowGrid: "Rasterlinien einblenden",

    // Canvas Toolbar
    btnAddModule: "Modul hinzufügen",
    btnAddModuleTitle: "Ein einzelnes PV-Modul auf dem Dach platzieren",
    btnDrawWalkway: "Gang zeichnen",
    btnDrawWalkwayTitle: "Benutzerdefinierten Wartungsgang einzeichnen (rastet an Modulreihen & Dach ein)",
    hintDrawWalkway: "Gang-Werkzeug: Entlang Modulreihen ziehen. Rastet magnetisch ein. Esc zum Beenden.",
    toastWalkwayCreated: "Wartungskorridor hinzugefügt",
    toastWalkwayDeleted: "Wartungsgang entfernt",
    historyAddWalkway: "Wartungsgang hinzugefügt",
    historyDeleteWalkway: "Wartungsgang gelöscht",
    historyMoveWalkway: "Wartungsgang verschoben",
    customWalkwaysTitle: "Eigene Wartungsgänge",
    clearCustomWalkways: "Eigene Gänge löschen",
    noCustomWalkways: "Noch keine eigenen Wartungsgänge platziert",
    hintDrawWalkwayBar: "Wartungsgang-Zeichenmodus aktiv — Klicken & ziehen auf dem Dach (Esc zum Beenden)",
    drawWalkwayBadge: "Gang zeichnen",
    editWalkwayWidthTitle: "Wartungsgang-Breite anpassen",
    historyChangeWalkwayWidth: "Wartungsgang-Breite auf {width}m geändert",
    toastWalkwayWidthChanged: "Wartungsgang-Breite auf {width}m gesetzt",
    btnAutoMixed: "Auto (Gemischt)",
    btnAutoSame: "Auto (Gleich)",
    autoMixedTitle: "Maximale kWp durch gemischte Quer- und Hochkant-Belegung berechnen",
    autoSameTitle: "Beste Belegung berechnen, bei der alle Module in die gleiche Richtung zeigen",
    autoDropdownTitle: "Belegungsstrategie wählen: Gemischt vs. Einheitlich",
    autoDropdownHeader: "Automatische Belegungsstrategie",
    strategyMixedTitle: "Gemischte Ausrichtung",
    strategyMixedBadge: "Max. Ertrag",
    strategyMixedDesc: "Kombiniert Quer- und Hochkantmodule, um maximale kWp auf Restflächen herauszuholen",
    strategySameTitle: "Einheitliche Ausrichtung",
    strategySameBadge: "Gleiche Schienen",
    strategySameDesc: "Alle Module in gleicher Richtung (wählt die beste reine Quer- oder Hochkantbelegung)",
    btnPortrait: "Hochkant",
    btnPortraitTitle: "Dach mit hochkant ausgerichteten Modulen belegen",
    btnLandscape: "Quer",
    btnLandscapeTitle: "Dach mit quer ausgerichteten Modulen belegen",
    btnRotate: "Drehen (R)",
    btnRotateTitle: "Ausgewähltes Modul um 90° drehen (Taste: R)",
    btnDuplicate: "Duplizieren",
    btnDuplicateTitle: "Ausgewählte Module duplizieren (Strg+D)",
    btnDelete: "Löschen",
    btnDeleteTitle: "Ausgewählte Module löschen (Entf/Rücktaste)",
    btnUndoTitle: "Rückgängig (Strg+Z)",
    btnRedoTitle: "Wiederholen (Strg+Y)",
    btnClear: "Leeren",
    btnClearTitle: "Alle Module vom Dach entfernen",
    btnResetDefault: "Zurücksetzen",
    btnResetDefaultTitle: "Alle Einstellungen und Belegung auf Standard zurücksetzen",
    historyResetDefault: "Alles auf Standard zurückgesetzt",
    toastResetDefault: "Alle Einstellungen auf Standard zurückgesetzt",
    btnApply: "Übernehmen",
    btnCancel: "Abbrechen",

    // Bottom Quick Hints
    hintMove: "Modul bewegen",
    hintRotate: "90° drehen",
    hintDelete: "Löschen",
    hintFree: "Frei (ohne Fang)",
    hintMulti: "Mehrfachauswahl",
    hintZoom: "Zoom & Verschieben",

    // Preset Options
    intervalOpt1: "Jede 1 Reihe (Häufig)",
    intervalOpt2: "Alle 2 Reihen (Standard)",
    intervalOpt3: "Alle 3 Reihen",
    intervalOpt4: "Alle 4 Reihen (Kompakt)",

    // Module presets names
    modStandard: "Standard Wohngebäude (430 Wp)",
    modHighPower: "Hocheffizient N-Type (450 Wp)",
    modCommercial: "Gewerbemodul (550 Wp)",
    modCompact: "Kompakt / Balkon (380 Wp)",
    modCustom: "Benutzerdefiniertes Modul",

    // Toasts & Messages
    toastAddedModule: "1 PV-Modul hinzugefügt",
    toastSelectedAll: "Alle {n} Module ausgewählt",
    toastRotated: "{n} Modul(e) um 90° gedreht",
    toastDuplicated: "{n} Modul(e) dupliziert",
    toastDeleted: "{n} Modul(e) gelöscht",
    toastCleared: "Alle Module vom Dach entfernt",
    toastAutoFilled: "{count} Module automatisch belegt ({summary})",
    toastExportSVG: "SVG-Bauplan exportiert",
    toastExportPNG: "Hochauflösendes PNG-Bild exportiert",
    toastExportBOM: "Stückliste (CSV) exportiert",
    toastSelectedModule: "Modul gewählt: {name}",

    // History Actions
    historyInitial: "Ausgangszustand",
    historyAddModule: "Modul hinzufügen",
    historyDelete: "Modul(e) löschen",
    historyRotate: "Modul(e) drehen",
    historyDuplicate: "Modul(e) duplizieren",
    historyDimensions: "Dachmaße ändern",
    historyClear: "Dach leeren",
    historyAutoFill: "Auto-Belegung: {summary}",
    historyMove: "Modul(e) verschieben",

    // Blueprint / Document Export Headers
    exportCADTitle: "SolarRoofFit CAD",
    exportFlatRoof: "Flachdach",
    exportBOMHeader: "SOLARROOFFIT - SOLAR PV STÜCKLISTE & SYSTEMSPEZIFIKATION"
  }
};

/**
 * Returns translation function for a specified language ('en' | 'de').
 */
export function translate(lang, key, params = {}) {
  const currentLang = (lang === 'de' || lang === 'en') ? lang : 'en';
  let text = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['en']?.[key] || key;

  // Simple string interpolation for {param}
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}
