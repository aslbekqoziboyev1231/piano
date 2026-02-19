
import { GoogleGenAI } from "@google/genai";

export const generateGuitarImage = async (customPrompt?: string): Promise<string> => {
  const basePrompt = customPrompt || "12 torli akustik gitaraning yuqori sifatli, realistik mahsulot rasmi. Gitara markazda joylashgan, yog‘och teksturasi aniq ko‘rinadi, barcha 12 ta tor ravshan ko‘rinib turadi. Orqa fon minimalistik va yorug‘ (oq yoki och kulrang), professional studiya yoritilishi bilan. Rasm e-commerce yoki portfolio web-sayt uchun mos, 4K sifatda, old tomondan ko‘rinish, soyalar yumshoq, premium mahsulot fotosurati uslubida.";
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: basePrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      },
    });

    let imageUrl = '';
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        imageUrl = `data:image/png;base64,${base64EncodeString}`;
        break;
      }
    }

    if (!imageUrl) {
      throw new Error("No image data found in response");
    }

    return imageUrl;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
