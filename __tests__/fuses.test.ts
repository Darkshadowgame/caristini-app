import { FUSE_CARS } from '../src/data/fuses';
import { decodeVin } from '../src/vehicle/vin';

// fuseCarFor lives in the screen file; test the data and the matching rule directly.
const match = (v: { group: string; brand: string; model: string }) => {
  const model = v.model.toLowerCase().replace(/\s+/g, '');
  return FUSE_CARS.find((c) => c.group === v.group && v.brand.toLowerCase().startsWith(c.brand.toLowerCase()) && c.models.some((m) => model.includes(m)));
};

describe('fuse data', () => {
  it('has boxes, fuses and https links for every car', () => {
    expect(FUSE_CARS).toHaveLength(4);
    for (const car of FUSE_CARS) {
      expect(car.boxes.length).toBeGreaterThan(1);
      for (const b of car.boxes) {
        expect(b.fuses.length).toBeGreaterThan(0);
        expect(b.sourceUrl).toMatch(/^https:\/\//);
        for (const f of b.fuses) expect(f.amps === null || f.amps.every((a) => a > 0 && a <= 200)).toBe(true);
      }
      for (const l of car.links) expect(l.url).toMatch(/^https:\/\//);
    }
  });

  it("matches the owner's A6 and Leon from their VINs", () => {
    const a6 = decodeVin('WAUZZZ4GXCN000000');
    expect(match({ group: a6.group, brand: a6.brand!, model: a6.model ?? '' })?.id).toBe('audi-a6-c7');
    const leon = decodeVin('VSSZZZ1PZ7R000000');
    expect(match({ group: leon.group, brand: leon.brand!, model: leon.model ?? '' })?.id).toBe('seat-leon-1p');
  });
});
