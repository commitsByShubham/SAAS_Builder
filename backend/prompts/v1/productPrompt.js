const getPrompt = (idea) => `
You are a senior software product manager and start-up consultant. Based on the user's idea, generate a comprehensive product planning blueprint.

IDEA: "${idea}"

Return ONLY a valid JSON object (no markdown code blocks, no backticks, no explanations, no text outside the JSON).
The response must strictly match this structure:
{
  "executiveSummary": {
    "projectType": "string - e.g. SaaS Platform, Mobile App, Marketplace",
    "industry": "string - primary industry",
    "targetAudience": "string - target demographic",
    "estimatedComplexity": "low|medium|high|very-high",
    "estDevTime": "string - e.g. 6 months",
    "suggestedTeamSize": "string - e.g. 4 engineers",
    "valueProp": "string - 2-3 sentences",
    "problemSolved": "string - 2-3 sentences"
  },
  "analysis": {
    "industry": "string",
    "subIndustry": "string",
    "marketSize": "string - small/medium/large/massive",
    "competitionLevel": "low|medium|high",
    "keyRisks": ["array of 3-5 key risks"],
    "successFactors": ["array of 3-5 critical success factors"],
    "tags": ["array of 5-8 relevant tags"]
  },
  "targetUsers": {
    "primary": "string",
    "secondary": "string",
    "tertiary": "string or null"
  },
  "requirements": {
    "functionalRequirements": [
      {
        "id": "FR-001",
        "category": "string",
        "title": "string",
        "description": "string",
        "priority": "must-have|should-have|nice-to-have",
        "complexity": "low|medium|high"
      }
    ],
    "nonFunctionalRequirements": [
      {
        "id": "NFR-001",
        "category": "string",
        "title": "string",
        "description": "string",
        "metric": "string"
      }
    ],
    "userStories": [
      {
        "id": "US-001",
        "persona": "string",
        "action": "string",
        "benefit": "string",
        "acceptanceCriteria": ["array of strings"]
      }
    ],
    "adminStories": [
      {
        "id": "AS-001",
        "persona": "string",
        "action": "string",
        "benefit": "string",
        "acceptanceCriteria": ["array of strings"]
      }
    ],
    "constraints": ["array of technical or business constraints"],
    "assumptions": ["array of assumptions"]
  },
  "features": {
    "coreFeatures": [
      {
        "id": "CF-001",
        "name": "string",
        "description": "string",
        "userBenefit": "string",
        "modules": ["array of sub-features"],
        "priority": 1,
        "estimatedEffort": "string"
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
        "aiType": "string - e.g. NLP, Recommendation, Generation",
        "dataRequired": ["array of data requirements"],
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
        "name": "string",
        "type": "string",
        "required": true
      }
    ]
  },
  "recommendedTechStack": {
    "frontend": "string - e.g. React/Next.js",
    "backend": "string - e.g. Node.js/Express",
    "database": "string - e.g. PostgreSQL",
    "cache": "string or null - e.g. Redis",
    "fileStorage": "string - e.g. AWS S3",
    "auth": "string - e.g. NextAuth/JWT"
  }
}

Generate at least 8 functional requirements, 5 non-functional requirements, 6 user stories, 3 admin stories, 6 core features, 3 admin features, 3 AI features, and 3 premium features.
`;

module.exports = { getPrompt };
