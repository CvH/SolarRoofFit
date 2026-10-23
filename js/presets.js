/**
 * Solar PV Module and Roof Presets
 */

export const MODULE_PRESETS = {
  compact_380: {
    name: 'Compact / Balcony (380 Wp) — 1690 × 1038 mm',
    name_de: 'Kompakt / Balkon (380 Wp) — 1690 × 1038 mm',
    width: 1038,
    height: 1690,
    power: 380,
    description: 'Slim lightweight format suited for restricted or complex roof areas.',
    description_de: 'Schlankes, leichtes Format für enge oder verwinkelte Dachflächen.'
  },
  standard_430: {
    name: 'Standard Residential (430 Wp) — 1762 × 1134 mm',
    name_de: 'Standard Wohngebäude (430 Wp) — 1762 × 1134 mm',
    width: 1134,   // mm
    height: 1762,  // mm
    power: 430,    // Wp
    description: 'Most common 108-half-cell monocrystalline panel for home installations.',
    description_de: 'Gängigstes 108-Halbzellen monokristallines Modul für Privathäuser.'
  },
  highpower_450: {
    name: 'High Efficiency N-Type (450 Wp) — 1762 × 1134 mm',
    name_de: 'Hocheffizient N-Type (450 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 450,
    description: 'Top-tier N-type TOPCon module with superior low-light performance.',
    description_de: 'Hochleistungs-N-Type TOPCon-Modul mit exzellentem Schwachlichtverhalten.'
  },
  highpower_455: {
    name: 'High Efficiency N-Type (455 Wp) — 1762 × 1134 mm',
    name_de: 'Hocheffizient N-Type (455 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 455,
    description: 'Modern 108-cell TOPCon glass-glass module with 455 Wp peak power.',
    description_de: 'Modernes 108-Zellen TOPCon Glas-Glas-Modul mit 455 Wp Spitzenleistung.'
  },
  highpower_460: {
    name: 'High Efficiency N-Type (460 Wp) — 1762 × 1134 mm',
    name_de: 'Hocheffizient N-Type (460 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 460,
    description: 'High-density 108-cell monocrystalline module with 460 Wp peak power.',
    description_de: 'Hocheffizientes 108-Zellen Monokristallin-Modul mit 460 Wp Spitzenleistung.'
  },
  highpower_465: {
    name: 'High Efficiency N-Type (465 Wp) — 1762 × 1134 mm',
    name_de: 'Hocheffizient N-Type (465 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 465,
    description: 'Advanced TOPCon high-yield residential solar panel with 465 Wp.',
    description_de: 'Modernes TOPCon Hochleistungs-Wohngebäude-Modul mit 465 Wp.'
  },
  ultra_470: {
    name: 'Ultra High-Power (470 Wp) — 1762 × 1134 mm',
    name_de: 'Ultra Hochleistung (470 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 470,
    description: 'Maximum density 108-cell format module delivering 470 Wp.',
    description_de: 'Maximale Packungsdichte im kompakten 108-Zellen-Format mit 470 Wp.'
  },
  ultra_480: {
    name: 'Ultra High-Power (480 Wp) — 1762 × 1134 mm',
    name_de: 'Ultra Hochleistung (480 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 480,
    description: 'Next-gen high-yield residential module with 480 Wp peak rating.',
    description_de: 'Next-Gen Hochleistungsmodul mit 480 Wp Nennleistung.'
  },
  ultra_485: {
    name: 'Ultra High-Power (485 Wp) — 1762 × 1134 mm',
    name_de: 'Ultra Hochleistung (485 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 485,
    description: 'Peak-tier 108-cell residential / commercial solar module with 485 Wp.',
    description_de: 'Spitzenklasse 108-Zellen Solarmodul mit 485 Wp.'
  },
  ultra_490: {
    name: 'Ultra High-Power (490 Wp) — 1762 × 1134 mm',
    name_de: 'Ultra Hochleistung (490 Wp) — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 490,
    description: 'Ultimate power output in the standard 1762 × 1134 mm footprint.',
    description_de: 'Maximale Spitzenleistung im Standardformat 1762 × 1134 mm mit 490 Wp.'
  },
  large_500: {
    name: 'Large Format Commercial (500 Wp) — 1953 × 1134 mm',
    name_de: 'Großformat Gewerbe (500 Wp) — 1953 × 1134 mm',
    width: 1134,
    height: 1953,
    power: 500,
    description: '1953 mm commercial format panel providing 500 Wp for large roofs.',
    description_de: '1953 mm Großformat-Gewerbemodul mit 500 Wp für Flachdächer.'
  },
  large_540: {
    name: 'Large Format Commercial (540 Wp) — 1954 × 1134 mm',
    name_de: 'Großformat Gewerbe (540 Wp) — 1954 × 1134 mm',
    width: 1134,
    height: 1954,
    power: 540,
    description: 'High-power 1954 mm commercial module delivering 540 Wp.',
    description_de: 'Leistungsstarkes 1954 mm Gewerbemodul mit 540 Wp Spitzenleistung.'
  },
  commercial_550: {
    name: 'Commercial Heavy (550 Wp) — 2278 × 1134 mm',
    name_de: 'Gewerbemodul Heavy (550 Wp) — 2278 × 1134 mm',
    width: 1134,
    height: 2278,
    power: 550,
    description: 'Large 144-cell module engineered for large commercial rooftops.',
    description_de: 'Großes 144-Zellen-Modul speziell für gewerbliche Hallendächer.'
  },
  custom: {
    name: 'Custom Module',
    name_de: 'Benutzerdefiniertes Modul',
    width: 1134,
    height: 1762,
    power: 430,
    description: 'Manually specified module dimensions and peak power.',
    description_de: 'Manuell eingegebene Modulabmessungen und Leistung.'
  }
};

export const RASTER_OPTIONS = [
  { label: '5 cm (0.05m)', value: 0.05 },
  { label: '10 cm (0.10m)', value: 0.10 },
  { label: '25 cm (0.25m)', value: 0.25 },
  { label: '50 cm (0.50m)', value: 0.50 },
  { label: '100 cm (1.00m)', value: 1.00 }
];

export const WALKWAY_INTERVAL_OPTIONS = [
  { label: 'Every 1 Row (Frequent)', label_de: 'Jede 1 Reihe (Häufig)', value: 1 },
  { label: 'Every 2 Rows (Standard)', label_de: 'Alle 2 Reihen (Standard)', value: 2 },
  { label: 'Every 3 Rows', label_de: 'Alle 3 Reihen', value: 3 },
  { label: 'Every 4 Rows (High Density)', label_de: 'Alle 4 Reihen (Kompakt)', value: 4 }
];

