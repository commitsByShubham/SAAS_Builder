const getPrompt = (idea, analysis, features, requirements) => `
You are a technical product manager and project planner. Create a detailed development roadmap.

IDEA: "${idea}"
TECH COMPLEXITY: ${analysis.techComplexity}
MUST-HAVE REQUIREMENTS: ${requirements.functionalRequirements.filter(r => r.priority === 'must-have').map(r => r.title).join(', ')}
CORE FEATURES: ${features.coreFeatures.map(f => f.name).join(', ')}
AI FEATURES: ${features.aiFeatures.map(f => f.name).join(', ')}

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "totalDuration": "string - e.g. 9 months",
  "teamSize": "string - recommended team size",
  "methodology": "string - e.g. Agile Scrum, 2-week sprints",
  "phases": [
    {
      "phase": 1,
      "name": "string - phase name",
      "duration": "string - e.g. 6 weeks",
      "goal": "string - phase objective",
      "milestones": ["array of milestone strings"],
      "deliverables": [
        {
          "name": "string",
          "description": "string",
          "type": "frontend|backend|database|AI|devops|testing"
        }
      ],
      "teamFocus": ["array of roles working in this phase"],
      "risks": ["array of phase-specific risks"]
    }
  ],
  "testingStrategy": {
    "unitTesting": "string",
    "integrationTesting": "string",
    "e2eTesting": "string",
    "performanceTesting": "string",
    "tools": ["array of testing tools"]
  },
  "deploymentPlan": {
    "stages": [
      {
        "name": "string - e.g. Alpha, Beta, Production",
        "timing": "string - when this happens",
        "audience": "string - who has access",
        "successMetrics": ["array of metrics"]
      }
    ]
  },
  "launchChecklist": ["array of pre-launch checklist items"],
  "postLaunchMetrics": ["array of KPIs to track after launch"]
}

Generate 4 development phases plus deployment and launch.
`;

module.exports = { getPrompt };
