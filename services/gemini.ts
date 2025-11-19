import { GoogleGenAI, Type } from "@google/genai";
import { ResearchPlan, ResearchStep, Source } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- AGENT 1: PLANNER ---
// Generates a structured research plan based on the topic.
export const createResearchPlan = async (topic: string): Promise<ResearchPlan> => {
  const model = 'gemini-2.5-flash';
  
  const response = await ai.models.generateContent({
    model,
    contents: `You are a Senior Research Planner.
    The user wants to research: "${topic}".
    Break this down into 3 to 5 distinct, search-friendly research steps/questions.
    Each step should focus on a different aspect (e.g., history, technical details, market trends, pros/cons).
    Return a JSON object.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                query: { type: Type.STRING, description: "A specific search query for this step" }
              },
              required: ["query"]
            }
          }
        }
      }
    }
  });

  const json = JSON.parse(response.text || '{"steps": []}');
  
  // Map to our internal type
  return {
    topic,
    steps: json.steps.map((s: any, i: number) => ({
      id: `step-${i}`,
      query: s.query,
      status: 'pending'
    }))
  };
};

// --- AGENT 2: RESEARCHER ---
// Executes a single step using Search Grounding.
export const executeResearchStep = async (
  step: ResearchStep
): Promise<{ finding: string; sources: Source[] }> => {
  const model = 'gemini-2.5-flash';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Conduct thorough research on this specific query: "${step.query}".
      Summarize the key facts, figures, and details found. Be concise but information-dense.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const finding = response.text || "No information found.";
    
    // Extract sources
    const sources: Source[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
        groundingChunks.forEach((chunk: any) => {
            if (chunk.web && chunk.web.uri && chunk.web.title) {
                sources.push({ title: chunk.web.title, uri: chunk.web.uri });
            }
        });
    }

    return { finding, sources };

  } catch (error) {
    console.error("Research step failed", error);
    return { finding: "Failed to fetch info for this step.", sources: [] };
  }
};

// --- AGENT 3: REPORTER ---
// Synthesizes all findings into a final report.
export const generateFinalReportStream = async (
  topic: string,
  completedSteps: ResearchStep[],
  onChunk: (text: string) => void
) => {
  const model = 'gemini-2.5-flash';
  
  // Compile context from researcher
  const researchContext = completedSteps.map(step => `
    ### Source: ${step.query}
    ${step.finding}
  `).join('\n\n');

  const systemInstruction = `
    You are an advanced Research Reporter.
    Your goal is to write a comprehensive, professional Markdown report on: "${topic}".
    
    Use the provided "Research Notes" to write the report.
    
    Structure:
    1. Title (# Title)
    2. Executive Summary
    3. Detailed Analysis (Use headers based on the research aspects)
    4. Conclusion
    
    - Use bolding for key terms.
    - Use bullet points for readability.
    - If the notes have conflicting info, mention it.
    - Do not invent information not present in the notes or general knowledge.
  `;

  const responseStream = await ai.models.generateContentStream({
    model: model,
    contents: [
      { role: 'user', parts: [{ text: `Research Notes:\n${researchContext}\n\nWrite the full report now.` }] }
    ],
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.7,
    }
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      onChunk(chunk.text);
    }
  }
};