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

export const SKYLIGHT_PRESETS = {
  // Flat-roof skylight domes (Lichtkuppeln)
  dome_60_60: {
    category: 'dome',
    name: 'Skylight Dome 60 × 60 cm',
    name_de: 'Lichtkuppel 60 × 60 cm',
    width: 0.60,
    length: 0.60,
    description: 'Square flat roof skylight dome 60 × 60 cm.',
    description_de: 'Quadratische Lichtkuppel 60 × 60 cm für Flachdächer.'
  },
  dome_80_80: {
    category: 'dome',
    name: 'Skylight Dome 80 × 80 cm',
    name_de: 'Lichtkuppel 80 × 80 cm',
    width: 0.80,
    length: 0.80,
    description: 'Square flat roof skylight dome 80 × 80 cm.',
    description_de: 'Quadratische Lichtkuppel 80 × 80 cm für Flachdächer.'
  },
  dome_100_100: {
    category: 'dome',
    name: 'Skylight Dome 100 × 100 cm (Standard)',
    name_de: 'Lichtkuppel 100 × 100 cm (Standard)',
    width: 1.00,
    length: 1.00,
    description: 'Standard flat roof skylight dome 100 × 100 cm (1.0 × 1.0 m).',
    description_de: 'Standard-Lichtkuppel 100 × 100 cm (1,0 × 1,0 m).'
  },
  dome_120_120: {
    category: 'dome',
    name: 'Skylight Dome 120 × 120 cm',
    name_de: 'Lichtkuppel 120 × 120 cm',
    width: 1.20,
    length: 1.20,
    description: 'Large flat roof skylight dome 120 × 120 cm (1.2 × 1.2 m).',
    description_de: 'Große Lichtkuppel 120 × 120 cm (1,2 × 1,2 m).'
  },
  dome_150_150: {
    category: 'dome',
    name: 'Skylight Dome 150 × 150 cm',
    name_de: 'Lichtkuppel 150 × 150 cm',
    width: 1.50,
    length: 1.50,
    description: 'Extra large flat roof skylight dome 150 × 150 cm.',
    description_de: 'Extra große Lichtkuppel 150 × 150 cm.'
  },
  dome_100_150: {
    category: 'dome',
    name: 'Skylight Dome 100 × 150 cm',
    name_de: 'Lichtkuppel 100 × 150 cm',
    width: 1.00,
    length: 1.50,
    description: 'Rectangular flat roof skylight dome 100 × 150 cm.',
    description_de: 'Rechteckige Lichtkuppel 100 × 150 cm.'
  },

  // Roof windows (Velux DIN Standard)
  velux_ck02: {
    category: 'window',
    name: 'Roof Window 55 × 78 cm (CK02)',
    name_de: 'Dachfenster 55 × 78 cm (CK02)',
    width: 0.55,
    length: 0.78,
    description: 'Compact roof window 55 × 78 cm (Velux CK02).',
    description_de: 'Kompaktes Dachfenster 55 × 78 cm (Velux CK02).'
  },
  velux_ck04: {
    category: 'window',
    name: 'Roof Window 55 × 98 cm (CK04)',
    name_de: 'Dachfenster 55 × 98 cm (CK04)',
    width: 0.55,
    length: 0.98,
    description: 'Roof window 55 × 98 cm (Velux CK04).',
    description_de: 'Dachfenster 55 × 98 cm (Velux CK04).'
  },
  velux_mk04: {
    category: 'window',
    name: 'Roof Window 78 × 98 cm (MK04)',
    name_de: 'Dachfenster 78 × 98 cm (MK04)',
    width: 0.78,
    length: 0.98,
    description: 'Standard roof window 78 × 98 cm (Velux MK04).',
    description_de: 'Standard-Dachfenster 78 × 98 cm (Velux MK04).'
  },
  velux_mk06: {
    category: 'window',
    name: 'Roof Window 78 × 118 cm (MK06)',
    name_de: 'Dachfenster 78 × 118 cm (MK06)',
    width: 0.78,
    length: 1.18,
    description: 'Standard roof window 78 × 118 cm (Velux MK06).',
    description_de: 'Standard-Dachfenster 78 × 118 cm (Velux MK06).'
  },
  velux_mk08: {
    category: 'window',
    name: 'Roof Window 78 × 140 cm (MK08)',
    name_de: 'Dachfenster 78 × 140 cm (MK08)',
    width: 0.78,
    length: 1.40,
    description: 'Tall roof window 78 × 140 cm (Velux MK08).',
    description_de: 'Hohes Dachfenster 78 × 140 cm (Velux MK08).'
  },
  velux_pk08: {
    category: 'window',
    name: 'Roof Window 94 × 140 cm (PK08)',
    name_de: 'Dachfenster 94 × 140 cm (PK08)',
    width: 0.94,
    length: 1.40,
    description: 'Wide roof window 94 × 140 cm (Velux PK08).',
    description_de: 'Breites Dachfenster 94 × 140 cm (Velux PK08).'
  },
  velux_sk06: {
    category: 'window',
    name: 'Roof Window 114 × 118 cm (SK06)',
    name_de: 'Dachfenster 114 × 118 cm (SK06)',
    width: 1.14,
    length: 1.18,
    description: 'Large roof window 114 × 118 cm (Velux SK06).',
    description_de: 'Großes Dachfenster 114 × 118 cm (Velux SK06).'
  },
  velux_sk08: {
    category: 'window',
    name: 'Roof Window 114 × 140 cm (SK08)',
    name_de: 'Dachfenster 114 × 140 cm (SK08)',
    width: 1.14,
    length: 1.40,
    description: 'Large roof window 114 × 140 cm (Velux SK08).',
    description_de: 'Großes Dachfenster 114 × 140 cm (Velux SK08).'
  },
  velux_uk08: {
    category: 'window',
    name: 'Roof Window 134 × 140 cm (UK08)',
    name_de: 'Dachfenster 134 × 140 cm (UK08)',
    width: 1.34,
    length: 1.40,
    description: 'Extra wide roof window 134 × 140 cm (Velux UK08).',
    description_de: 'Maximales Dachfenster 134 × 140 cm (Velux UK08).'
  },

  // Custom Skylight
  custom: {
    category: 'custom',
    name: 'Custom Skylight (0.30 – 2.50 m)',
    name_de: 'Benutzerdefiniert (0,30 – 2,50 m)',
    width: 1.00,
    length: 1.00,
    description: 'Custom skylight dimensions between 0.30 m and 2.50 m.',
    description_de: 'Freie Abmessungen zwischen 0,30 m und 2,50 m.'
  }
};

export const CHIMNEY_PRESETS = {
  // Single-flue chimneys (Einzügig)
  single_40_40: {
    category: 'single',
    name: 'Chimney 40 × 40 cm (Single-Flue)',
    name_de: 'Schornstein 40 × 40 cm (Einzügig)',
    width: 0.40,
    length: 0.40,
    flues: 1,
    description: 'Standard single-flue masonry chimney 40 × 40 cm.',
    description_de: 'Standard einzügiger gemauerter Kamin 40 × 40 cm.'
  },
  single_45_45: {
    category: 'single',
    name: 'Chimney 45 × 45 cm (Single-Flue)',
    name_de: 'Schornstein 45 × 45 cm (Einzügig)',
    width: 0.45,
    length: 0.45,
    flues: 1,
    description: 'Single-flue chimney 45 × 45 cm.',
    description_de: 'Einzügiger Kamin 45 × 45 cm.'
  },
  single_50_50: {
    category: 'single',
    name: 'Chimney 50 × 50 cm (Single-Flue Large)',
    name_de: 'Schornstein 50 × 50 cm (Einzügig groß)',
    width: 0.50,
    length: 0.50,
    flues: 1,
    description: 'Large single-flue chimney 50 × 50 cm.',
    description_de: 'Großer einzügiger Kamin 50 × 50 cm.'
  },

  // Double-flue / Rectangular chimneys (Zweizügig)
  double_40_65: {
    category: 'double',
    name: 'Chimney 40 × 65 cm (Double-Flue)',
    name_de: 'Schornstein 40 × 65 cm (Zweizügig)',
    width: 0.40,
    length: 0.65,
    flues: 2,
    description: 'Standard double-flue masonry chimney 40 × 65 cm.',
    description_de: 'Zweizügiger Kamin / Kamin mit Lüftung 40 × 65 cm.'
  },
  double_40_80: {
    category: 'double',
    name: 'Chimney 40 × 80 cm (Double-Flue Long)',
    name_de: 'Schornstein 40 × 80 cm (Zweizügig lang)',
    width: 0.40,
    length: 0.80,
    flues: 2,
    description: 'Double-flue chimney with ventilation shaft 40 × 80 cm.',
    description_de: 'Zweizügiger Kamin mit Lüftungsschacht 40 × 80 cm.'
  },
  double_50_75: {
    category: 'double',
    name: 'Chimney 50 × 75 cm (Double-Flue Large)',
    name_de: 'Schornstein 50 × 75 cm (Zweizügig groß)',
    width: 0.50,
    length: 0.75,
    flues: 2,
    description: 'Large double-flue chimney 50 × 75 cm.',
    description_de: 'Großer zweizügiger Kamin 50 × 75 cm.'
  },
  double_50_100: {
    category: 'double',
    name: 'Chimney 50 × 100 cm (Multi-Flue)',
    name_de: 'Schornstein 50 × 100 cm (Mehrzügig)',
    width: 0.50,
    length: 1.00,
    flues: 3,
    description: 'Multi-flue central building chimney 50 × 100 cm.',
    description_de: 'Mehrzügiger Zentralschornstein 50 × 100 cm.'
  },

  // Vent / Exhaust pipe
  vent_30_30: {
    category: 'vent',
    name: 'Vent / Flue Pipe 30 × 30 cm',
    name_de: 'Abluftschacht / Abgasrohr 30 × 30 cm',
    width: 0.30,
    length: 0.30,
    flues: 1,
    description: 'Compact roof vent / exhaust pipe 30 × 30 cm.',
    description_de: 'Kompakter Entlüftungsschacht / Rohr 30 × 30 cm.'
  },

  // Custom Chimney
  custom: {
    category: 'custom',
    name: 'Custom Chimney (0.30 – 2.50 m)',
    name_de: 'Benutzerdefiniert (0,30 – 2,50 m)',
    width: 0.40,
    length: 0.40,
    flues: 1,
    description: 'Custom chimney dimensions between 0.30 m and 2.50 m.',
    description_de: 'Freie Abmessungen zwischen 0,30 m und 2,50 m.'
  }
};


