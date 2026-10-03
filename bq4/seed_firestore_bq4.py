import os
import random
import uuid
from datetime import datetime, timedelta

# intentar importar firebase_admin para conexion a firestore
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    HAS_FIREBASE = True
except ImportError:
    HAS_FIREBASE = False

# catalogo de las 12 herramientas del diagrama UML de clases de Ark clasificadas por formato (#34)
# Formatos del enum Format del modelo de dominio: TOUCH, VOICE, TEXT, MULTIMEDIA
TOOLS = [
    {"toolId": "custom_breathing", "name": "Breathing Exercise (Custom / 4-7-8 / Box)", "format": "touch"},
    {"toolId": "body_mapping", "name": "Body Mapping Tool", "format": "touch"},
    {"toolId": "haptic_tapping", "name": "Haptic Feedback Tool", "format": "touch"},
    {"toolId": "scream_tank", "name": "Scream Tank Tool", "format": "voice"},
    {"toolId": "blow_it_out", "name": "Blow It Out Tool", "format": "voice"},
    {"toolId": "voice_journal", "name": "Voice Journal Tool", "format": "voice"},
    {"toolId": "emotion_detective", "name": "Emotion Detective Tool", "format": "text"},
    {"toolId": "achievement_jar", "name": "Achievement Jar Tool", "format": "text"},
    {"toolId": "gratitude_notes", "name": "Gratitude Notes Tool", "format": "text"},
    {"toolId": "thought_reframing", "name": "Thought Reframing Tool", "format": "text"},
    {"toolId": "photo_of_the_day", "name": "Photo of the Day Tool", "format": "multimedia"},
    {"toolId": "visual_anchoring", "name": "Visual Anchoring Tool", "format": "multimedia"},
]

# 25 usuarios sinteticos generados con correos gmail.com
REALISTIC_USERS = [
    {"uid": "usr_c8f92a10", "name": "Camila Rodriguez", "email": "camila.rodriguez@gmail.com"},
    {"uid": "usr_e4b17d33", "name": "Santiago Perez", "email": "santiago.perez@gmail.com"},
    {"uid": "usr_9a2b84c1", "name": "Valeria Gomez", "email": "valeria.gomez@gmail.com"},
    {"uid": "usr_1f78c902", "name": "Mateo Hernandez", "email": "mateo.hernandez@gmail.com"},
    {"uid": "usr_53d20a7b", "name": "Mariana Morales", "email": "mariana.morales@gmail.com"},
    {"uid": "usr_7e119bc4", "name": "Alejandro Castro", "email": "alejandro.castro@gmail.com"},
    {"uid": "usr_b940cd61", "name": "Daniela Vargas", "email": "daniela.vargas@gmail.com"},
    {"uid": "usr_32a68f19", "name": "Nicolas Rios", "email": "nicolas.rios@gmail.com"},
    {"uid": "usr_8cd742e5", "name": "Sofia Mendoza", "email": "sofia.mendoza@gmail.com"},
    {"uid": "usr_6bb391f0", "name": "Felipe Sanchez", "email": "felipe.sanchez@gmail.com"},
    {"uid": "usr_a14c297d", "name": "Isabella Ortiz", "email": "isabella.ortiz@gmail.com"},
    {"uid": "usr_f805be4a", "name": "Lucas Navarro", "email": "lucas.navarro@gmail.com"},
    {"uid": "usr_2d9a57c8", "name": "Gabriela Rojas", "email": "gabriela.rojas@gmail.com"},
    {"uid": "usr_47e301ab", "name": "Julian Silva", "email": "julian.silva@gmail.com"},
    {"uid": "usr_90cb68ef", "name": "Lucia Paredes", "email": "lucia.paredes@gmail.com"},
    {"uid": "usr_0b12fe94", "name": "David Torres", "email": "david.torres@gmail.com"},
    {"uid": "usr_63a841d7", "name": "Paula Herrera", "email": "paula.herrera@gmail.com"},
    {"uid": "usr_c57193b2", "name": "Martin Cardenas", "email": "martin.cardenas@gmail.com"},
    {"uid": "usr_18df04ac", "name": "Elena Duarte", "email": "elena.duarte@gmail.com"},
    {"uid": "usr_7429b6f3", "name": "Sebastian Munoz", "email": "sebastian.munoz@gmail.com"},
    {"uid": "usr_e0947a51", "name": "Natalia Vega", "email": "natalia.vega@gmail.com"},
    {"uid": "usr_3b58c219", "name": "Tomas Quintero", "email": "tomas.quintero@gmail.com"},
    {"uid": "usr_82d61f74", "name": "Salome Acosta", "email": "salome.acosta@gmail.com"},
    {"uid": "usr_4fe0593b", "name": "Samuel Espinosa", "email": "samuel.espinosa@gmail.com"},
    {"uid": "usr_a9317c82", "name": "Victoria Molina", "email": "victoria.molina@gmail.com"},
]

def init_firestore():
    # busca credenciales de servicio en la carpeta actual o superior
    possible_paths = [
        "service_account.json",
        "bq4/service_account.json",
        "../service_account.json",
        os.environ.get("SERVICE_ACCOUNT", "")
    ]
    key_path = next((p for p in possible_paths if p and os.path.exists(p)), None)
    if not key_path:
        print("[AVISO] No se encontro service_account.json. Para poblar Firestore coloca el archivo de credenciales.")
        return None

    if not firebase_admin._apps:
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def clean_previous_seed(db):
    print("[INFO] Limpiando registros anteriores de usuarios de prueba (usr_*)...")
    for user in REALISTIC_USERS:
        user_ref = db.collection("users").document(user["uid"])
        # eliminar subcolecciones
        for subcol_name in ["tool_interactions", "mood_checkins", "photos", "tool_feedback"]:
            sub_docs = user_ref.collection(subcol_name).limit(100).get()
            for doc in sub_docs:
                doc.reference.delete()
        user_ref.delete()
    print("[OK] Limpieza de usuarios de prueba completada.")

def seed_firestore(total_interactions=200):
    db = init_firestore()
    if not db:
        print("[INFO] Firestore no disponible. Verifica service_account.json.")
        return

    clean_previous_seed(db)

    print(f"[INFO] Poblando Firestore con {len(REALISTIC_USERS)} usuarios y {total_interactions} interacciones...")
    tools_by_format = {}
    for t in TOOLS:
        tools_by_format.setdefault(t["format"], []).append(t)

    format_weights = {"touch": 0.38, "voice": 0.32, "text": 0.18, "multimedia": 0.12}
    base_time = datetime.now() - timedelta(days=14)

    batch = db.batch()
    count = 0

    for user in REALISTIC_USERS:
        user_ref = db.collection("users").document(user["uid"])
        batch.set(user_ref, {
            "name": user["name"],
            "email": user["email"],
            "is_synthetic_seed": True,
            "createdAt": (base_time - timedelta(days=random.randint(1, 30))).isoformat()
        })

    for i in range(total_interactions):
        user = random.choice(REALISTIC_USERS)
        chosen_format = random.choices(
            list(format_weights.keys()),
            weights=list(format_weights.values()),
            k=1
        )[0]
        tool = random.choice(tools_by_format[chosen_format])
        is_completed = random.random() < 0.88

        random_offset = random.randint(0, 14 * 24 * 3600)
        interaction_time = base_time + timedelta(seconds=random_offset)

        interaction_ref = db.collection("users").document(user["uid"]).collection("tool_interactions").document()
        batch.set(interaction_ref, {
            "userId": user["uid"],
            "toolId": tool["toolId"],
            "tool_format": chosen_format,
            "complete": is_completed,
            "timestamp": interaction_time.isoformat()
        })
        count += 1

        if count % 400 == 0:
            batch.commit()
            batch = db.batch()

    batch.commit()
    print(f"[OK] Firestore poblado exitosamente con {count} registros de interacciones.")

if __name__ == "__main__":
    seed_firestore()
