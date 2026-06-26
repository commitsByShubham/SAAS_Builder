const getPrompt = (idea, analysis) => `
You are a senior software requirements engineer. Based on the idea and analysis provided, generate comprehensive software requirements.

IDEA: "${idea}"
ANALYSIS: ${JSON.stringify(analysis, null, 2)}

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "functionalRequirements": [
    {
      "id": "FR-001",
      "category": "string - e.g. Authentication, Core Feature, Reporting",
      "title": "string",
      "description": "string",
      "priority": "must-have|should-have|nice-to-have",
      "complexity": "low|medium|high"
    }
  ],
  "nonFunctionalRequirements": [
    {
      "id": "NFR-001",
      "category": "string - e.g. Performance, Security, Scalability",
      "title": "string",
      "description": "string",
      "metric": "string - measurable target"
    }
  ],
  "userStories": [
    {
      "id": "US-001",
      "persona": "string - user type",
      "action": "string - what they want to do",
      "benefit": "string - why they want it",
      "acceptanceCriteria": ["array of acceptance criteria strings"]
    }
  ],
  "adminStories": [
    {
      "id": "AS-001",
      "persona": "string - admin type",
      "action": "string",
      "benefit": "string",
      "acceptanceCriteria": ["array of strings"]
    }
  ],
  "constraints": ["array of technical or business constraints"],
  "assumptions": ["array of assumptions made"]
}

Generate at least 8 functional requirements, 5 non-functional requirements, 6 user stories, and 3 admin stories.
`;

module.exports = { getPrompt };
