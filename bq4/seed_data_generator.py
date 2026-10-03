import random
from datetime import datetime, timedelta
import pandas as pd

# catalogo de las 12 herramientas de ark con sus formatos segun la arquitectura (#34)
TOOLS = [
    {"toolId": "custom_breathing", "name": "Custom Breathing", "format": "touch", "category": "breathing_regulation"},
    {"toolId": "body_mapping", "name": "Body Mapping", "format": "touch", "category": "grounding_mindfulness"},
    {"toolId": "haptic_tapping", "name": "Haptic Tapping", "format": "touch", "category": "grounding_mindfulness"},
    {"toolId": "scream_tank", "name": "Scream Tank", "format": "voice", "category": "somatic_release"},
    {"toolId": "blow_it_out", "name": "Blow It Out", "format": "voice", "category": "somatic_release"},
    {"toolId": "voice_journal", "name": "Voice Journal", "format": "voice", "category": "emotional_awareness"},
    {"toolId": "emotion_detective", "name": "Emotion Detective", "format": "text", "category": "emotional_awareness"},
    {"toolId": "achievement_jar", "name": "Achievement Jar", "format": "text", "category": "behavioral_activation"},
    {"toolId": "gratitude_notes", "name": "Gratitude Notes", "format": "text", "category": "behavioral_activation"},
    {"toolId": "thought_reframing", "name": "Thought Reframing", "format": "text", "category": "emotional_awareness"},
    {"toolId": "photo_of_the_day", "name": "Photo of the Day", "format": "multimedia", "category": "behavioral_activation"},
    {"toolId": "visual_anchoring", "name": "Visual Anchoring", "format": "multimedia", "category": "grounding_mindfulness"},
]

USERS = [f"user_{i:03d}" for i in range(1, 26)]

def generate_completed_sessions(num_records=200):
    # genera sesiones simuladas midiendo unicamente la completitud de cada formato
    records = []
    base_time = datetime.now() - timedelta(days=14)
    format_weights = {"touch": 0.38, "voice": 0.32, "text": 0.18, "multimedia": 0.12}

    tools_by_format = {}
    for t in TOOLS:
        tools_by_format.setdefault(t["format"], []).append(t)

    for i in range(num_records):
        user_id = random.choice(USERS)
        chosen_format = random.choices(
            list(format_weights.keys()),
            weights=list(format_weights.values()),
            k=1
        )[0]
        tool = random.choice(tools_by_format[chosen_format])
        is_completed = random.random() < 0.88

        random_offset = random.randint(0, 14 * 24 * 3600)
        interaction_time = base_time + timedelta(seconds=random_offset)

        records.append({
            "user_id": user_id,
            "tool_id": tool["toolId"],
            "tool_format": chosen_format,
            "complete": is_completed,
            "timestamp": interaction_time.strftime("%Y-%m-%d %H:%M:%S")
        })

    return pd.DataFrame(records)
