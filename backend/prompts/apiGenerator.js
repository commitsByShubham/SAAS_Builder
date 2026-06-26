const getPrompt = (idea, analysis, features, database) => `
You are a REST API architect. Design a complete API specification for this product.

IDEA: "${idea}"
COLLECTIONS: ${database.collections.map(c => c.name).join(', ')}
CORE FEATURES: ${features.coreFeatures.map(f => f.name).join(', ')}

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "baseUrl": "/api/v1",
  "authStrategy": "string - e.g. JWT Bearer Token",
  "endpoints": [
    {
      "group": "string - e.g. Authentication, Users, Products",
      "routes": [
        {
          "id": "string - unique route id",
          "method": "GET|POST|PUT|PATCH|DELETE",
          "path": "string - e.g. /users/:id",
          "description": "string",
          "auth": "none|user|admin|superadmin",
          "rateLimit": "string - e.g. 100/hour",
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
  "middleware": ["array of global middleware strings"],
  "webhooks": [
    {
      "event": "string",
      "description": "string",
      "payload": {}
    }
  ]
}

Generate at least 6 endpoint groups with 2-4 routes each.
`;

module.exports = { getPrompt };
