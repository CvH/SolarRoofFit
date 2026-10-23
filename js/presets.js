/**
 * Solar PV Module and Roof Presets
 */

export const MODULE_PRESETS = {
  compact_380: {
    name: '380W — 1690 × 1038 mm',
    name_de: '380W — 1690 × 1038 mm',
    width: 1038,
    height: 1690,
    power: 380,
    description: 'Compact 380W panel (1690 × 1038 mm).',
    description_de: 'Kompaktes 380W Modul (1690 × 1038 mm).'
  },
  standard_430: {
    name: '430W — 1762 × 1134 mm',
    name_de: '430W — 1762 × 1134 mm',
    width: 1134,   // mm
    height: 1762,  // mm
    power: 430,    // Wp
    description: 'Standard 430W panel (1762 × 1134 mm).',
    description_de: 'Standard 430W Modul (1762 × 1134 mm).'
  },
  highpower_450: {
    name: '450W — 1762 × 1134 mm',
    name_de: '450W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 450,
    description: 'High efficiency 450W panel (1762 × 1134 mm).',
    description_de: 'Hocheffizientes 450W Modul (1762 × 1134 mm).'
  },
  highpower_455: {
    name: '455W — 1762 × 1134 mm',
    name_de: '455W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 455,
    description: 'High efficiency 455W panel (1762 × 1134 mm).',
    description_de: 'Hocheffizientes 455W Modul (1762 × 1134 mm).'
  },
  highpower_460: {
    name: '460W — 1762 × 1134 mm',
    name_de: '460W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 460,
    description: 'High efficiency 460W panel (1762 × 1134 mm).',
    description_de: 'Hocheffizientes 460W Modul (1762 × 1134 mm).'
  },
  highpower_465: {
    name: '465W — 1762 × 1134 mm',
    name_de: '465W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 465,
    description: 'High efficiency 465W panel (1762 × 1134 mm).',
    description_de: 'Hocheffizientes 465W Modul (1762 × 1134 mm).'
  },
  ultra_470: {
    name: '470W — 1762 × 1134 mm',
    name_de: '470W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 470,
    description: 'High power 470W panel (1762 × 1134 mm).',
    description_de: 'Hochleistungs-470W Modul (1762 × 1134 mm).'
  },
  ultra_480: {
    name: '480W — 1762 × 1134 mm',
    name_de: '480W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 480,
    description: 'High power 480W panel (1762 × 1134 mm).',
    description_de: 'Hochleistungs-480W Modul (1762 × 1134 mm).'
  },
  ultra_485: {
    name: '485W — 1762 × 1134 mm',
    name_de: '485W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 485,
    description: 'High power 485W panel (1762 × 1134 mm).',
    description_de: 'Hochleistungs-485W Modul (1762 × 1134 mm).'
  },
  ultra_490: {
    name: '490W — 1762 × 1134 mm',
    name_de: '490W — 1762 × 1134 mm',
    width: 1134,
    height: 1762,
    power: 490,
    description: 'High power 490W panel (1762 × 1134 mm).',
    description_de: 'Hochleistungs-490W Modul (1762 × 1134 mm).'
  },
  large_500: {
    name: '500W — 1953 × 1134 mm',
    name_de: '500W — 1953 × 1134 mm',
    width: 1134,
    height: 1953,
    power: 500,
    description: 'Large commercial 500W panel (1953 × 1134 mm).',
    description_de: 'Großformat 500W Modul (1953 × 1134 mm).'
  },
  large_540: {
    name: '540W — 1954 × 1134 mm',
    name_de: '540W — 1954 × 1134 mm',
    width: 1134,
    height: 1954,
    power: 540,
    description: 'Large commercial 540W panel (1954 × 1134 mm).',
    description_de: 'Großformat 540W Modul (1954 × 1134 mm).'
  },
  commercial_550: {
    name: '550W — 2278 × 1134 mm',
    name_de: '550W — 2278 × 1134 mm',
    width: 1134,
    height: 2278,
    power: 550,
    description: 'Commercial 550W panel (2278 × 1134 mm).',
    description_de: 'Gewerbemodul 550W (2278 × 1134 mm).'
  },
  custom: {
    name: 'Custom (Manual Dimensions)',
    name_de: 'Benutzerdefiniert (Manuell)',
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

