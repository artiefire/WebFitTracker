import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { FoodEntry } from '../types';
// For React Native, API keys are often managed through react-native-dotenv
// import { API_KEY } from '@env'; // This would be the typical import if using react-native-dotenv

// --- API Key Handling ---
// The API key MUST be provided via an environment variable.
// In React Native, this is often set up via a .env file and a library like 'react-native-dotenv'.
// The library would make it available as `process.env.API_KEY` or directly imported.
// For this example, we'll assume process.env.API_KEY is populated by such a mechanism.
const apiKeyFromEnv = process.env.API_KEY; 
let ai: GoogleGenAI | null = null;

console.log("[aiNutritionService] Initializing AI service for React Native.");

if (apiKeyFromEnv && typeof apiKeyFromEnv === 'string' && apiKeyFromEnv.trim() !== "") {
    console.log(`[aiNutritionService] API_KEY found. Length: ${apiKeyFromEnv.length}. Initializing GoogleGenAI client.`);
    try {
        ai = new GoogleGenAI({ apiKey: apiKeyFromEnv });
        console.log("[aiNutritionService] GoogleGenAI client initialized successfully.");
    } catch (e: any) {
        console.error("[aiNutritionService] CRITICAL: Failed to initialize GoogleGenAI client. Error:", e.message);
        ai = null;
    }
} else {
    console.error("[aiNutritionService] CRITICAL: API_KEY NOT FOUND or is invalid. AI features will be disabled.");
    console.log("[aiNutritionService] Ensure API_KEY is set (e.g., in your .env file) and accessible as process.env.API_KEY or imported correctly for your React Native setup.");
}

const parseGeminiJsonResponse = (responseText: string): Partial<FoodEntry> | null => {
    let jsonStr = responseText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
        jsonStr = match[2].trim();
    }

    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed.name === 'string' && typeof parsed.calories === 'number') {
            return {
                name: parsed.name,
                calories: parsed.calories,
                protein: typeof parsed.protein === 'number' ? parsed.protein : 0,
                carbs: typeof parsed.carbs === 'number' ? parsed.carbs : 0,
                fat: typeof parsed.fat === 'number' ? parsed.fat : 0,
                servingSize: typeof parsed.servingSize === 'string' ? parsed.servingSize : '1 serving',
                aiAssisted: true,
            };
        }
        console.warn("[aiNutritionService] Parsed JSON from AI does not match expected FoodEntry structure:", parsed);
        return null;
    } catch (e) {
        console.error("[aiNutritionService] Failed to parse JSON response from AI. Raw response:", responseText, "Error:", e);
        return null;
    }
};

export const getNutritionFromText = async (description: string): Promise<Partial<FoodEntry>> => {
    if (!ai) {
        const errorMsg = "AI Service Error: Gemini AI client is not initialized. Missing or invalid API_KEY.";
        console.error(`[aiNutritionService] getNutritionFromText failed: ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const prompt = `Analyze the following food description and provide its estimated nutritional information as a single JSON object. The object MUST have keys: "name" (string, the identified food item), "calories" (number), "protein" (number, in grams), "carbs" (number, in grams), "fat" (number, in grams), and "servingSize" (string, e.g., "1 bowl", "100g", "1 serving"). If a specific nutritional value cannot be reasonably estimated, use 0 for it. Food description: "${description}"`;

    try {
        console.log("[aiNutritionService] Requesting text-based nutrition analysis from Gemini.");
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                temperature: 0.2,
            }
        });
        
        const nutritionData = parseGeminiJsonResponse(response.text);
        if (!nutritionData) {
            console.error("[aiNutritionService] Text analysis returned an unparseable or invalid response from AI.");
            throw new Error("AI returned an unexpected or unparseable response for text analysis.");
        }
        console.log("[aiNutritionService] Text-based nutrition analysis successful.");
        return nutritionData;

    } catch (error: any) {
        console.error("[aiNutritionService] Error in getNutritionFromText:", error.message, error);
        throw new Error(error.message || "AI analysis (text) failed. Please try again or enter manually.");
    }
};

export const getNutritionFromImageAndText = async (
    imageBase64: string,
    imageMimeType: string,
    textDescription?: string
): Promise<Partial<FoodEntry>> => {
    if (!ai) {
        const errorMsg = "AI Service Error: Gemini AI client is not initialized. Missing or invalid API_KEY.";
        console.error(`[aiNutritionService] getNutritionFromImageAndText failed: ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const textParts = [];
    textParts.push("Analyze the food in the provided image.");
    if (textDescription && textDescription.trim() !== "") {
        textParts.push(`Consider these additional details: "${textDescription}". Focus on these details for portion size or specific ingredients if provided.`);
    }
    textParts.push(`Provide its estimated nutritional information as a single JSON object. The object MUST have keys: "name" (string, the identified food item), "calories" (number), "protein" (number, in grams), "carbs" (number, in grams), "fat" (number, in grams), and "servingSize" (string, e.g., "1 plate", "1 item pictured", "estimated 150g"). If a specific nutritional value cannot be reasonably estimated, use 0 for it. If text description provides weight, prioritize that for serving size and nutrient calculation.`);
    
    const fullTextPrompt = textParts.join(' ');

    const imagePart = {
        inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
        },
    };
    const textPart = { text: fullTextPrompt };

    try {
        console.log("[aiNutritionService] Requesting image-based nutrition analysis from Gemini.");
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-04-17", 
            contents: { parts: [imagePart, textPart] }, 
            config: {
                responseMimeType: "application/json",
                temperature: 0.3,
            }
        });

        const nutritionData = parseGeminiJsonResponse(response.text);
        if (!nutritionData) {
            console.error("[aiNutritionService] Image analysis returned an unparseable or invalid response from AI.");
            throw new Error("AI returned an unexpected or unparseable response for image analysis.");
        }
        console.log("[aiNutritionService] Image-based nutrition analysis successful.");
        return nutritionData;

    } catch (error: any) {
        console.error("[aiNutritionService] Error in getNutritionFromImageAndText:", error.message, error);
        throw new Error(error.message || "AI analysis (image) failed. Please try again or enter manually.");
    }
};

// This function is primarily a relic from potential web-to-native porting.
// In React Native, `react-native-image-picker` (when configured with `includeBase64: true`)
// provides the Base64 string directly in the response (response.assets[0].base64).
// Therefore, this manual conversion function is usually not needed.
// If you somehow receive a file URI and *need* to convert it to Base64 manually,
// you would use a library like `react-native-fs`. Example:
// import RNFS from 'react-native-fs';
// const base64String = await RNFS.readFile(fileUri, 'base64');
export const fileToBase64 = (file: File): Promise<string> => {
    // The 'File' type here is from the web. In React Native, you'll get a different object structure
    // from image pickers.
    console.warn("fileToBase64: This function is generally not needed with react-native-image-picker if 'includeBase64' option is true. The picker provides base64 directly.");
    return new Promise((_resolve, reject) => {
        reject(new Error("fileToBase64 is a web-specific File API implementation and should not be used directly in React Native for image picker results. Use the base64 string provided by react-native-image-picker."));
    });
};