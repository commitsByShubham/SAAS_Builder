/**
 * test_run.js - Test script to verify modular pipeline execution and caching
 */

const path = require('path');
require('dotenv').config();

const { generateBlueprint } = require('./services/blueprintPipeline');
const logger = require('./utils/logger');

const testIdea = "Build a micro-learning platform for software developers with AI bite-sized content generation";

async function runTest() {
  console.log('--- STARTING PIPELINE TEST ---');
  console.log(`API Key configured: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in backend/.env!');
    process.exit(1);
  }

  // Define progress callback
  const progressCallback = (event) => {
    console.log(`[Event] Stage: ${event.stage} | Status: ${event.status}`);
    if (event.error) {
      console.error(`  Error details: ${event.error}`);
    }
  };

  try {
    console.log('\n--- 1. FIRST RUN (AI Generation or Cache Check) ---');
    const start1 = Date.now();
    const blueprint1 = await generateBlueprint(testIdea, progressCallback);
    const dur1 = Date.now() - start1;
    
    console.log('\n✅ First run completed successfully!');
    console.log(`Total duration: ${(dur1/1000).toFixed(2)}s`);
    console.log(`Total tokens used: ${blueprint1.analytics.totalTokens}`);
    console.log(`Estimated cost: $${blueprint1.analytics.cost.toFixed(5)}`);
    console.log(`Has templates generated: ${!!blueprint1.templates}`);
    console.log(`Prisma schema sample length: ${blueprint1.templates.prisma?.length || 0} chars`);
    
    console.log('\n--- 2. SECOND RUN (Cache Hit expected) ---');
    const start2 = Date.now();
    const blueprint2 = await generateBlueprint(testIdea, progressCallback);
    const dur2 = Date.now() - start2;
    
    console.log('\n✅ Second run completed successfully!');
    console.log(`Total duration (cache): ${(dur2/1000).toFixed(2)}s`);
    console.log(`Is from cache: ${blueprint2.isFromCache}`);
    
    if (blueprint2.isFromCache && dur2 < 2000) {
      console.log('\n🎉 SUCCESS: Caching system and 2-call architecture verified successfully!');
    } else {
      console.error('\n❌ FAILURE: Caching or duration is not correct.');
    }

  } catch (err) {
    console.error('Test run failed:', err);
  }
}

runTest();
