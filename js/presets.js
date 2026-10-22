/**
 * Solar PV Module and Roof Presets
 */

export const MODULE_PRESETS = {
  standard_430: {
    name: 'Standard Residential (430 Wp)',
    width: 1134,   // mm
    height: 1762,  // mm
    power: 430,    // Wp
    description: 'Most common 108-half-cell monocrystalline panel for home installations.'
  },
  highpower_450: {
    name: 'High Efficiency N-Type (450 Wp)',
    width: 1134,
    height: 1762,
    power: 450,
    description: 'Top-tier N-type TOPCon module with superior low-light performance.'
  },
  commercial_550: {
    name: 'Commercial Heavy (550 Wp)',
    width: 1134,
    height: 2278,
    power: 550,
    description: 'Large 144-cell module engineered for large commercial rooftops.'
  },
  compact_380: {
    name: 'Compact / Balcony (380 Wp)',
    width: 1038,
    height: 1690,
    power: 380,
    description: 'Slim lightweight format suited for restricted or complex roof areas.'
  },
  custom: {
    name: 'Custom Module',
    width: 1134,
    height: 1762,
    power: 430,
    description: 'Manually specified module dimensions and peak power.'
  }
};

export const ROOF_PRESETS = {
  res_standard: {
    name: 'Residential Flat Roof (12m × 8m)',
    width: 12.0,
    length: 8.0,
    setback: 0.5,
    setbackTop: 0.5,
    setbackBottom: 0.5,
    setbackLeft: 0.5,
    setbackRight: 0.5,
    setbackLinked: true,
    description: 'Typical single-family home or duplex flat roof with 50cm safety border.'
  },
  garage_double: {
    name: 'Double Garage / Carport (6.5m × 6m)',
    width: 6.5,
    length: 6.0,
    setback: 0.3,
    setbackTop: 0.3,
    setbackBottom: 0.3,
    setbackLeft: 0.3,
    setbackRight: 0.3,
    setbackLinked: true,
    description: 'Standard double garage with 30cm maintenance margin.'
  },
  commercial_hall: {
    name: 'Commercial Warehouse (28m × 16m)',
    width: 28.0,
    length: 16.0,
    setback: 0.8,
    setbackTop: 0.8,
    setbackBottom: 0.8,
    setbackLeft: 0.8,
    setbackRight: 0.8,
    setbackLinked: true,
    description: 'Commercial facility with 80cm edge safety setback for wind loads.'
  },
  terrace_small: {
    name: 'Roof Terrace / Small Flat (5.5m × 4m)',
    width: 5.5,
    length: 4.0,
    setback: 0.25,
    setbackTop: 0.25,
    setbackBottom: 0.25,
    setbackLeft: 0.25,
    setbackRight: 0.25,
    setbackLinked: true,
    description: 'Compact urban flat roof with minimal safety border.'
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
  { label: 'Every 1 Row (Frequent)', value: 1 },
  { label: 'Every 2 Rows (Standard)', value: 2 },
  { label: 'Every 3 Rows', value: 3 },
  { label: 'Every 4 Rows (High Density)', value: 4 }
];

