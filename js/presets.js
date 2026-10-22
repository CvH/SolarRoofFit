/**
 * Solar PV Module and Roof Presets
 */

export const MODULE_PRESETS = {
  standard_430: {
    name: 'Standard Residential (430 Wp)',
    name_de: 'Standard Wohngebäude (430 Wp)',
    width: 1134,   // mm
    height: 1762,  // mm
    power: 430,    // Wp
    description: 'Most common 108-half-cell monocrystalline panel for home installations.',
    description_de: 'Gängigstes 108-Halbzellen monokristallines Modul für Privathäuser.'
  },
  highpower_450: {
    name: 'High Efficiency N-Type (450 Wp)',
    name_de: 'Hocheffizient N-Type (450 Wp)',
    width: 1134,
    height: 1762,
    power: 450,
    description: 'Top-tier N-type TOPCon module with superior low-light performance.',
    description_de: 'Hochleistungs-N-Type TOPCon-Modul mit exzellentem Schwachlichtverhalten.'
  },
  commercial_550: {
    name: 'Commercial Heavy (550 Wp)',
    name_de: 'Gewerbemodul (550 Wp)',
    width: 1134,
    height: 2278,
    power: 550,
    description: 'Large 144-cell module engineered for large commercial rooftops.',
    description_de: 'Großes 144-Zellen-Modul speziell für gewerbliche Hallendächer.'
  },
  compact_380: {
    name: 'Compact / Balcony (380 Wp)',
    name_de: 'Kompakt / Balkon (380 Wp)',
    width: 1038,
    height: 1690,
    power: 380,
    description: 'Slim lightweight format suited for restricted or complex roof areas.',
    description_de: 'Schlankes, leichtes Format für enge oder verwinkelte Dachflächen.'
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

