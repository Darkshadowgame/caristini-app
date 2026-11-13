"""Builds src/data/sensors.ts from OBDb signal sets (CC BY-SA 4.0).

Usage: python -I gen_sensors.py <obdb dir> <repo root>
Only UDS service 22 reads on 11-bit headers. Hybrid and electric signals and
names that are raw ECU identifiers are left out.
"""
import json, re, sys, pathlib

src = pathlib.Path(sys.argv[1])
root = pathlib.Path(sys.argv[2])

# Closest relatives first: the sensor finder asks for these first.
POOLS = {
    'vag': ['Audi-A6', 'Audi-A7', 'Audi-S6', 'Audi-A4', 'Audi-S4', 'Audi-A5', 'Audi-S5', 'Audi-Q5', 'Audi-SQ5',
            'Porsche-Macan', 'Audi-Q7', 'Volkswagen-Touareg', 'Porsche-Cayenne',
            'Volkswagen-Passat', 'Volkswagen-CC', 'Volkswagen-Golf', 'Volkswagen-Jetta', 'Volkswagen-Jetta-GLI',
            'Volkswagen-Scirocco', 'Volkswagen-Beetle', 'Volkswagen-Touran', 'Volkswagen-Tiguan', 'Audi-A3', 'Audi-S3',
            'Audi-RS-3', 'Audi-TT', 'Audi-Q3', 'Audi-Q2', 'Audi-A1', 'Audi-RS-5', 'SEAT-Leon', 'Cupra-Leon',
            'Cupra-Formentor', 'Volkswagen-Arteon', 'Volkswagen-Atlas', 'Volkswagen-T-Roc', 'Volkswagen-Taos',
            'Volkswagen-Polo', 'Volkswagen-Up', 'Volkswagen-Amarok', 'Volkswagen-Crafter', 'Volkswagen-T6-Transporter',
            'Volkswagen-Transporter'],
    'ford': ['Ford-Focus-ST', 'Ford-Focus', 'Ford-Focus-RS', 'Ford-Kuga', 'Ford-Escape', 'Ford-C-Max', 'Ford-Fiesta',
             'Ford-Mondeo', 'Ford-Transit-Connect', 'Ford-EcoSport', 'Ford-Puma'],
    'mazda': ['Mazda-6', 'Mazda-CX-5', 'Mazda-3', 'Mazda-CX-3', 'Mazda-2', 'Mazda-CX-30', 'Mazda-CX-9', 'Mazda-MX-5'],
}
# Year filters only mean something for the owner's own model line.
OWN = {'vag': {'Audi-A6'}, 'ford': {'Ford-Focus-ST', 'Ford-Focus'}, 'mazda': {'Mazda-6'}}

SKIP = re.compile(r'high[- ]voltage|\bHV\b|hybrid|electric (machine|motor|drive)|traction|charg(ing|er)|\bcell\b|e-machine|plug|state of charge \(HV|EV ', re.I)
UNITS = {
    'celsius': '°C', 'fahrenheit': '°F', 'kilometersPerHour': 'km/h', 'milesPerHour': 'mph', 'percent': '%',
    'rpm': 'rpm', 'bars': 'bar', 'kilopascal': 'kPa', 'kilopascals': 'kPa', 'hectopascal': 'hPa', 'pascal': 'Pa', 'psi': 'psi',
    'volts': 'V', 'millivolts': 'mV', 'amps': 'A', 'milliamps': 'mA', 'kilometers': 'km', 'miles': 'mi', 'meters': 'm',
    'centimeters': 'cm', 'millimeters': 'mm', 'liters': 'L', 'milliliters': 'mL', 'gallons': 'gal', 'seconds': 's',
    'milliseconds': 'ms', 'minutes': 'min', 'hours': 'h', 'days': 'days', 'newtonMeters': 'Nm', 'degrees': '°',
    'kilograms': 'kg', 'grams': 'g', 'milligrams': 'mg', 'gramsPerSecond': 'g/s', 'kilogramsPerHour': 'kg/h',
    'litersPerHour': 'L/h', 'watts': 'W', 'kilowatts': 'kW', 'ampereHours': 'Ah', 'kilowattHours': 'kWh', 'scalar': '', 'milliohms': 'mΩ', 'radians': 'rad', 'gravity': 'g', 'gramsPerLiter': 'g/L', 'noyes': 'yesno', 'yesno': 'yesno',
    'normal': '', 'ratio': '', 'lambda': 'λ', 'hertz': 'Hz', 'ohms': 'Ω', 'degreesPerSecond': '°/s',
    'metersPerSecondSquared': 'm/s²', 'gForce': 'g', 'microseconds': 'µs', 'months': 'months', 'years': 'years',
    'onOff': '', 'offon': '', 'unknown': '', 'milligramsPerStroke': 'mg/stroke', 'mgPerStroke': 'mg/stroke',
    'cubicMeters': 'm³', 'nm': 'Nm', 'kilometersPerLiter': 'km/L', 'litersPer100Kilometers': 'L/100 km',
}
seen_units = {}


def clean_name(n: str) -> str | None:
    n = n.strip()
    if not n or ' ' not in n and ('_' in n or n.isupper() or len(n) > 18):
        return None
    if re.match(r'^[A-Za-z0-9]+(_[A-Za-z0-9]+)+$', n):
        return None
    return n[0].upper() + n[1:]


def year_ok(flt, year):
    if not flt:
        return None  # no filter
    if year in (flt.get('years') or []):
        return True
    if 'from' in flt and year >= flt['from'] and ('to' not in flt or year <= flt['to']):
        return True
    if 'to' in flt and 'from' not in flt and year <= flt['to']:
        return True
    return False


CAR_YEAR = {'vag': 2012, 'ford': 2015, 'mazda': 2016}
out = {}
for group, repos in POOLS.items():
    rows = {}
    order = 0
    for repo in repos:
        f = src / f'{repo}.json'
        if not f.exists() or f.stat().st_size < 100:
            continue
        d = json.loads(f.read_text(encoding='utf-8'))
        for c in d.get('commands', []):
            cmd = c.get('cmd', {})
            if '22' not in cmd:
                continue
            hdr = str(c.get('hdr', ''))
            if not re.fullmatch(r'7[0-9A-F]{2}', hdr) or hdr == '7DF':
                continue
            rax = str(c.get('rax') or '')
            if rax and not re.fullmatch(r'7[0-9A-F]{2}', rax):
                continue
            did = str(cmd['22']).upper().zfill(4)
            flt = c.get('filter') or c.get('dbgfilter')
            own = repo in OWN[group]
            yk = year_ok(flt, CAR_YEAR[group]) if own else None
            for s in c.get('signals', []):
                name = clean_name(s.get('name', ''))
                if not name or SKIP.search(name) or SKIP.search(s.get('path') or ''):
                    continue
                if (s.get('path') or '').startswith('Battery.Cells'):
                    continue
                fmt = s['fmt']
                if 'len' not in fmt:
                    continue
                unit = fmt.get('unit', '')
                seen_units[unit] = seen_units.get(unit, 0) + 1
                key = (hdr, did, fmt.get('bix', 0), fmt['len'])
                rank = 0 if yk is True else 1 if yk is None else 2
                prev = rows.get(key)
                if prev and prev['rank'] <= rank:
                    continue
                row = {
                    'rank': rank, 'order': prev['order'] if prev else order,
                    'h': hdr, 'd': did, 'n': name, 'p': (s.get('path') or 'Other').split('.')[0],
                    'b': fmt.get('bix', 0), 'l': fmt['len'], 'u': UNITS.get(unit, unit),
                    'src': repo,
                }
                if rax and int(rax, 16) != int(hdr, 16) + 8:
                    row['r'] = rax
                for k_in, k_out in (('sign', 's'), ('blsb', 'e')):
                    if fmt.get(k_in):
                        row[k_out] = 1
                for k_in, k_out in (('mul', 'm'), ('div', 'v'), ('add', 'a'), ('min', 'lo'), ('max', 'hi'), ('nullmin', 'nlo'), ('nullmax', 'nhi')):
                    if k_in in fmt:
                        row[k_out] = fmt[k_in]
                if 'map' in fmt:
                    row['map'] = {str(k): (v['value'] if isinstance(v, dict) else str(v)) for k, v in fmt['map'].items()}
                rows[key] = row
                order += 1
    lst = sorted(rows.values(), key=lambda r: r['order'])
    # Same name on the same module: keep the first (closest model).
    by_name = {}
    final = []
    for r in lst:
        k = (r['h'], r['n'].lower())
        if k in by_name:
            continue
        by_name[k] = 1
        for k2 in ('rank', 'order'):
            r.pop(k2)
        final.append(r)
    out[group] = final

lines = [
    '// Maker sensors from the OBDb project (https://github.com/OBDb), licence CC BY-SA 4.0.',
    '// Generated by gen_sensors.py from signal sets of this car and its closest relatives;',
    '// closest models first. The sensor finder asks the car for each and keeps what answers.',
    '// Keys: h request header, r reply header (when not h + 8), d data identifier, n name, p group,',
    '// b first bit, l bit length, s signed, e bytes least significant first, m multiply, v divide,',
    '// a add, lo/hi clamp, nlo/nhi no value at or beyond, u unit, map value names, src OBDb repo.',
    '// Each list is built on first use, so the app starts without it.',
    "import type { SensorRow } from '../obd/sensors';",
    '',
]
for g, rows in out.items():
    lines.append(f'let {g}: SensorRow[] | null = null;')
    lines.append(f'export const {g}Sensors = (): SensorRow[] => ({g} ??= [')
    for r in rows:
        lines.append('  ' + json.dumps(r, ensure_ascii=False, separators=(',', ':')) + ',')
    lines.append(']);')
    lines.append('')
(root / 'src/data/sensors.ts').write_text('\n'.join(lines), encoding='utf-8')
for g, rows in out.items():
    hdrs = {}
    for r in rows:
        hdrs[r['h']] = hdrs.get(r['h'], 0) + 1
    dids = len({(r['h'], r['d']) for r in rows})
    print(g, len(rows), 'signals', dids, 'reads', dict(sorted(hdrs.items(), key=lambda x: -x[1])[:14]))
unk = {u: n for u, n in seen_units.items() if u not in UNITS}
print('unmapped units', unk)
print('bytes', (root / 'src/data/sensors.ts').stat().st_size)
