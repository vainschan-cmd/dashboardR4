import sqlite3
import re

# Connect to database
conn = sqlite3.connect('data/ed_dashboard.db')
cur = conn.cursor()

# Ensure table exists
cur.execute('''
CREATE TABLE IF NOT EXISTS module_finansial_entitas (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  branch_code TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  rekening TEXT NOT NULL,
  entitas TEXT NOT NULL,
  realisasi REAL NOT NULL,
  rka REAL,
  yoy REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
''')

# Clear existing rows in module_finansial_entitas if re-running
cur.execute('DELETE FROM module_finansial_entitas;')

raw_csv_path = 'data/keuangan_konsolidasi.csv'
with open(raw_csv_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

header = lines[0].strip().split(',')
count_entitas = 0

# Also collect grouped records for module_finansial:
# Key: (year, month, branch_code, branch_name, rekening) -> { CABANG: val, PMT: val, PTP: val, PSL: val, PJM: val, ELIMINASI: val, rka: val, yoy: val }
fin_groups = {}

for line in lines[1:]:
    line = line.strip()
    if not line:
        continue
    parts = line.split(',')
    if len(parts) < 7:
        continue
    # TAHUN,BULAN,KODE_CBG,NM_CBG,REKENING,ENTITAS,REALISASI,RKA,YOY
    try:
        year = int(parts[0])
        month = int(parts[1])
        kode_cbg = parts[2].strip()
        nm_cbg = parts[3].strip()
        rekening = parts[4].strip()
        entitas = parts[5].strip().upper()
        realisasi = float(parts[6])
        rka = float(parts[7]) if len(parts) > 7 and parts[7] != '-' and parts[7] != '' else None
        yoy = float(parts[8]) if len(parts) > 8 and parts[8] != '-' and parts[8] != '' else None
    except Exception as e:
        # End of CSV data or header row of pivot table
        break

    record_id = f"mfe_{year}_{month}_{kode_cbg}_{rekening}_{entitas}".replace(' ', '_').lower()
    cur.execute('''
        INSERT OR REPLACE INTO module_finansial_entitas 
        (id, year, month, branch_code, branch_name, rekening, entitas, realisasi, rka, yoy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (record_id, year, month, kode_cbg, nm_cbg, rekening, entitas, realisasi, rka, yoy))
    count_entitas += 1

    group_key = (year, month, kode_cbg, nm_cbg, rekening)
    if group_key not in fin_groups:
        fin_groups[group_key] = {
            'CABANG': 0.0,
            'PMT': 0.0,
            'PTP': 0.0,
            'PSL': 0.0,
            'PJM': 0.0,
            'ELIMINASI': 0.0,
            'rka': rka,
            'yoy': yoy
        }
    fin_groups[group_key][entitas] = realisasi
    if rka is not None:
        fin_groups[group_key]['rka'] = rka
    if yoy is not None:
        fin_groups[group_key]['yoy'] = yoy

conn.commit()
print(f"Inserted {count_entitas} rows into module_finansial_entitas")

# Now update / insert into module_finansial so existing APIs / SQLite queries are also populated
count_fin = 0
for (year, month, kode_cbg, nm_cbg, rekening), val_map in fin_groups.items():
    cabang = val_map.get('CABANG', 0.0)
    pmt = val_map.get('PMT', 0.0)
    ptp = val_map.get('PTP', 0.0)
    psl = val_map.get('PSL', 0.0)
    pjm = val_map.get('PJM', 0.0)
    eliminasi = val_map.get('ELIMINASI', 0.0)
    konsolidasi = cabang + pmt + ptp + psl + pjm + eliminasi
    yoy_val = val_map.get('yoy') or 100.0
    rka_val = val_map.get('rka') or 100.0

    fin_id = f"mod_fin_{year}_{month}_{kode_cbg}_{rekening}".replace(' ', '_').lower()
    rec_id = f"rec_fin_{year}_{month}_{kode_cbg}_{rekening}".replace(' ', '_').lower()

    cur.execute('''
        INSERT OR REPLACE INTO module_finansial (
            id, monthly_record_id, year, month, branch_code, branch_name, rekening,
            cabang_rp, pmt_rp, ptp_rp, psl_rp, pjm_rp, eliminasi_rp, konsolidasi_rp,
            yoy, rka, source_type, verification_status, uploaded_by, uploaded_at, verified_by, verified_at
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, 'spreadsheet_csv', 'verified', 'admin_regional', datetime('now'), 'bod_regional', datetime('now')
        )
    ''', (
        fin_id, rec_id, year, month, kode_cbg, nm_cbg, rekening,
        cabang, pmt, ptp, psl, pjm, eliminasi, konsolidasi,
        yoy_val, rka_val
    ))
    count_fin += 1

conn.commit()
print(f"Upserted {count_fin} aggregated rows into module_finansial")
