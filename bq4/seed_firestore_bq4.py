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

# catalogo de las 12 herramientas de ark clasificadas por sus formatos (#34)
TOOLS = [
    {"toolId": "custom_breathing", "name": "Custom Breathing", "format": "touch"},
    {"toolId": "body_mapping", "name": "Body Mapping", "format": "touch"},
    {"toolId": "haptic_tapping", "name": "Haptic Tapping", "format": "touch"},
    {"toolId": "scream_tank", "name": "Scream Tank", "format": "voice"},
    {"toolId": "blow_it_out", "name": "Blow It Out", "format": "voice"},
    {"toolId": "voice_journal", "name": "Voice Journal", "format": "voice"},
    {"toolId": "emotion_detective", "name": "Emotion Detective", "format": "text"},
    {"toolId": "achievement_jar", "name": "Achievement Jar", "format": "text"},
    {"toolId": "gratitude_notes", "name": "Gratitude Notes", "format": "text"},
    {"toolId": "thought_reframing", "name": "Thought Reframing", "format": "text"},
    {"toolId": "photo_of_the_day", "name": "Photo of the Day", "format": "multimedia"},
    {"toolId": "visual_anchoring", "name": "Visual Anchoring", "format": "multimedia"},
]

# 25 usuarios con nombres y uids realistas
REALISTIC_USERS = [
    {"uid": "usr_c8f92a10", "name": "Camila Rodriguez", "email": "camila.rodriguez@uniandes.edu.co"},
    {"uid": "usr_e4b17d33", "name": "Santiago Perez", "email": "santiago.perez@uniandes.edu.co"},
    {"uid": "usr_9a2b84c1", "name": "Valeria Gomez", "email": "valeria.gomez@uniandes.edu.co"},
    {"uid": "usr_1f78c902", "name": "Mateo Hernandez", "email": "mateo.hernandez@uniandes.edu.co"},
    {"uid": "usr_53d20a7b", "name": "Mariana Morales", "email": "mariana.morales@uniandes.edu.co"},
    {"uid": "usr_7e119bc4", "name": "Alejandro Castro", "email": "alejandro.castro@uniandes.edu.co"},
    {"uid": "usr_b940cd61", "name": "Daniela Vargas", "email": "daniela.vargas@uniandes.edu.co"},
    {"uid": "usr_32a68f19", "name": "Nicolas Rios", "email": "nicolas.rios@uniandes.edu.co"},
    {"uid": "usr_8cd742e5", "name": "Sofia Mendoza", "email": "sofia.mendoza@uniandes.edu.co"},
    {"uid": "usr_6bb391f0", "name": "Felipe Sanchez", "email": "felipe.sanchez@uniandes.edu.co"},
    {"uid": "usr_a14c297d", "name": "Isabella Ortiz", "email": "isabella.ortiz@uniandes.edu.co"},
    {"uid": "usr_f805be4a", "name": "Lucas Navarro", "email": "lucas.navarro@uniandes.edu.co"},
    {"uid": "usr_2d9a57c8", "name": "Gabriela Rojas", "email": "gabriela.rojas@uniandes.edu.co"},
    {"uid": "usr_47e301ab", "name": "Julian Silva", "email": "julian.silva@uniandes.edu.co"},
    {"uid": "usr_90cb68ef", "name": "Lucia Paredes", "email": "lucia.paredes@uniandes.edu.co"},
    {"uid": "usr_0b12fe94", "name": "David Torres", "email": "david.torres@uniandes.edu.co"},
    {"uid": "usr_63a841d7", "name": "Paula Herrera", "email": "paula.herrera@uniandes.edu.co"},
    {"uid": "usr_c57193b2", "name": "Martin Cardenas", "email": "martin.cardenas@uniandes.edu.co"},
    {"uid": "usr_18df04ac", "name": "Elena Duarte", "email": "elena.duarte@uniandes.edu.co"},
    {"uid": "usr_7429b6f3", "name": "Sebastian Munoz", "email": "sebastian.munoz@uniandes.edu.co"},
    {"uid": "usr_e0947a51", "name": "Natalia Vega", "email": "natalia.vega@uniandes.edu.co"},
    {"uid": "usr_3b58c219", "name": "Tomas Quintero", "email": "tomas.quintero@uniandes.edu.co"},
    {"uid": "usr_82d61f74", "name": "Salome Acosta", "email": "salome.acosta@uniandes.edu.co"},
    {"uid": "usr_4fe0593b", "name": "Samuel Espinosa", "email": "samuel.espinosa@uniandes.edu.co"},
    {"uid": "usr_a9317c82", "name": "Victoria Molina", "email": "victoria.molina@uniandes.edu.co"},
]

def init_firestore():
    # busca credenciales de servicio en la carpeta actual o superior
    possible_paths = [
        "service_account.json",
        "../service_account.json",
        os.environ.get("SERVICE_ACCOUNT", "")
    ]
    key_path = next((p for p in possible_paths if p and os.path.exists(p)), None)
    if not key_path:
        print("[AVISO] No se encontro service_account.json. Para poblar Firestore en la nube coloca el archivo en esta carpeta.")
        return None

    if not firebase_admin._apps:
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def seed_firestore(total_interactions=200):
    db = init_firestore()
    if not db:
        print("[INFO] Generando dataset local...")
        return

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
