
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const reportSchema = {
  type: Type.OBJECT,
  properties: {
    clinicalIndication: { type: Type.STRING, description: "Contexte clinique" },
    findings: { type: Type.STRING, description: "Observations détaillées" },
    impression: { type: Type.STRING, description: "Conclusion diagnostique" },
    recommendations: { type: Type.STRING, description: "Recommandations" }
  },
  required: ["clinicalIndication", "findings", "impression", "recommendations"]
};

const documentationSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Titre suggestif du document" },
    sections: {
      type: Type.ARRAY,
      description: "Liste de sections structurées (ex: Identification, Synthèse, Transcription)",
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Titre de la section (ex: SYNTHÈSE)" },
          content: { type: Type.STRING, description: "Contenu nettoyé de la section" }
        },
        required: ["label", "content"]
      }
    }
  },
  required: ["title", "sections"]
};

export const generateMedicalReport = async (transcription: string, examType: string, source: DocumentSource) => {
  try {
    const isConsultation = source === 'consultation';
    
    const prompt = isConsultation 
      ? `Tu es un radiologue expert. Transforme la transcription suivante en un RAPPORT MÉDICAL STRUCTURÉ professionnel pour un examen de type: ${examType}. Transcription brute: "${transcription}"`
      : `Tu es un assistant médical expert. Nettoie et STRUCTURE la transcription suivante en sections logiques (ex: IDENTIFICATION, SYNTHÈSE, TRANSCRIPTION). Ne change pas le sens, mais corrige la forme, la ponctuation et l'orthographe médicale. Type d'examen: ${examType}. Transcription brute: "${transcription}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: isConsultation ? reportSchema : documentationSchema,
        systemInstruction: isConsultation 
          ? "Tu es un assistant médical spécialisé en radiologie. Utilise un ton formel et précis."
          : "Tu es un expert en transcription médicale. Ton but est de rendre un texte lisible et élégamment structuré en blocs thématiques."
      },
    });

    if (!response.text) throw new Error("No response text");
    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Error generating report/transcription:", error);
    throw error;
  }
};
