const getPrompt = (idea, analysis, features) => `
You are a database architect specializing in NoSQL and SQL schema design. Design a complete database schema for this product.

IDEA: "${idea}"
INDUSTRY: ${analysis.industry}
CORE FEATURES: ${features.coreFeatures.map(f => f.name).join(', ')}

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with this exact structure:
{
  "databaseType": "string - MongoDB/PostgreSQL/hybrid",
  "collections": [
    {
      "name": "string - collection/table name",
      "description": "string - purpose of this collection",
      "fields": [
        {
          "name": "string",
          "type": "string - e.g. String, ObjectId, Number, Boolean, Date, Array, Object",
          "required": true,
          "unique": false,
          "default": "string or null",
          "description": "string - field purpose",
          "validation": "string or null - validation rules"
        }
      ],
      "indexes": [
        {
          "fields": ["array of field names"],
          "type": "single|compound|text|geospatial",
          "unique": false,
          "reason": "string - why this index exists"
        }
      ],
      "relationships": [
        {
          "type": "references|embeds",
          "collection": "string - related collection name",
          "field": "string - field that holds the reference",
          "cardinality": "one-to-one|one-to-many|many-to-many"
        }
      ]
    }
  ],
  "designDecisions": ["array of key design decisions and reasoning"],
  "scalingStrategy": "string - how the database scales"
}

Generate at least 6-8 collections with realistic, production-ready schemas.
`;

module.exports = { getPrompt };
