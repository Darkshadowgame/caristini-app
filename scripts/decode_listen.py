"""Decode a Caristini Listen-mode recording into diagnostic messages.

Input lines look like "12.345 7140322F187" (seconds, 3-digit CAN ID, data hex),
plus "# ..." comments and markers. ISO-TP (UDS on 7xx) frames are rebuilt into
whole messages; VW TP2.0 channels are found from their setup on 0x200 and
decoded with TP2.0 framing. Markers are printed in place, so each step the
owner did in the other tool lines up with its commands.

Usage: python -I scripts/decode_listen.py <recording.txt> [--json out.json]
"""
import json
import re
import sys
from pathlib import Path

LINE = re.compile(r'^(\d+\.\d+)\s+([0-9A-Fa-f]{3})([0-9A-Fa-f]*)$')


def parse(path):
    for raw in Path(path).read_text(encoding='utf-8', errors='replace').splitlines():
        raw = raw.strip()
        if not raw:
            continue
        if raw.startswith('#'):
            yield ('mark', raw[1:].strip())
            continue
        m = LINE.match(raw)
        if not m:
            continue
        data = bytes.fromhex(m.group(3)[: len(m.group(3)) // 2 * 2])
        yield ('frame', float(m.group(1)), int(m.group(2), 16), data)


def decode(events):
    out = []
    isotp = {}  # can id -> [expected length, bytes]
    tp20 = {}  # can id -> {'len': n, 'buf': bytes}
    tp20_ids = set()
    for ev in events:
        if ev[0] == 'mark':
            out.append({'mark': ev[1]})
            continue
        _, t, cid, d = ev
        if not d:
            continue
        # TP2.0 channel setup and reply: learn the channel IDs.
        if 0x200 <= cid <= 0x2FF and len(d) >= 7 and d[1] in (0xC0, 0xD0):
            if d[1] == 0xD0 and (d[3] >> 4) == 0 and (d[5] >> 4) == 0:
                rx = ((d[3] & 7) << 8) | d[2]
                tx = ((d[5] & 7) << 8) | d[4]
                tp20_ids.update({rx, tx})
                out.append({'t': t, 'tp20_open': f'module {cid - 0x200:02X}', 'module_sends': f'{rx:03X}', 'tester_sends': f'{tx:03X}'})
            continue
        if cid in tp20_ids:
            op = d[0] >> 4
            if op > 3:
                continue  # ACK, parameters, keep-alive, disconnect
            st = tp20.get(cid)
            if st is None:
                st = {'len': (d[1] << 8 | d[2]) & 0x0FFF, 'buf': bytearray(d[3:])}
                tp20[cid] = st
            else:
                st['buf'] += d[1:]
            if op in (1, 3) and len(st['buf']) >= st['len']:
                out.append({'t': t, 'id': f'{cid:03X}', 'kwp': st['buf'][: st['len']].hex(' ').upper()})
                del tp20[cid]
            continue
        # ISO-TP on the diagnostic IDs.
        pci = d[0] >> 4
        if pci == 0:
            n = d[0] & 0x0F
            out.append({'t': t, 'id': f'{cid:03X}', 'uds': d[1 : 1 + n].hex(' ').upper()})
        elif pci == 1 and len(d) >= 2:
            n = ((d[0] & 0x0F) << 8) | d[1]
            isotp[cid] = [n, bytearray(d[2:])]
        elif pci == 2 and cid in isotp:
            isotp[cid][1] += d[1:]
            n, buf = isotp[cid]
            if len(buf) >= n:
                out.append({'t': t, 'id': f'{cid:03X}', 'uds': bytes(buf[:n]).hex(' ').upper()})
                del isotp[cid]
    return out


def main():
    rows = decode(parse(sys.argv[1]))
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(rows, indent=1), encoding='utf-8')
    for r in rows:
        if 'mark' in r:
            print(f'---- {r["mark"]}')
        elif 'tp20_open' in r:
            print(f'{r["t"]:9.3f}  TP2.0 channel to {r["tp20_open"]} (module {r["module_sends"]}, tester {r["tester_sends"]})')
        else:
            kind = 'KWP' if 'kwp' in r else 'UDS'
            print(f'{r["t"]:9.3f}  {r["id"]}  {kind}  {r.get("kwp") or r.get("uds")}')


if __name__ == '__main__':
    main()
