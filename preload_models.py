"""Script pour précharger les modèles avant de lancer l'app."""

print("🔄 Préchargement des modèles...\n")

# 1. Modèle ASR (Whisper fine-tuné)
print("📥 Téléchargement du modèle ASR (whisper-small-rad-FR2)...")
from app import load_asr
asr = load_asr()
print(f"✅ ASR chargé sur {asr.device}\n")

# # 2. Modèle LLM (FLAN-T5-XL)
# print("📥 Téléchargement du modèle LLM (FLAN-T5-XL)...")
# from app import load_summarizer
# model, tokenizer = load_summarizer()
# print(f"✅ LLM chargé sur {model.device}\n")

print("🎉 Tous les modèles sont prêts ! Lance python app.py maintenant.")
