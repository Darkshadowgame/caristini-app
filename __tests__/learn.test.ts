import { diffSnapshots, LearnedSetting, learnedIsOn, learnedReady, withLearned } from '../src/coding/learn';

describe('learn from another tool', () => {
  const before = { 'vag-17': '1303080000000000000000', 'vag-09': 'AA00', 'vag-46': '0102' };
  const after = { 'vag-17': '1203080000000000000000', 'vag-09': 'AA00', 'vag-46': '010203' };

  it('finds the changed bits and skips modules whose length changed', () => {
    const { parts, skipped } = diffSnapshots(before, after);
    expect(parts).toEqual([{ module: 'vag-17', length: 11, byte: 0, mask: 0x01, on: 0x00, off: 0x01 }]);
    expect(skipped).toEqual(['vag-46']);
  });

  it('switches a learned setting on and off without touching other bits', () => {
    const s: LearnedSetting = { id: 'x', title: 'Test', learnedAt: '2026-11-11', parts: diffSnapshots(before, after).parts };
    const coding = [0x13, 0x03, 0x08, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(learnedReady(s, { 'vag-17': coding })).toBe(true);
    expect(learnedIsOn(s, { 'vag-17': coding })).toBe(false);
    const on = withLearned(s, 'vag-17', coding, true);
    expect(on[0]).toBe(0x12);
    expect(learnedIsOn(s, { 'vag-17': on })).toBe(true);
    expect(withLearned(s, 'vag-17', on, false)).toEqual(coding);
    expect(learnedReady(s, { 'vag-17': [1, 2] })).toBe(false);
  });

  it('handles a setting that changes several bits in two modules', () => {
    const { parts } = diffSnapshots({ a: '00F0', b: '10' }, { a: '0F00', b: '11' });
    expect(parts).toHaveLength(3);
    const s: LearnedSetting = { id: 'y', title: 'Two', learnedAt: '', parts };
    expect(withLearned(s, 'a', [0x00, 0xf0], true)).toEqual([0x0f, 0x00]);
    expect(learnedIsOn(s, { a: [0x0f, 0x00], b: [0x11] })).toBe(true);
    expect(learnedIsOn(s, { a: [0x0f, 0x00], b: [0x10] })).toBe(false);
  });
});
