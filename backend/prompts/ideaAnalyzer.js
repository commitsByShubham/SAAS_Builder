const getPrompt = (idea) => `
You are an expert business analyst and startup strategist. Analyze the following software idea and extract structured information.

IDEA: "${idea}"

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "industry": "string - primary industry sector",
  "subIndustry": "string - specific niche within the industry",
  "targetUsers": {
    "primary": "string - main user group",
    "secondary": "string - secondary user group",
    "tertiary": "string or null"
  },
  "businessModel": {
    "type": "string - e.g. SaaS, Marketplace, Platform",
    "revenueStreams": ["array of revenue stream strings"],
    "pricingModel": "string - e.g. Freemium, Subscription, Pay-per-use"
  },
  "coreProblem": "string - the main problem being solved (2-3 sentences)",
  "valueProposition": "string - unique value offered (2-3 sentences)",
  "marketSize": "string - estimated market size (small/medium/large/massive)",
  "competitionLevel": "string - low/medium/high",
  "techComplexity": "string - low/medium/high/very-high",
  "keyRisks": ["array of 3-5 key risks"],
  "successFactors": ["array of 3-5 critical success factors"],
  "tags": ["array of 5-8 relevant tags"]
}
`;

module.exports = { getPrompt };
