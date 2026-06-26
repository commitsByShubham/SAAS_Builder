const { GoogleGenAI } = require('@google/genai');

// Automatically picks up process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({});

async function analyzeIdea(idea) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Great for fast pipeline processing
      config: {
        // System instructions go inside the config object for Gemini
        systemInstruction: 'You are an expert business analyst...', 
      },
      contents: `Analyze this idea: ${idea}`,
    });

    return {
      success: true,
      // response.text extracts the markdown string response directly
      data: response.text 
    };
  } catch (error) {
    throw new Error(`Gemini Analysis failed: ${error.message}`);
  }
}

module.exports = { analyzeIdea };
