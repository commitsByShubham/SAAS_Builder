const getPrompt = (idea, analysis) => `
You are a product manager and feature architect. Generate a comprehensive feature set for this software product.

IDEA: "${idea}"
ANALYSIS SUMMARY: Industry: ${analysis.industry}, Target Users: ${JSON.stringify(analysis.targetUsers)}, Tech Complexity: ${analysis.techComplexity}

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "coreFeatures": [
    {
      "id": "CF-001",
      "name": "string",
      "description": "string",
      "userBenefit": "string",
      "modules": ["array of sub-features/modules"],
      "priority": 1,
      "estimatedEffort": "string - e.g. 2 weeks"
    }
  ],
  "adminFeatures": [
    {
      "id": "AF-001",
      "name": "string",
      "description": "string",
      "modules": ["array of sub-features"],
      "priority": 1
    }
  ],
  "aiFeatures": [
    {
      "id": "AI-001",
      "name": "string",
      "description": "string",
      "aiType": "string - e.g. NLP, Recommendation, Classification, Generation",
      "dataRequired": ["array of data needed"],
      "complexity": "low|medium|high",
      "priority": 1
    }
  ],
  "premiumFeatures": [
    {
      "id": "PF-001",
      "name": "string",
      "description": "string",
      "tier": "string - e.g. Pro, Enterprise",
      "revenueImpact": "low|medium|high"
    }
  ],
  "integrations": [
    {
      "name": "string - third party service",
      "type": "string - e.g. Payment, Auth, Communication, Analytics",
      "required": true
    }
  ]
}

Generate at least 6 core features, 4 admin features, 4 AI features, and 4 premium features.
`;

module.exports = { getPrompt };
