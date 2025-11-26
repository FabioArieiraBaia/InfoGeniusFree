/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio, ComplexityLevel, VisualStyle, ResearchResult, SearchResultItem, Language } from "../types";

// Store custom keys provided by the user
let customKeys: string[] = [];

export const setApiKeys = (keys: string[]) => {
  customKeys = keys.filter(k => k.trim().length > 0);
};

// Helper to create AI instance with a specific key
const createAi = (key?: string) => {
  return new GoogleGenAI({ apiKey: key || process.env.API_KEY });
};

// Wrapper to handle key rotation and retries
const executeWithRetry = async <T>(operation: (ai: GoogleGenAI) => Promise<T>): Promise<T> => {
  // If no custom keys, just use the environment default (system account)
  if (customKeys.length === 0) {
    return operation(createAi());
  }

  let lastError: any;

  // Try each custom key in order
  for (const key of customKeys) {
    try {
      const ai = createAi(key);
      return await operation(ai);
    } catch (err: any) {
      lastError = err;
      
      // Check if error is related to quota, permissions, or validity
      const isRetryable = 
        err.message?.includes('429') || // Too Many Requests
        err.message?.includes('403') || // Permission Denied
        err.message?.includes('quota') || 
        err.message?.includes('key') ||
        err.message?.includes('PERMISSION_DENIED') ||
        err.message?.includes('RESOURCE_EXHAUSTED');

      if (!isRetryable) {
        throw err; // Don't retry for other errors (e.g. bad request, safety filter)
      }
      
      console.warn(`API Key failed, rotating to next key... (${err.message})`);
      // Continue loop to try next key
    }
  }

  // If we ran out of keys or all failed
  throw lastError || new Error("All API keys failed.");
};

// Use Gemini 2.5 Flash as it is widely available and performant
const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const EDIT_MODEL = 'gemini-2.5-flash-image';

const getLevelInstruction = (level: ComplexityLevel): string => {
  switch (level) {
    case 'Elementary':
      return "Target Audience: Elementary School (Ages 6-10). Style: Bright, simple, fun. Use large clear icons and very minimal text labels. Explanation tone: Storytelling, very simple words.";
    case 'High School':
      return "Target Audience: High School. Style: Standard Textbook. Clean lines, clear labels, accurate maps or diagrams. Explanation tone: Educational, structured, definitions of key terms.";
    case 'College':
      return "Target Audience: University. Style: Academic Journal. High detail, data-rich, precise cross-sections or complex schematics. Explanation tone: Academic, detailed analysis, historical context.";
    case 'Expert':
      return "Target Audience: Industry Expert. Style: Technical Blueprint/Schematic. Extremely dense detail, monochrome or technical coloring, precise annotations. Explanation tone: Technical whitepaper, high density of information.";
    default:
      return "Target Audience: General Public. Style: Clear and engaging.";
  }
};

const getStyleInstruction = (style: VisualStyle): string => {
  switch (style) {
    case 'Minimalist': return "Aesthetic: Bauhaus Minimalist. Flat vector art, limited color palette (2-3 colors), reliance on negative space and simple geometric shapes.";
    case 'Realistic': return "Aesthetic: Photorealistic Composite. Cinematic lighting, 8k resolution, highly detailed textures. Looks like a photograph.";
    case 'Cartoon': return "Aesthetic: Educational Comic. Vibrant colors, thick outlines, expressive cel-shaded style.";
    case 'Vintage': return "Aesthetic: 19th Century Scientific Lithograph. Engraving style, sepia tones, textured paper background, fine hatch lines.";
    case 'Futuristic': return "Aesthetic: Cyberpunk HUD. Glowing neon blue/cyan lines on dark background, holographic data visualization, 3D wireframes.";
    case '3D Render': return "Aesthetic: 3D Isometric Render. Claymorphism or high-gloss plastic texture, studio lighting, soft shadows, looks like a physical model.";
    case 'Sketch': return "Aesthetic: Da Vinci Notebook. Ink on parchment sketch, handwritten annotations style, rough but accurate lines.";
    default: return "Aesthetic: High-quality digital scientific illustration. Clean, modern, highly detailed.";
  }
};

export const researchTopicForPrompt = async (
  topic: string, 
  level: ComplexityLevel, 
  style: VisualStyle,
  language: Language
): Promise<ResearchResult> => {
  
  return executeWithRetry(async (ai) => {
    const levelInstr = getLevelInstruction(level);
    const styleInstr = getStyleInstruction(style);

    const systemPrompt = `
      You are an expert visual researcher and scientific writer.
      Your goal is to research the topic: "${topic}" and create a plan for an infographic AND a written explanatory article.
      
      **IMPORTANT: Use the Google Search tool to find the most accurate, up-to-date information about this topic.**
      
      Context:
      ${levelInstr}
      ${styleInstr}
      Language: ${language} (Write ALL text in this language)
      
      Please provide your response in the following format EXACTLY:
      
      FACTS:
      - [Fact 1]
      - [Fact 2]
      - [Fact 3]
      
      ARTICLE:
      [Write a comprehensive explanatory article about the topic suitable for the target audience. 
      Use Markdown formatting. 
      Include a Title. 
      Structure it with an Introduction, Key Concepts/Details, and Conclusion. 
      Make it informative and educational.]

      IMAGE_PROMPT:
      [A highly detailed image generation prompt describing the visual composition, colors, and layout for the infographic. Do not include citations in the prompt.]
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: systemPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";
    
    // Parse Facts
    const factsMatch = text.match(/FACTS:\s*([\s\S]*?)(?=ARTICLE:|IMAGE_PROMPT:|$)/i);
    const factsRaw = factsMatch ? factsMatch[1].trim() : "";
    const facts = factsRaw.split('\n')
      .map(f => f.replace(/^-\s*/, '').trim())
      .filter(f => f.length > 0)
      .slice(0, 5);

    // Parse Article
    const articleMatch = text.match(/ARTICLE:\s*([\s\S]*?)(?=IMAGE_PROMPT:|$)/i);
    const articleContent = articleMatch ? articleMatch[1].trim() : "Conteúdo explicativo não gerado.";

    // Parse Prompt
    const promptMatch = text.match(/IMAGE_PROMPT:\s*([\s\S]*?)$/i);
    const imagePrompt = promptMatch ? promptMatch[1].trim() : `Create a detailed infographic about ${topic}. ${levelInstr} ${styleInstr}`;

    // Extract Grounding (Search Results)
    const searchResults: SearchResultItem[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach(chunk => {
        if (chunk.web?.uri && chunk.web?.title) {
          searchResults.push({
            title: chunk.web.title,
            url: chunk.web.uri
          });
        }
      });
    }

    // Remove duplicates based on URL
    const uniqueResults = Array.from(new Map(searchResults.map(item => [item.url, item])).values());

    return {
      imagePrompt: imagePrompt,
      facts: facts,
      searchResults: uniqueResults,
      articleContent: articleContent
    };
  });
};

export const generateInfographicImage = async (prompt: string): Promise<string> => {
  return executeWithRetry(async (ai) => {
    // Use Gemini 2.5 Flash Image for generation
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: {
        parts: [{ text: prompt }]
      },
    });

    // Check all parts for image data as 2.5 Flash Image can return mixed content
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                 return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("Failed to generate image");
  });
};

export const fixInfographicImage = async (currentImageBase64: string, correctionPrompt: string): Promise<string> => {
  return executeWithRetry(async (ai) => {
    const cleanBase64 = currentImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const prompt = `
      Edit this image. 
      Goal: Simplify and Fix.
      Instruction: ${correctionPrompt}.
      Ensure the design is clean and any text is large and legible.
    `;

    const response = await ai.models.generateContent({
      model: EDIT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          { text: prompt }
        ]
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                 return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("Failed to fix image");
  });
};

export const editInfographicImage = async (currentImageBase64: string, editPrompt: string): Promise<string> => {
  return executeWithRetry(async (ai) => {
    const cleanBase64 = currentImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    
    // We need to determine mimeType. Assuming typical base64 strings from data URL.
    // If it starts with data:image/png;base64,... mimeType is image/png
    let mimeType = 'image/png';
    const match = currentImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (match) {
        mimeType = match[1];
    }

    const response = await ai.models.generateContent({
      model: EDIT_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: editPrompt,
          },
        ],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                 return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("Failed to edit image");
  });
};
