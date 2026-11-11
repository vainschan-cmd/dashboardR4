import sqlite3
import openpyxl
import os

excel_file = '/Users/rekaskuy/.gemini/antigravity/brain/275cc606-d832-47b9-8b21-59e3de4ee300/.user_uploaded/media_1794383563533_bcbb2477.xlsx'
if not os.path.exists(excel_file):
    excel_file = '/Users/rekaskuy/.gemini/antigravity/brain/275cc606-d832-47b9-8b21-59e3de4ee300/.user_uploaded/media_1794383300960_db436734.xlsx'

wb = openpyxl.load_workbook(excel_file, data_only=True)
ws = wb['labarugi']

conn = sqlite3.connect('data/ed_dashboard.db')
cur = conn.cursor()

# 1. Create table module_finansial_entitas
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
cur.execute('CREATE INDEX IF NOT EXISTS idx_mod_fin_ent_filter ON module_finansial_entitas(year, month, rekening, entitas, branch_code);')
cur.execute('DELETE FROM module_finansial_entitas;')

count_entitas = 0
fin_groups = {}

for r in range(2, ws.max_row + 1):
    val_tahun = ws.cell(r, 1).value
    if val_tahun is None:
        continue
    try:
        year = int(val_tahun)
        month = int(ws.cell(r, 2).value)
        kode_cbg = str(ws.cell(r, 3).value or '').strip()
        nm_cbg = str(ws.cell(r, 4).value or '').strip()
        rekening = str(ws.cell(r, 5).value or '').strip()
        entitas = str(ws.cell(r, 6).value or '').strip().upper()
        
        raw_real = ws.cell(r, 7).value
        realisasi = float(raw_real) if raw_real is not None and str(raw_real).strip() not in ('-', '', 'None') else 0.0

        raw_rka = ws.cell(r, 8).value
        rka = float(raw_rka) if raw_rka is not None and str(raw_rka).strip() not in ('-', '', 'None') else None

        raw_yoy = ws.cell(r, 9).value
        yoy = float(raw_yoy) if raw_yoy is not None and str(raw_yoy).strip() not in ('-', '', 'None') else None
    except Exception as e:
        continue

    rec_id = f"mfe_{year}_{month}_{kode_cbg}_{rekening}_{entitas}".replace(' ', '_').lower()
    cur.execute('''
        INSERT OR REPLACE INTO module_finansial_entitas
        (id, year, month, branch_code, branch_name, rekening, entitas, realisasi, rka, yoy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (rec_id, year, month, kode_cbg, nm_cbg, rekening, entitas, realisasi, rka, yoy))
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
print(f"Successfully inserted {count_entitas} rows into module_finansial_entitas")

# 2. Upsert into module_finansial
count_fin = 0
for (year, month, kode_cbg, nm_cbg, rekening), val_map in fin_groups.items():
    cabang = val_map.get('CABANG', 0.0)
    pmt = val_map.get('PMT', 0.0)
    ptp = val_map.get('PTP', 0.0)
    psl = val_map.get('PSL', 0.0)
    pjm = val_map.get('PJM', 0.0)
    eliminasi = val_map.get('ELIMINASI', 0.0)
    konsolidasi = cabang + pmt + ptp + psl + pjm + eliminasi
    yoy_val = val_map.get('yoy') if val_map.get('yoy') is not None else 100.0
    rka_val = val_map.get('rka') if val_map.get('rka') is not None else 100.0

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
            ?, ?, 'labarugi_excel', 'verified', 'admin_regional', datetime('now'), 'bod_regional', datetime('now')
        )
    ''', (
        fin_id, rec_id, year, month, kode_cbg, nm_cbg, rekening,
        cabang, pmt, ptp, psl, pjm, eliminasi, konsolidasi,
        yoy_val, rka_val
    ))
    count_fin += 1

conn.commit()
print(f"Successfully upserted {count_fin} rows into module_finansial")
conn.close()
