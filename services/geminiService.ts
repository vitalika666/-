import { GoogleGenAI, Type, Schema } from "@google/genai";
import { StoryResponse } from "../types";

// Initialize Gemini Client
// @ts-ignore - Env variable is injected by the runtime
const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

const SYSTEM_INSTRUCTION = `
Ты ГМ игры "Помоги Косте выйти на улицу". Максимум 10 ходов.

**Стиль и Язык:**
*   **Язык:** Неформальный, живой, дворовый сленг (кент, пивандрий, жиза, кринж, скуф, тянка, попустил, база).
*   **Тон:** Черный юмор, сарказм, абсурд. Рассказывай как будто травишь байку пацанам.
*   **Объем:** 2-4 предложения. Заполняй пространство, не пиши слишком сухо.

**Персонажи:**
*   **Костя:** Скуф, работяга, любит пиво. Хочет сбежать из дома.
*   **Алина (Жена):** Громкая, злая, в халате, вечно пилит.
*   **Кенты:** Дима и Виталик (звонят по кд "ГО ПИВО"), Андрей Шапа (тролль, жестко стебет Костю).
*   **Тачка:** Лада 2114 (четырка), гнилая, но едет.

**Сюжет:**
*   Костя хочет пива. Алина против.
*   Друзья назойливо звонят. Шапа подкалывает.
*   Костя может врать, убегать, прыгать в окно, ехать на 14-ке.

**JSON Schema:**
*   \`storyText\`: string
*   \`choices\`: array of strings (2-3 options, с юмором)
*   \`visualDescription\`: string (Short English keywords for image gen)
*   \`gameStatus\`: "PLAYING", "VICTORY", "GAME_OVER"
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    storyText: { type: Type.STRING },
    choices: {
      type: Type.ARRAY,
      items: { type: Type.STRING }
    },
    visualDescription: { type: Type.STRING },
    gameStatus: { type: Type.STRING, enum: ["PLAYING", "VICTORY", "GAME_OVER"] }
  },
  required: ["storyText", "choices", "visualDescription", "gameStatus"]
};

// Helper for exponential backoff retry
const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    // Check for various forms of Rate Limit / Quota errors
    const strError = JSON.stringify(error);
    const isRateLimit = 
      error?.status === 429 || 
      error?.code === 429 || 
      error?.status === 503 || 
      (error?.message && error.message.includes('quota')) ||
      strError.includes('429') ||
      strError.includes('RESOURCE_EXHAUSTED');
    
    if (retries > 0 && isRateLimit) {
      console.warn(`API Error (Quota/Rate Limit), retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

// Start or Continue Story
export const generateStorySegment = async (history: string[], userChoice?: string, turnCount: number = 0): Promise<StoryResponse> => {
  try {
    const model = "gemini-2.5-flash"; // Fast model
    
    let prompt = "";
    if (!userChoice) {
      prompt = "СТАРТ ИГРЫ. Костя дома с Алиной. Ход 1/10. Опиши ситуацию с юмором.";
    } else {
      prompt = `Игрок выбрал: "${userChoice}". Ход ${turnCount}/10. Если 10 ход - финал (победа если выпил пива, иначе проигрыш). Шапа должен пошутить если уместно.`;
    }

    const contents = [
       { role: "user", parts: [{ text: "Start" }] }, 
       ...history.map((h, i) => ({ role: i % 2 === 0 ? "model" : "user", parts: [{ text: h }] })),
       { role: "user", parts: [{ text: prompt }] }
    ];

    return await retry(async () => {
      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 1.2, // High creativity for humor
          maxOutputTokens: 1000, 
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("No text");
      return JSON.parse(jsonText) as StoryResponse;
    });

  } catch (error) {
    console.error("Story Error:", error);
    throw error;
  }
};

// Generate Image based on visual description
export const generateSceneImage = async (visualDescription: string): Promise<string> => {
  try {
    // Highly specific face prompt matching "Photo 1"
    const face = "Face: round Slavic face, short dark buzzcut hair, brown eyes, double chin, straight nose, serious expression, heavy eyebrows.";
    const body = "Body: Stocky man large build, white t-shirt, no headphones.";
    const wife = "Wife Alina: Large woman, messy hair, old robe.";
    // Drawn style
    const style = "Style: Hand-drawn colored pencil illustration, rough sketch style, artistic, comic book style, not realistic, 2D art.";
    
    // Condensed prompt for faster token processing
    const promptText = `${face} ${body} ${wife} ${style} Action: ${visualDescription}`;

    return await retry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [{ text: promptText }]
        },
        config: {
          imageConfig: {
              aspectRatio: "16:9"
          }
        }
      });

      const outputParts = response.candidates?.[0]?.content?.parts;
      
      if (outputParts) {
        for (const part of outputParts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }
      return "";
    }, 1, 2500); // Retry once after 2.5 seconds for images

  } catch (error) {
    // We do NOT throw here, we return empty string so the game text continues even if image fails
    console.warn("Image Generation Failed (likely quota):", error);
    return ""; 
  }
};