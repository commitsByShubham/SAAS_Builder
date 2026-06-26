module.exports = {
  database: {
    databaseType: 'string',
    overview: 'string',
    collections: 'array',
    designDecisions: 'array',
    scalingStrategy: 'string'
  },
  api: {
    baseUrl: 'string',
    authStrategy: 'string',
    endpoints: 'array',
    middleware: 'array',
    webhooks: 'array'
  },
  folderStructure: {
    root: 'string',
    directories: 'array'
  },
  architecture: {
    overview: 'string',
    frontend: 'object',
    backend: 'object',
    database: 'object',
    aiService: 'object',
    deployment: 'object',
    security: 'object',
    diagram: 'object'
  },
  roadmap: {
    totalDuration: 'string',
    teamSize: 'string',
    methodology: 'string',
    phases: 'array',
    testingStrategy: 'object',
    deploymentPlan: 'object',
    launchChecklist: 'array',
    postLaunchMetrics: 'array'
  },
  qualityReview: {
    overallScore: 'number',
    strengths: 'array',
    weaknesses: 'array',
    missingComponents: 'array',
    suggestedImprovements: 'array'
  }
};
