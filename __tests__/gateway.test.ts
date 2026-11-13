import { idsForNode, nodesFromBitmap, parseC6List, slotsFromTables } from '../src/obd/vagGateway';
import { parseGatewayList, parseKwpIdent, parseMeasuringBlock } from '../src/obd/tp20';

describe('VW gateway tables', () => {
  it('decodes the MQB bitmap least significant bit first', () => {
    // e-Golf GVL from vag-sources 1.2: 01563C000000060854CC8000A000481800...
    const hex = '01563C000000060854CC8000A000481800000000000200000000000000000000';
    const bytes = hex.match(/../g)!.map((h) => parseInt(h, 16));
    const nodes = nodesFromBitmap(bytes);
    expect(nodes.length).toBe(27);
    expect(nodes).toContain(0x14);
    expect(nodes).toContain(0x76);
  });

  it('maps nodes to request and reply IDs', () => {
    expect(idsForNode(0x14)).toEqual({ tx: '714', rx: '77E' });
    expect(idsForNode(0x76)).toEqual({ tx: '7E0', rx: '7E8' });
    expect(idsForNode(0x05)).toBeNull();
    expect(idsForNode(0x00)).toBeNull();
  });

  it('reads MLB slot tables', () => {
    const slots = slotsFromTables([0x01, 0x03, 0x09, 0x03, 0x00], [0, 0, 0x07, 0x13, 0, 0, 0, 0, 0, 0], [0x01, 0x01, 0x02, 0x01, 0]);
    expect(slots).toEqual([
      { code: '01', tx: null, uds: true, tp20: false },
      { code: '03', tx: '713', uds: true, tp20: false },
      { code: '09', tx: null, uds: false, tp20: true },
    ]);
  });

  it('reads the C6-style list', () => {
    expect(parseC6List([0x17, 0x07, 0x05, 0x03, 0x46, 0x00, 0x00, 0x00])).toEqual(new Map([['17', 0x07]]));
  });
});

describe('KWP2000 decoders', () => {
  it('reads the PQ gateway list', () => {
    // 5A 9F, block of 2 records (length 9 including itself), then FF.
    const msg = [0x5a, 0x9f, 0x09, 0x17, 0x07, 0x00, 0x03, 0x46, 0x13, 0x00, 0x01, 0xff];
    expect(parseGatewayList(msg)).toEqual(new Map([[0x17, 0x07]]));
  });

  it('reads 1A 9B identification', () => {
    const text = (s: string, n: number) => [...s.padEnd(n, ' ')].map((c) => c.charCodeAt(0));
    const msg = [0x5a, 0x9b, ...text('1P0920823A', 12), ...text('0040', 4), 0x03, 0x00, 0x27, 0xd8, 0, 0, 0, 0, 0, 0, ...text('KOMBI+WEGFAHRSP VDO', 20)];
    expect(parseKwpIdent(msg)).toMatchObject({ partNumber: '1P0920823A', software: '0040', coding: 10200, component: 'KOMBI+WEGFAHRSP VDO' });
  });

  it('reads a measuring block and leaves unknown formulas raw', () => {
    const cells = parseMeasuringBlock([0x61, 0x73, 0x01, 0xc8, 0x4b, 0x12, 0x64, 0x19, 0x99, 0x01, 0x02, 0x25, 0x00, 0x00], 0x73)!;
    expect(cells[0]).toMatchObject({ value: 3000, unit: 'rpm' });
    expect(cells[1]).toMatchObject({ value: 100, unit: 'mbar' });
    expect(cells[2]).toMatchObject({ value: 258, unit: 'raw', known: false });
    expect(cells).toHaveLength(3);
  });
});
