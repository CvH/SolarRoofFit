import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  snapToGrid,
  getRoofSetbacks,
  getRotatedDimensions,
  getModuleBounds,
  evaluateModuleBoundary,
  detectCollisions,
  decomposeUsableArea,
  calculateAutoFill
} from '../js/layout.js';

describe('Layout Math & Geometry Engine', () => {

  describe('snapToGrid', () => {
    it('snaps numbers to nearest raster step', () => {
      assert.equal(snapToGrid(1.23, 0.1), 1.2);
      assert.equal(snapToGrid(1.27, 0.1), 1.3);
      assert.equal(snapToGrid(2.55, 0.5), 2.5);
      assert.equal(snapToGrid(2.78, 0.5), 3.0);
    });

    it('returns original value when step is 0 or negative', () => {
      assert.equal(snapToGrid(1.234, 0), 1.234);
      assert.equal(snapToGrid(1.234, -1), 1.234);
    });
  });

  describe('getRoofSetbacks', () => {
    it('handles uniform linked setbacks', () => {
      const roof = { setbackLinked: true, setback: 0.6 };
      const sb = getRoofSetbacks(roof);
      assert.deepEqual(sb, { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 });
    });

    it('handles individual 4-sided unlinked setbacks', () => {
      const roof = {
        setbackLinked: false,
        setbackTop: 0.5,
        setbackBottom: 0.8,
        setbackLeft: 0.4,
        setbackRight: 0.7
      };
      const sb = getRoofSetbacks(roof);
      assert.deepEqual(sb, { top: 0.5, bottom: 0.8, left: 0.4, right: 0.7 });
    });

    it('clamps negative setbacks to zero', () => {
      const roof = { setbackLinked: true, setback: -0.2 };
      const sb = getRoofSetbacks(roof);
      assert.deepEqual(sb, { top: 0, bottom: 0, left: 0, right: 0 });
    });
  });

  describe('getRotatedDimensions', () => {
    const modConfig = { width: 1134, height: 1762 };

    it('returns portrait dimensions at 0° and 180°', () => {
      const d0 = getRotatedDimensions(modConfig, 0);
      assert.equal(d0.width, 1.134);
      assert.equal(d0.height, 1.762);
      assert.equal(d0.isLandscape, false);

      const d180 = getRotatedDimensions(modConfig, 180);
      assert.equal(d180.width, 1.134);
      assert.equal(d180.height, 1.762);
      assert.equal(d180.isLandscape, false);
    });

    it('returns landscape dimensions at 90° and 270°', () => {
      const d90 = getRotatedDimensions(modConfig, 90);
      assert.equal(d90.width, 1.762);
      assert.equal(d90.height, 1.134);
      assert.equal(d90.isLandscape, true);

      const d270 = getRotatedDimensions(modConfig, 270);
      assert.equal(d270.width, 1.762);
      assert.equal(d270.height, 1.134);
      assert.equal(d270.isLandscape, true);
    });
  });

  describe('evaluateModuleBoundary', () => {
    const roof = { width: 10, length: 8, setback: 0.5, setbackLinked: true };
    const modConfig = { width: 1000, height: 1600 };

    it('returns ok when module is safely inside setbacks', () => {
      const mod = { id: 1, x: 2.0, y: 2.0, rotation: 0 };
      assert.equal(evaluateModuleBoundary(mod, modConfig, roof), 'ok');
    });

    it('returns warning_setback when module breaches setback border', () => {
      const mod = { id: 2, x: 0.2, y: 2.0, rotation: 0 };
      assert.equal(evaluateModuleBoundary(mod, modConfig, roof), 'warning_setback');
    });

    it('returns error_roof when module hangs over roof edge', () => {
      const mod = { id: 3, x: 9.5, y: 2.0, rotation: 0 }; // 9.5 + 1.0 = 10.5 > 10.0
      assert.equal(evaluateModuleBoundary(mod, modConfig, roof), 'error_roof');
    });
  });

  describe('detectCollisions', () => {
    const modConfig = { width: 1000, height: 1000 };

    it('detects overlapping modules', () => {
      const modules = [
        { id: 'm1', x: 1.0, y: 1.0, rotation: 0 },
        { id: 'm2', x: 1.5, y: 1.5, rotation: 0 }, // overlaps m1
        { id: 'm3', x: 5.0, y: 5.0, rotation: 0 }  // clear
      ];
      const colliding = detectCollisions(modules, modConfig, [], []);
      assert.equal(colliding.has('m1'), true);
      assert.equal(colliding.has('m2'), true);
      assert.equal(colliding.has('m3'), false);
    });

    it('detects collisions with obstacle keep-out buffer', () => {
      const modules = [
        { id: 'm1', x: 1.0, y: 1.0, rotation: 0 }
      ];
      const obstacles = [
        { id: 'obs1', x: 1.5, y: 1.5, width: 1.0, length: 1.0, clearance: 0.3 }
      ];
      const colliding = detectCollisions(modules, modConfig, [], obstacles);
      assert.equal(colliding.has('m1'), true);
    });

    it('detects collisions with custom walkways', () => {
      const modules = [
        { id: 'm1', x: 2.0, y: 2.0, rotation: 0 }
      ];
      const walkways = [
        { id: 'w1', x: 1.5, y: 2.2, width: 2.0, height: 0.5 }
      ];
      const colliding = detectCollisions(modules, modConfig, walkways, []);
      assert.equal(colliding.has('m1'), true);
    });
  });

  describe('calculateAutoFill', () => {
    it('generates optimal packed modules on a standard roof', () => {
      const roof = { width: 10, length: 8, setback: 0.5, setbackLinked: true };
      const modConfig = { width: 1134, height: 1762, gapX: 20, gapY: 20 };

      const result = calculateAutoFill(roof, modConfig, 'optimal', 0.05);
      assert.ok(result.count > 0, 'Should place at least 1 module');
      assert.equal(result.modules.length, result.count);

      // Verify no module is placed outside roof perimeter
      for (const m of result.modules) {
        const status = evaluateModuleBoundary(m, modConfig, roof);
        assert.notEqual(status, 'error_roof', 'No module should hang outside roof edge');
      }
    });

    it('returns 0 modules when usable roof area is zero or negative', () => {
      const roof = { width: 2, length: 2, setback: 1.5, setbackLinked: true }; // setback * 2 = 3 > 2
      const modConfig = { width: 1134, height: 1762, gapX: 20, gapY: 20 };

      const result = calculateAutoFill(roof, modConfig, 'optimal', 0.05);
      assert.equal(result.count, 0);
      assert.equal(result.modules.length, 0);
    });
  });

  describe('decomposeUsableArea', () => {
    it('partitions a rectangular area around a central walkway', () => {
      const usable = { x: 0, y: 0, width: 10, height: 10 };
      const walkway = [{ x: 4, y: 0, width: 2, height: 10 }];
      const zones = decomposeUsableArea(usable, walkway, 0, 0);

      // Walkway from x=4 to x=6 should split the area into left (x=0..4) and right (x=6..10)
      assert.equal(zones.length, 2);
      const leftZone = zones.find(z => z.x === 0);
      const rightZone = zones.find(z => z.x >= 6);
      assert.ok(leftZone, 'Left zone should exist');
      assert.ok(rightZone, 'Right zone should exist');
    });
  });

});
