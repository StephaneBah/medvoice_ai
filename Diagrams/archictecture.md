flowchart LR
    subgraph Client ["Interface Médecin"]
        UI[("Interface React")]
        Rec["Audio Recording Module"]
    end

    subgraph Server ["Backend API (FastAPI)"]
        API["API Manager"]
        
        subgraph AI_Core ["Cœur IA Intelligence"]
            ASR["Whisper Small Adapted"]
            
            subgraph LLM_Pipeline ["LLM & Raisonnement"]
                LLM["Mistral Large"]
                CoT["Pipeline Chain of Thought<br/>(Diarisation|Correction)"]
            end
        end
        
        DB[("Storage Session")]
    end

    User(("Médecin")) -->|Dictée / Consultation| UI
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