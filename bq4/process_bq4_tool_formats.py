import os
from datetime import datetime, timedelta
import pandas as pd
from seed_data_generator import generate_completed_sessions

# id de la carpeta de google drive compartida para guardar el consolidado
GOOGLE_DRIVE_FOLDER_ID = "1QMOSYNYalN3F55nZsIYeSCbHaRuVXAjs"
SHEET_NAME = "bq4_tool_formats_aggregated"

def get_firestore_interactions():
    # lee directamente de cloud firestore si hay service_account.json
    possible_paths = ["service_account.json", "../service_account.json", os.environ.get("SERVICE_ACCOUNT", "")]
    key_path = next((p for p in possible_paths if p and os.path.exists(p)), None)
    if not key_path:
        return None

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        if not firebase_admin._apps:
            cred = credentials.Certificate(key_path)
            firebase_admin.initialize_app(cred)
        db = firestore.client()

        records = []
        # coleccion grupal tool_interactions
        interactions = db.collection_group("tool_interactions").stream()
        for doc in interactions:
            data = doc.to_dict()
            records.append({
                "tool_id": data.get("toolId", ""),
                "tool_format": data.get("tool_format", "touch"),
                "complete": data.get("complete", True),
                "timestamp": str(data.get("timestamp", ""))
            })
        if records:
            return pd.DataFrame(records)
    except Exception as e:
        print(f"[AVISO] No se pudo consultar Firestore directamente ({e}), usando datos locales.")
    return None

def sync_to_google_drive(df):
    # escribe o actualiza la hoja de calculo en google drive usando gspread
    possible_paths = ["service_account.json", "../service_account.json", os.environ.get("SERVICE_ACCOUNT", "")]
    key_path = next((p for p in possible_paths if p and os.path.exists(p)), None)
    if not key_path:
        print("[INFO] Para sincronizar en vivo a Google Drive, coloca service_account.json.")
        return False

    try:
        import gspread
        gc = gspread.service_account(filename=key_path)
        
        # intentar abrir o crear el sheet en la carpeta de drive
        try:
            sh = gc.open(SHEET_NAME)
        except gspread.SpreadsheetNotFound:
            sh = gc.create(SHEET_NAME, folder_id=GOOGLE_DRIVE_FOLDER_ID)
            print(f"[OK] Google Sheet creado en Drive: {sh.url}")

        worksheet = sh.get_worksheet(0)
        worksheet.clear()
        
        # escribir encabezados y filas
        values = [df.columns.values.tolist()] + df.values.tolist()
        worksheet.update(values=values)
        print(f"[OK] Google Sheet actualizado en Drive en tiempo real: {sh.url}")
        return True
    except Exception as e:
        print(f"[AVISO] Error al escribir en Google Drive ({e}). Se guardo copia local en CSV.")
        return False

def process_bq4_tool_formats(output_csv="bq4_tool_formats_aggregated.csv"):
    print("[INFO] Ejecutando procesamiento batch para BQ4...")
    
    # 1. obtener datos (desde Firestore o simulacion)
    df = get_firestore_interactions()
    if df is None or df.empty:
        df = generate_completed_sessions(num_records=200)

    # 2. filtrar solo sesiones completadas con exito (complete == True)
    completed = df[df["complete"] == True]

    # 3. agrupar y contar por formato
    aggregated = completed.groupby("tool_format").agg(
        total_completions=("tool_id", "count")
    ).reset_index()

    # 4. calcular porcentaje de participacion
    total = aggregated["total_completions"].sum()
    aggregated["completion_percentage"] = ((aggregated["total_completions"] / total) * 100).round(2)

    # 5. timestamps de ejecucion batch
    now = datetime.now()
    next_batch = now + timedelta(days=1)
    aggregated["last_updated"] = now.strftime("%Y-%m-%d %H:%M:%S")
    aggregated["next_update"] = next_batch.strftime("%Y-%m-%d 00:00:00")

    # 6. ordenar de mayor a menor completitud
    aggregated = aggregated.sort_values(by="total_completions", ascending=False)

    # 7. guardar copia local
    aggregated.to_csv(output_csv, index=False)
    print(f"[OK] Consolidado local guardado en: {output_csv}")
    print("\n" + aggregated.to_string(index=False) + "\n")

    # 8. sincronizar a Google Drive si hay credenciales
    sync_to_google_drive(aggregated)
    return aggregated

if __name__ == "__main__":
    process_bq4_tool_formats()
