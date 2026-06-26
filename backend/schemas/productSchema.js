module.exports = {
  executiveSummary: {
    projectType: 'string',
    industry: 'string',
    targetAudience: 'string',
    estimatedComplexity: 'string',
    estDevTime: 'string',
    suggestedTeamSize: 'string',
    valueProp: 'string',
    problemSolved: 'string'
  },
  analysis: {
    industry: 'string',
    subIndustry: 'string',
    marketSize: 'string',
    competitionLevel: 'string',
    keyRisks: 'array',
    successFactors: 'array',
    tags: 'array'
  },
  targetUsers: {
    primary: 'string',
    secondary: 'string'
  },
  requirements: {
    functionalRequirements: 'array',
    nonFunctionalRequirements: 'array',
    userStories: 'array',
    adminStories: 'array',
    constraints: 'array',
    assumptions: 'array'
  },
  features: {
    coreFeatures: 'array',
    adminFeatures: 'array',
    aiFeatures: 'array',
    premiumFeatures: 'array',
    integrations: 'array'
  },
  recommendedTechStack: {
    frontend: 'string',
    backend: 'string',
    database: 'string',
    fileStorage: 'string',
    auth: 'string'
  }
};
