# Notes de Clarification - MedVoice AI

## Deux Cas d'Utilisation Distincts

Le système MedVoice AI propose **deux modes de fonctionnement** bien différenciés :

---

### Cas 1 : Rapport de Consultation (Format SOAP)

**Contexte** : Une conversation entre le médecin et le patient est enregistrée.

**Pipeline** :
1. Enregistrement audio de la conversation (dialogue)
2. Transcription ASR (Whisper FR2)
3. **Diarisation** : Identification des locuteurs (Médecin vs Patient)
4. **Génération automatique d'un rapport structuré format SOAP** :
   - **S**ubjectif : Ce que le patient rapporte
   - **O**bjectif : Observations cliniques du médecin
   - **A**ssessment : Diagnostic/évaluation
   - **P**lan : Plan de traitement
5. Édition et validation du rapport par le médecin
6. Export PDF

**Livrable** : Un **rapport de consultation structuré (SOAP)**.

---

### Cas 2 : Documentation Médicale (Scribe)

**Contexte** : Le médecin dicte ses notes, observations ou conclusions (monologue).

**Pipeline** :
1. Enregistrement audio de la dictée du médecin
2. Transcription ASR (Whisper FR2)
3. **Ponctuation** via LLM
4. **Correction médicale** via LLM (jargon, noms propres, acronymes)
5. Édition et validation de la transcription par le médecin
6. Sauvegarde du document

**Livrable** : Une **transcription corrigée et propre** (pas de génération de rapport).

---

## Différence Clé

| Aspect | Cas 1 : Rapport SOAP | Cas 2 : Scribe |
|--------|---------------------|----------------|
| Type d'audio | Dialogue (2+ locuteurs) | Monologue (1 locuteur) |
| Diarisation | Oui (obligatoire) | Non |
| Génération rapport | Oui (SOAP structuré) | Non |
| Livrable final | Rapport médical | Transcription corrigée |