/**
 * TemplateGenerator - Generates code templates and reports locally from JSON blueprints
 */

function generatePrismaSchema(dbData) {
  const provider = dbData.databaseType?.toLowerCase().includes('mongo') ? 'mongodb' : 'postgresql';
  let schema = `datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

`;

  const collections = dbData.collections || [];
  collections.forEach(col => {
    // Model name capitalized
    const modelName = col.name.charAt(0).toUpperCase() + col.name.slice(1);
    schema += `model ${modelName} {\n`;
    
    let hasId = false;
    const fields = col.fields || [];
    fields.forEach(f => {
      let prismaType = 'String';
      const typeLower = f.type?.toLowerCase() || '';

      if (typeLower.includes('number') || typeLower.includes('int') || typeLower.includes('float')) {
        prismaType = typeLower.includes('int') ? 'Int' : 'Float';
      } else if (typeLower.includes('bool')) {
        prismaType = 'Boolean';
      } else if (typeLower.includes('date') || typeLower.includes('time')) {
        prismaType = 'DateTime';
      } else if (typeLower.includes('array')) {
        prismaType = 'String[]';
      } else if (typeLower.includes('object') || typeLower.includes('json')) {
        prismaType = 'Json';
      }

      const isIdField = f.name === 'id' || f.name === '_id';
      let decorators = '';

      if (isIdField) {
        hasId = true;
        decorators += ' @id';
        if (provider === 'mongodb') {
          decorators += ' @map("_id") @db.ObjectId';
          prismaType = 'String';
        } else {
          decorators += ' @default(uuid())';
        }
      } else {
        if (f.unique) decorators += ' @unique';
        if (f.default && f.default !== 'null') {
          if (prismaType === 'Boolean') {
            decorators += ` @default(${f.default})`;
          } else if (prismaType === 'Int' || prismaType === 'Float') {
            decorators += ` @default(${f.default})`;
          } else if (prismaType === 'String') {
            decorators += ` @default("${f.default}")`;
          }
        }
      }

      const optional = (!f.required && !isIdField) ? '?' : '';
      schema += `  ${f.name} ${prismaType}${optional}${decorators} // ${f.description || ''}\n`;
    });

    if (!hasId) {
      if (provider === 'mongodb') {
        schema += `  id String @id @default(auto()) @map("_id") @db.ObjectId\n`;
      } else {
        schema += `  id String @id @default(uuid())\n`;
      }
    }

    // Relationships as comments
    const relations = col.relationships || [];
    if (relations.length > 0) {
      schema += '\n  // Relations:\n';
      relations.forEach(rel => {
        schema += `  // [${rel.cardinality}] -> ${rel.collection} (via ${rel.field || 'id'}) [${rel.type}]\n`;
      });
    }

    schema += '}\n\n';
  });

  return schema;
}

function generateSQLDDL(dbData) {
  let ddl = `-- Database Type: ${dbData.databaseType || 'SQL'}\n`;
  ddl += `-- Generated locally by ArchitectAI\n\n`;

  const collections = dbData.collections || [];
  collections.forEach(col => {
    const tableName = col.name.toLowerCase();
    ddl += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;

    const fields = col.fields || [];
    const fieldsDdl = [];
    let hasId = false;

    fields.forEach(f => {
      let sqlType = 'VARCHAR(255)';
      const typeLower = f.type?.toLowerCase() || '';

      if (typeLower.includes('number') || typeLower.includes('float')) {
        sqlType = 'NUMERIC';
      } else if (typeLower.includes('int')) {
        sqlType = 'INTEGER';
      } else if (typeLower.includes('bool')) {
        sqlType = 'BOOLEAN';
      } else if (typeLower.includes('date') || typeLower.includes('time')) {
        sqlType = 'TIMESTAMP';
      } else if (typeLower.includes('array')) {
        sqlType = 'TEXT[]';
      } else if (typeLower.includes('object') || typeLower.includes('json')) {
        sqlType = 'JSONB';
      }

      const isIdField = f.name === 'id' || f.name === '_id';
      let fieldDef = `  "${f.name}" ${sqlType}`;

      if (isIdField) {
        hasId = true;
        fieldDef += ' PRIMARY KEY';
      } else {
        if (f.required) fieldDef += ' NOT NULL';
        if (f.unique) fieldDef += ' UNIQUE';
        if (f.default && f.default !== 'null') {
          if (typeLower.includes('bool') || typeLower.includes('number') || typeLower.includes('int')) {
            fieldDef += ` DEFAULT ${f.default}`;
          } else {
            fieldDef += ` DEFAULT '${f.default}'`;
          }
        }
      }
      
      fieldsDdl.push(fieldDef);
    });

    if (!hasId) {
      fieldsDdl.unshift('  "id" VARCHAR(255) PRIMARY KEY');
    }

    ddl += fieldsDdl.join(',\n');
    ddl += `\n);\n\n`;

    // Indexes
    const indexes = col.indexes || [];
    indexes.forEach((idx, i) => {
      const idxName = `idx_${tableName}_${idx.fields.join('_')}`;
      const uniqueKeyword = idx.unique ? 'UNIQUE ' : '';
      ddl += `CREATE ${uniqueKeyword}INDEX IF NOT EXISTS "${idxName}" ON "${tableName}" (${idx.fields.map(f => `"${f}"`).join(', ')});\n`;
    });

    if (indexes.length > 0) ddl += '\n';
  });

  return ddl;
}

function generateOpenAPISpec(apiData, projectTitle) {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: projectTitle || 'SaaS API Specification',
      version: '1.0.0',
      description: `REST API specifications under base URL: ${apiData.baseUrl || '/api/v1'}`
    },
    servers: [
      {
        url: 'http://localhost:3000' + (apiData.baseUrl || '/api/v1'),
        description: 'Development Server'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: apiData.authStrategy || 'JWT Token Authentication'
        }
      }
    },
    paths: {}
  };

  const endpoints = apiData.endpoints || [];
  endpoints.forEach(group => {
    const routes = group.routes || [];
    routes.forEach(route => {
      const cleanPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
      
      if (!spec.paths[cleanPath]) {
        spec.paths[cleanPath] = {};
      }

      const methodLower = route.method.toLowerCase();
      
      // Extract path params e.g. {id}
      const pathParams = [];
      const pathMatches = route.path.match(/:([a-zA-Z0-9_]+)/g);
      if (pathMatches) {
        pathMatches.forEach(m => {
          pathParams.push({
            name: m.slice(1),
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: `Path parameter ${m.slice(1)}`
          });
        });
      }

      // Query params
      const queryParams = (route.queryParams || []).map(q => ({
        name: q.name,
        in: 'query',
        required: !!q.required,
        schema: { type: q.type || 'string' },
        description: q.description || ''
      }));

      const parameters = [...pathParams, ...queryParams];

      const op = {
        summary: route.description || `${route.method} ${cleanPath}`,
        tags: [group.group],
        parameters,
        responses: {}
      };

      if (route.auth && route.auth !== 'none') {
        op.security = [{ BearerAuth: [] }];
      }

      // Request Body
      if (route.requestBody && route.requestBody.schema && Object.keys(route.requestBody.schema).length > 0) {
        op.requestBody = {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.keys(route.requestBody.schema).reduce((acc, k) => {
                  acc[k] = { type: typeof route.requestBody.schema[k] === 'object' ? 'object' : 'string' };
                  return acc;
                }, {})
              }
            }
          }
        };
      }

      // Responses
      const responses = route.responses || {};
      Object.entries(responses).forEach(([code, resp]) => {
        op.responses[code] = {
          description: resp.description || 'Response description'
        };
        if (resp.schema && Object.keys(resp.schema).length > 0) {
          op.responses[code].content = {
            'application/json': {
              schema: {
                type: 'object',
                properties: Object.keys(resp.schema).reduce((acc, k) => {
                  acc[k] = { type: typeof resp.schema[k] === 'object' ? 'object' : 'string' };
                  return acc;
                }, {})
              }
            }
          };
        }
      });

      // Default fallback responses if missing
      if (!op.responses['200'] && !op.responses['201']) {
        op.responses['200'] = { description: 'Successful operation' };
      }

      spec.paths[cleanPath][methodLower] = op;
    });
  });

  return JSON.stringify(spec, null, 2);
}

function generateFolderStructureText(folderData) {
  let text = `${folderData.root || 'my-app'}/\n`;
  const dirs = folderData.directories || [];
  
  // Group directories by depth to build tree representation
  dirs.forEach((dir, index) => {
    const isLastDir = index === dirs.length - 1;
    const prefix = isLastDir ? '└── ' : '├── ';
    text += `${prefix}${dir.name}/\n`;
    
    const files = dir.files || [];
    files.forEach((file, fIndex) => {
      const filePrefix = isLastDir ? '    ' : '│   ';
      const fileConnector = fIndex === files.length - 1 ? '└── ' : '├── ';
      text += `${filePrefix}${fileConnector}${file}\n`;
    });
  });

  return text;
}

function generateExpressRoutes(apiData) {
  let code = `/**
 * Express Route Skeleton
 * Generated locally by ArchitectAI
 */

const express = require('express');
const router = express.Router();

// Authentication middleware placeholder
const authenticateUser = (req, res, next) => {
  // TODO: Implement ${apiData.authStrategy || 'JWT'} authentication
  next();
};

`;

  const endpoints = apiData.endpoints || [];
  endpoints.forEach(group => {
    code += `// === ${group.group} ===\n`;
    const routes = group.routes || [];
    routes.forEach(route => {
      const expressPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, ':$1');
      const needsAuth = route.auth && route.auth !== 'none';
      const middlewareStr = needsAuth ? 'authenticateUser, ' : '';

      code += `// Description: ${route.description || ''}\n`;
      code += `// Auth: ${route.auth || 'none'}\n`;
      code += `router.${route.method.toLowerCase()}('${expressPath}', ${middlewareStr}async (req, res) => {
  try {
    // TODO: Implement business logic
    res.status(200).json({ success: true, message: "${route.method} ${expressPath} stub" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});\n\n`;
    });
  });

  code += 'module.exports = router;\n';
  return code;
}

function generateMongooseModels(dbData) {
  let code = `/**
 * Mongoose Models
 * Generated locally by ArchitectAI
 */

const mongoose = require('mongoose');

`;

  const collections = dbData.collections || [];
  collections.forEach(col => {
    const modelName = col.name.charAt(0).toUpperCase() + col.name.slice(1);
    code += `// --- ${modelName} Schema ---\n`;
    code += `const ${modelName}Schema = new mongoose.Schema({\n`;

    const fields = col.fields || [];
    fields.forEach(f => {
      if (f.name === 'id' || f.name === '_id') return; // Mongoose handles _id automatically
      
      let mType = 'String';
      const typeLower = f.type?.toLowerCase() || '';

      if (typeLower.includes('number') || typeLower.includes('int') || typeLower.includes('float')) {
        mType = 'Number';
      } else if (typeLower.includes('bool')) {
        mType = 'Boolean';
      } else if (typeLower.includes('date') || typeLower.includes('time')) {
        mType = 'Date';
      } else if (typeLower.includes('array')) {
        mType = '[]';
      } else if (typeLower.includes('object') || typeLower.includes('json')) {
        mType = 'mongoose.Schema.Types.Mixed';
      }

      code += `  ${f.name}: {\n`;
      code += `    type: ${mType},\n`;
      code += `    required: ${!!f.required},\n`;
      if (f.unique) code += `    unique: true,\n`;
      if (f.default && f.default !== 'null') {
        if (mType === 'String') {
          code += `    default: "${f.default}",\n`;
        } else {
          code += `    default: ${f.default},\n`;
        }
      }
      code += `    description: "${f.description || ''}"\n`;
      code += `  },\n`;
    });

    code += `}, {\n  timestamps: true\n});\n\n`;
    
    // Mongoose Indexes
    const indexes = col.indexes || [];
    indexes.forEach(idx => {
      const idxObj = idx.fields.reduce((acc, fName) => {
        acc[fName] = 1;
        return acc;
      }, {});
      code += `${modelName}Schema.index(${JSON.stringify(idxObj)}, ${JSON.stringify({ unique: !!idx.unique })});\n`;
    });

    code += `const ${modelName} = mongoose.model('${modelName}', ${modelName}Schema);\n\n`;
  });

  code += 'module.exports = {\n';
  code += collections.map(col => `  ${col.name.charAt(0).toUpperCase() + col.name.slice(1)}`).join(',\n');
  code += '\n};\n';

  return code;
}

function generateMarkdownReport(blueprint) {
  const pData = blueprint.stages.ideaAnalysis?.data || {};
  const reqData = blueprint.stages.requirements?.data || {};
  const featData = blueprint.stages.features?.data || {};
  const dbData = blueprint.stages.database?.data || {};
  const apiData = blueprint.stages.api?.data || {};
  const archData = blueprint.stages.architecture?.data || {};
  const roadData = blueprint.stages.roadmap?.data || {};

  let md = `# Software Architecture Blueprint: ${blueprint.idea.substring(0, 50)}${blueprint.idea.length > 50 ? '...' : ''}\n`;
  md += `*Generated automatically by ArchitectAI on ${new Date(blueprint.createdAt).toLocaleDateString()}*\n\n`;

  // Executive Summary
  const exec = pData.executiveSummary || {};
  md += `## 1. Executive Summary\n`;
  md += `- **Project Type:** ${exec.projectType || 'N/A'}\n`;
  md += `- **Industry:** ${exec.industry || 'N/A'}\n`;
  md += `- **Target Audience:** ${exec.targetAudience || 'N/A'}\n`;
  md += `- **Estimated Complexity:** ${exec.estimatedComplexity || 'N/A'}\n`;
  md += `- **Est. Development Time:** ${exec.estDevTime || 'N/A'}\n`;
  md += `- **Suggested Team Size:** ${exec.suggestedTeamSize || 'N/A'}\n\n`;
  md += `### Core Problem\n${exec.problemSolved || 'N/A'}\n\n`;
  md += `### Value Proposition\n${exec.valueProp || 'N/A'}\n\n`;

  // Market & Risks
  const analysis = pData.analysis || {};
  md += `## 2. Market & Risks Analysis\n`;
  md += `- **Niche Sector:** ${analysis.subIndustry || 'N/A'}\n`;
  md += `- **Market Size:** ${analysis.marketSize || 'N/A'}\n`;
  md += `- **Competition Level:** ${analysis.competitionLevel || 'N/A'}\n\n`;
  md += `### Key Risks\n`;
  (analysis.keyRisks || []).forEach(risk => { md += `- ⚠️ ${risk}\n`; });
  md += `\n### Critical Success Factors\n`;
  (analysis.successFactors || []).forEach(factor => { md += `- ✓ ${factor}\n`; });
  md += `\n`;

  // Requirements
  md += `## 3. Software Requirements\n`;
  md += `### Functional Requirements\n`;
  (reqData.functionalRequirements || []).forEach(r => {
    md += `- **${r.id}: ${r.title}** (${r.priority}) - *${r.description}*\n`;
  });
  md += `\n### Non-Functional Requirements\n`;
  (reqData.nonFunctionalRequirements || []).forEach(r => {
    md += `- **${r.id}: ${r.title}** (${r.category}) - *Target: ${r.metric}*\n`;
  });
  md += `\n`;

  // Features
  md += `## 4. Feature Specifications\n`;
  md += `### Core Features\n`;
  (featData.coreFeatures || []).forEach(f => {
    md += `- **${f.name}** (${f.estimatedEffort || 'N/A'}): ${f.description}\n`;
  });
  md += `\n### AI Features\n`;
  (featData.aiFeatures || []).forEach(f => {
    md += `- **${f.name}** (${f.aiType}): ${f.description} (Needs data: ${f.dataRequired?.join(', ') || 'N/A'})\n`;
  });
  md += `\n`;

  // Database
  md += `## 5. Database Schema (${dbData.databaseType || 'SQL'})\n`;
  md += `*Scaling Strategy: ${dbData.scalingStrategy || 'N/A'}*\n\n`;
  (dbData.collections || []).forEach(col => {
    md += `### Table/Collection: \`${col.name}\`\n`;
    md += `${col.description || ''}\n\n`;
    md += `| Field | Type | Required | Default | Description |\n`;
    md += `|---|---|---|---|---|\n`;
    (col.fields || []).forEach(f => {
      md += `| \`${f.name}\` | \`${f.type}\` | ${f.required ? 'Yes' : 'No'} | ${f.default || '—'} | ${f.description || ''} |\n`;
    });
    md += `\n`;
  });

  // API Spec
  md += `## 6. REST API Endpoints (Base: \`${apiData.baseUrl || '/api/v1'}\`)\n`;
  md += `*Auth Strategy: ${apiData.authStrategy || 'JWT'}*\n\n`;
  (apiData.endpoints || []).forEach(group => {
    md += `### Group: ${group.group}\n`;
    (group.routes || []).forEach(route => {
      md += `- **\`${route.method}\` ${route.path}** - Auth: ${route.auth || 'none'}, Limit: ${route.rateLimit || 'N/A'}\n`;
      md += `  *${route.description || ''}*\n`;
    });
    md += `\n`;
  });

  // Architecture
  md += `## 7. System Architecture\n`;
  md += `### Overview\n${archData.overview || 'N/A'}\n\n`;
  md += `### Frontend Layer\n`;
  md += `- **Framework:** ${archData.frontend?.framework || 'N/A'} (${archData.frontend?.type || 'SPA'})\n`;
  md += `- **Libraries:** ${archData.frontend?.keyLibraries?.join(', ') || 'None'}\n\n`;
  md += `### Backend Layer\n`;
  md += `- **Framework:** ${archData.backend?.framework || 'N/A'} (${archData.backend?.type || 'Monolith'})\n`;
  md += `- **Modules:** ${archData.backend?.keyModules?.join(', ') || 'None'}\n\n`;
  md += `### Infrastructure\n`;
  md += `- **Primary Database:** ${archData.database?.primary || 'N/A'}\n`;
  md += `- **File Storage:** ${archData.database?.fileStorage || 'N/A'}\n`;
  md += `- **Deployment Platform:** ${archData.deployment?.platform || 'N/A'}\n\n`;

  // Quality Review
  const qr = roadData.qualityReview || archData.qualityReview || {};
  md += `## 8. Quality & Architectural Review\n`;
  md += `### Quality Score: **${qr.overallScore || 85}/100**\n\n`;
  md += `#### Strengths\n`;
  (qr.strengths || []).forEach(s => { md += `- ✓ ${s}\n`; });
  md += `\n#### Risks & Weaknesses\n`;
  (qr.weaknesses || []).forEach(w => { md += `- ⚠️ ${w}\n`; });
  md += `\n#### Suggested Improvements\n`;
  (qr.suggestedImprovements || []).forEach(i => { md += `- → ${i}\n`; });

  return md;
}

module.exports = {
  generatePrismaSchema,
  generateSQLDDL,
  generateOpenAPISpec,
  generateFolderStructureText,
  generateExpressRoutes,
  generateMongooseModels,
  generateMarkdownReport
};
