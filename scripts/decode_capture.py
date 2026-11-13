"""Decode a Bluetooth capture of an OBD app talking to an ELM327-style adapter.

Reads an iPhone PacketLogger file (.pklg, from a sysdiagnose with Apple's
Bluetooth logging profile) or an Android btsnoop file (btsnoop_hci.log), pulls
out the bytes written to and notified by the adapter, and prints the adapter
conversation: each command, the header it was sent to, and the reply.

Usage: python -I scripts/decode_capture.py <capture> [--json out.json]
"""
import json
import re
import struct
import sys
from pathlib import Path


def pklg_records(data: bytes):
    """Yield (sent, payload) from a PacketLogger file (either byte order)."""
    for order in ('>', '<'):
        out, i, ok = [], 0, True
        while i + 13 <= len(data):
            (n,) = struct.unpack(order + 'I', data[i:i + 4])
            if n < 9 or i + 4 + n > len(data):
                ok = False
                break
            kind = data[i + 12]
            payload = data[i + 13:i + 4 + n]
            # 0x02 ACL sent, 0x03 ACL received.
            if kind in (0x02, 0x03):
                out.append((kind == 0x02, payload))
            i += 4 + n
        if ok and i == len(data):
            return out
    raise ValueError('Not a PacketLogger file')


def btsnoop_records(data: bytes):
    if not data.startswith(b'btsnoop\0'):
        raise ValueError('Not a btsnoop file')
    (_, link) = struct.unpack('>II', data[8:16])
    out, i = [], 16
    while i + 24 <= len(data):
        _, incl, flags, _, _ = struct.unpack('>IIIIq', data[i:i + 24])
        rec = data[i + 24:i + 24 + incl]
        i += 24 + incl
        sent = (flags & 1) == 0
        if link == 1002:  # H4: first byte is the packet type, 0x02 = ACL
            if not rec or rec[0] != 0x02:
                continue
            rec = rec[1:]
        out.append((sent, rec))
    return out


def att_values(records):
    """Yield (sent, value) for ATT writes (to the adapter) and notifications (from it)."""
    for sent, acl in records:
        if len(acl) < 9:
            continue
        l2len, cid = struct.unpack('<HH', acl[4:8])
        if cid != 0x0004:
            continue
        att = acl[8:8 + l2len]
        op = att[0]
        if sent and op in (0x12, 0x52):  # write request / write command
            yield True, att[3:]
        elif not sent and op in (0x1B, 0x1D):  # notification / indication
            yield False, att[3:]


def conversation(values):
    """Split the byte streams into (command, reply) pairs at CR and the '>' prompt."""
    pairs, cmd, reply, pending = [], b'', b'', None
    for sent, v in values:
        if sent:
            cmd += v
            while b'\r' in cmd:
                line, cmd = cmd.split(b'\r', 1)
                if pending is not None:
                    pairs.append((pending, reply))
                    reply = b''
                pending = line
        else:
            reply += v
            if b'>' in reply and pending is not None:
                pairs.append((pending, reply.split(b'>')[0]))
                reply, pending = b'', None
    if pending is not None:
        pairs.append((pending, reply))
    return pairs


def annotate(pairs):
    header, rows = '7DF', []
    for c, r in pairs:
        cmd = c.decode('ascii', 'replace').strip().upper().replace(' ', '')
        rep = [l.strip() for l in re.split(r'[\r\n]+', r.decode('ascii', 'replace')) if l.strip()]
        if cmd.startswith('ATSH'):
            header = cmd[4:]
        rows.append({'header': header, 'command': cmd, 'reply': rep})
    return rows


def summary(rows):
    """Unique non-AT requests per header, with the services they use."""
    seen = {}
    for r in rows:
        if r['command'].startswith('AT') or not r['command']:
            continue
        key = (r['header'], r['command'])
        seen.setdefault(key, r['reply'])
    return seen


def main():
    path = Path(sys.argv[1])
    data = path.read_bytes()
    try:
        recs = pklg_records(data)
    except ValueError:
        recs = btsnoop_records(data)
    rows = annotate(conversation(att_values(recs)))
    if '--json' in sys.argv:
        Path(sys.argv[sys.argv.index('--json') + 1]).write_text(json.dumps(rows, indent=1), encoding='utf-8')
    for (h, c), rep in summary(rows).items():
        print(f'{h:>4}  {c:<24} {" | ".join(rep)[:100]}')
    print(f'\n{len(rows)} commands, {len(summary(rows))} unique requests')


if __name__ == '__main__':
    main()
