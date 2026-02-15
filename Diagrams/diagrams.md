# Diagrammes Architecture - MedVoice AI

Mise à jour suite à l'implémentation du Backend FastAPI.

Le système expose deux modes principaux :
1. **Conversation** : Dialogue Médecin/Patient → Rapport SOAP.
2. **Scribe** : Dictée du médecin → Transcription corrigée.

---

## 1. Architecture Système (Haut Niveau)

Vue d'ensemble de la solution MedVoice AI, montrant les flux de données entre le Médecin, l'Application et les Modèles IA.

```mermaid
flowchart LR
    subgraph Client ["Interface Médecin (Frontend)"]
        UI[("Interface React")]
        Rec["Module Enregistrement\n(MediaRecorder)"]
    end

    subgraph Server ["Backend API (FastAPI)"]
        API["API Manager"]
        
        subgraph AI_Core ["Cœur IA Intelligence"]
            ASR["ASR Engine\n(Whisper Small Rad FR2)"]
            
            subgraph LLM_Pipeline ["LLM & Raisonnement"]
                LLM["LLM Engine\n(Mistral Large)"]
                CoT["Pipeline CoT\n(Ponctuation -> Diarisation -> Correction)"]
            end
        end
        
        DB[("Storage Session")]
    end

    User(("\n      Médecin      \n")) -->|Dictée / Consultation| UI
    UI -->|Flux Audio| API
    API -->|Audio| ASR
    ASR -->|Transcription Brute| CoT
    CoT -->|Prompt Engineering| LLM
    LLM -->|Texte Structuré| CoT
    CoT -->|Rapport Final| API
    API -->|Rapport PDF/JSON| UI
    API <-->|Persistance| DB

    style ASR fill:#e67e22,stroke:#d35400,color:white
    style LLM fill:#9b59b6,stroke:#8e44ad,color:white
    style CoT fill:#3498db,stroke:#2980b9,color:white
    style API fill:#2ecc71,stroke:#27ae60,color:white
```

---

## 2. Flux de Traitement Intelligent (CoT)

Détail du pipeline de traitement selon le cas d'usage, mettant en avant la logique **Chain of Thought**.

```mermaid
flowchart TD
    Start(["Input Audio"]) --> Router{Type de Session ?}

    %% Branched Flow
    Router -- "Mode Conversation\n(Médecin + Patient)" --> Pipe1
    Router -- "Mode Scribe\n(Dictée Seule)" --> Pipe2

    %% Pipeline 1
    subgraph Pipe1 ["Flux Consultation (SOAP)"]
        direction TB
        Step1_A["1. Transcription Audio\n(Whisper FR2)"]
        Step1_B["2. Ponctuation & Segmentation\n(LLM)"]
        Step1_C["3. Diarisation Médicale\n(Qui parle ? Médecin/Patient)"]
        Step1_D["4. Structuration SOAP\n(Subjectif/Objectif/Analyse/Plan)"]
        
        Step1_A --> Step1_B --> Step1_C --> Step1_D
    end

    %% Pipeline 2
    subgraph Pipe2 ["Flux Scribe (Documentation)"]
        direction TB
        Step2_A["1. Transcription Audio\n(Whisper FR2)"]
        Step2_B["2. Ponctuation Avancée\n(LLM)"]
        Step2_C["3. Correction Terminologique\n(Jargon Médical & Syntaxe)"]
        Step2_D["4. Mise en Forme Documentaire\n(Markdown Structuré)"]
        
        Step2_A --> Step2_B --> Step2_C --> Step2_D
    end

    Step1_D --> Output1(["Rapport Clinique Structuré"])
    Step2_D --> Output2(["Compte Rendu Corrigé"])

    style Step1_A fill:#f39c12,stroke:#d35400,color:white
    style Step2_A fill:#f39c12,stroke:#d35400,color:white
    
    style Step1_D fill:#27ae60,stroke:#2ecc71,color:white
```

---

## 3. Diagramme de Classes (Modèle de Données)

Reflet du modèle SQLAlchemy et des types Pydantic implémentés.

```mermaid
classDiagram
    direction LR

    class Session {
        +UUID id
        +String type
        +String status
        +DateTime created_at
        +String audio_filename
        +JSON report_content
    }
    
    class TranscriptionData {
        +String raw_transcription
        +String punctuated_text
        +String diarized_text
        +String corrected_text
    }
    
    class MedicalReportContent {
        +String clinicalIndication
        +String findings
        +String impression
        +String recommendations
    }
    
    class DocumentationContent {
        +String title
        +String correctedText
    }
    
    %% Relations
    Session "1" *-- "1" TranscriptionData : contains stages
    Session "1" *-- "0..1" MedicalReportContent : produces (Conversation)
    Session "1" *-- "0..1" DocumentationContent : produces (Scribe)

    %% Notes
    note for Session "Type: 'conversation' | 'scribe'"
    note for TranscriptionData "Stores results of each CoT step"
```
