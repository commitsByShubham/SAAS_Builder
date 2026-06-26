const getPrompt = (idea, analysis, features) => `
You are a principal software architect. Design the complete system architecture for this product.

IDEA: "${idea}"
TECH COMPLEXITY: ${analysis.techComplexity}
AI FEATURES: ${features.aiFeatures.map(f => f.name).join(', ')}
INTEGRATIONS: ${features.integrations.map(i => i.name).join(', ')}

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "overview": "string - high-level architecture description",
  "frontend": {
    "type": "string - e.g. SPA, SSR, PWA",
    "framework": "string - recommended framework",
    "stateManagement": "string",
    "keyLibraries": ["array of libraries"],
    "structure": {
      "pages": ["array of main pages"],
      "components": ["array of reusable components"],
      "services": ["array of frontend services"]
    }
  },
  "backend": {
    "type": "string - e.g. Monolith, Microservices, Serverless",
    "framework": "string",
    "keyModules": ["array of backend modules"],
    "structure": {
      "controllers": ["array"],
      "services": ["array"],
      "models": ["array"],
      "middleware": ["array"]
    }
  },
  "database": {
    "primary": "string - primary database",
    "cache": "string - caching layer",
    "search": "string or null",
    "fileStorage": "string"
  },
  "aiService": {
    "architecture": "string - how AI is integrated",
    "models": ["array of AI models to use"],
    "pipeline": ["array of pipeline steps"],
    "infrastructure": "string"
  },
  "deployment": {
    "platform": "string - recommended platform",
    "containerization": "string",
    "ciCd": "string",
    "environments": ["array - dev/staging/prod"],
    "scaling": "string"
  },
  "security": {
    "authentication": "string",
    "authorization": "string",
    "dataProtection": ["array of security measures"],
    "compliance": ["array of compliance requirements"]
  },
  "diagram": {
    "layers": [
      {
        "name": "string - layer name",
        "components": ["array of components in this layer"],
        "connectsTo": ["array of layer names this connects to"]
      }
    ],
    "textDiagram": "string - ASCII/text architecture diagram showing the full system"
  }
}
`;

module.exports = { getPrompt };
