const getPrompt = (idea, productPlanningJSON) => `
You are a principal software architect, database designer, and technical lead. Based on the initial software idea and the completed Product Planning JSON, generate a comprehensive technical blueprint.

ORIGINAL IDEA: "${idea}"
PRODUCT PLANNING DATA:
${JSON.stringify(productPlanningJSON, null, 2)}

Return ONLY a valid JSON object (no markdown code blocks, no backticks, no explanations, no text outside the JSON).
The response must strictly match this structure:
{
  "database": {
    "databaseType": "string - e.g. PostgreSQL, MongoDB, Hybrid (PostgreSQL + Redis)",
    "overview": "string - high level database design decisions",
    "collections": [
      {
        "name": "string - table or collection name",
        "description": "string - purpose of the collection",
        "fields": [
          {
            "name": "string",
            "type": "string - e.g. String, Int, Float, Boolean, Date, DateTime, JSON, Relation",
            "required": true,
            "unique": false,
            "default": "string or null",
            "description": "string - field explanation",
            "validation": "string or null - e.g. email, minLength: 8"
          }
        ],
        "indexes": [
          {
            "fields": ["array of field names"],
            "type": "single|compound|text|unique",
            "unique": false,
            "reason": "string"
          }
        ],
        "relationships": [
          {
            "type": "references|embeds",
            "collection": "string - related table/collection name",
            "field": "string - field holding the key/reference",
            "cardinality": "one-to-one|one-to-many|many-to-many"
          }
        ]
      }
    ],
    "designDecisions": ["array of key database design decisions"],
    "scalingStrategy": "string"
  },
  "api": {
    "baseUrl": "/api/v1",
    "authStrategy": "string - e.g. JWT in Cookies, OAuth2.0, API Keys",
    "endpoints": [
      {
        "group": "string - e.g. Authentication, Core Operations, Subscriptions",
        "routes": [
          {
            "id": "string - unique path identifier",
            "method": "GET|POST|PUT|PATCH|DELETE",
            "path": "string - e.g. /auth/login, /jobs/:id",
            "description": "string - what it does",
            "auth": "none|user|admin",
            "rateLimit": "string - e.g. 60 requests/minute",
            "requestBody": {
              "contentType": "application/json",
              "schema": {}
            },
            "queryParams": [
              {
                "name": "string",
                "type": "string",
                "required": false,
                "description": "string"
              }
            ],
            "responses": {
              "200": { "description": "string", "schema": {} },
              "400": { "description": "string" },
              "401": { "description": "string" },
              "404": { "description": "string" }
            }
          }
        ]
      }
    ],
    "middleware": ["array of global or route middleware names"],
    "webhooks": [
      {
        "event": "string - e.g. payment.succeeded",
        "description": "string",
        "payload": {}
      }
    ]
  },
  "folderStructure": {
    "root": "string - name of root folder",
    "directories": [
      {
        "name": "string - e.g. src/controllers",
        "files": ["array of file names with extensions"],
        "subdirs": ["array of subdirectory names relative to this directory"]
      }
    ]
  },
  "architecture": {
    "overview": "string",
    "frontend": {
      "type": "SPA|SSR|Static",
      "framework": "string",
      "stateManagement": "string",
      "keyLibraries": ["array of key packages/libraries"],
      "structure": {
        "pages": ["array of page names"],
        "components": ["array of component categories"],
        "services": ["array of service names"]
      }
    },
    "backend": {
      "type": "Monolith|Microservices|Serverless",
      "framework": "string",
      "keyModules": ["array of key modules"],
      "structure": {
        "controllers": ["array"],
        "services": ["array"],
        "models": ["array"],
        "middleware": ["array"]
      }
    },
    "database": {
      "primary": "string",
      "cache": "string or null",
      "search": "string or null",
      "fileStorage": "string"
    },
    "aiService": {
      "architecture": "string - how the AI integration is set up",
      "models": ["array of models to use"],
      "pipeline": ["array of pipeline actions/functions"],
      "infrastructure": "string - third party API or custom server"
    },
    "deployment": {
      "platform": "string - e.g. Vercel, Heroku, AWS",
      "containerization": "string - e.g. Docker, None",
      "ciCd": "string - e.g. GitHub Actions, GitLab CI",
      "environments": ["array of envs"],
      "scaling": "string"
    },
    "security": {
      "authentication": "string",
      "authorization": "string",
      "dataProtection": ["array of encryption or security practices"],
      "compliance": ["array of compliance models like GDPR, HIPAA"]
    },
    "diagram": {
      "layers": [
        {
          "name": "string",
          "components": ["array of component names"],
          "connectsTo": ["array of layer names"]
        }
      ],
      "textDiagram": "string - ASCII architecture layout"
    }
  },
  "roadmap": {
    "totalDuration": "string",
    "teamSize": "string",
    "methodology": "string",
    "phases": [
      {
        "phase": 1,
        "name": "string",
        "duration": "string",
        "goal": "string",
        "milestones": ["array of milestone strings"],
        "deliverables": [
          {
            "name": "string",
            "description": "string",
            "type": "frontend|backend|database|AI|devops|testing"
          }
        ],
        "teamFocus": ["array of role names"],
        "risks": ["array of risk strings"]
      }
    ],
    "testingStrategy": {
      "unitTesting": "string",
      "integrationTesting": "string",
      "e2eTesting": "string",
      "performanceTesting": "string",
      "tools": ["array of tools"]
    },
    "deploymentPlan": {
      "stages": [
        {
          "name": "string",
          "timing": "string",
          "audience": "string",
          "successMetrics": ["array of metrics"]
        }
      ]
    },
    "launchChecklist": ["array of checklist items"],
    "postLaunchMetrics": ["array of metrics"]
  },
  "qualityReview": {
    "overallScore": 85,
    "strengths": ["array of strengths of this technical layout"],
    "weaknesses": ["array of potential risks or weaknesses"],
    "missingComponents": ["array of components not yet fully mapped"],
    "suggestedImprovements": ["array of recommended refactors or add-ons"]
  }
}

Ensure to generate at least 6 database tables/collections, at least 5 API groups with 3 endpoints each, 4 roadmap phases, and a complete Quality Review block.
`;

module.exports = { getPrompt };
