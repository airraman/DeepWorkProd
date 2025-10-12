// src/services/insights/testOpenAI.js

import { InsightGenerator } from './InsightGenerator';
import SessionRepository from '../database/SessionRepository';

export async function testOpenAI() {
  console.log('\n🤖 ===== TESTING OPENAI INTEGRATION =====\n');

  try {
    const generator = new InsightGenerator();
    
    // Create test sessions
    console.log('Creating test sessions...');
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    await SessionRepository.create({
      activity_type: 'Deep Work',
      duration: 5400, // 90 minutes
      start_time: yesterday,
      end_time: yesterday + 5400000,
      description: 'Built OpenAI integration for insights feature',
    });

    await SessionRepository.create({
      activity_type: 'Reading',
      duration: 2700, // 45 minutes
      start_time: yesterday + 7200000,
      end_time: yesterday + 9900000,
      description: 'Read about prompt engineering best practices',
    });

    // Test 1: Generate daily insight with OpenAI
    console.log('\n📊 Test 1: Generating daily insight with OpenAI...');
    const dailyInsight = await generator.generate('daily');
    
    console.log('✅ Daily Insight Generated:');
    console.log('---');
    console.log(dailyInsight.insightText);
    console.log('---');
    console.log(`From cache: ${dailyInsight.metadata.fromCache}`);
    console.log(`Generated at: ${new Date(dailyInsight.metadata.generatedAt).toLocaleString()}`);

    // Test 2: Retrieve from cache (should not call OpenAI again)
    console.log('\n📊 Test 2: Retrieving cached insight...');
    const cachedInsight = await generator.generate('daily');
    
    console.log(`✅ Retrieved from cache: ${cachedInsight.metadata.fromCache}`);
    console.log(`Same text: ${cachedInsight.insightText === dailyInsight.insightText}`);

    // Test 3: Force regenerate (should call OpenAI again)
    console.log('\n📊 Test 3: Force regenerating...');
    const regeneratedInsight = await generator.generate('daily', {
      forceRegenerate: true,
    });
    
    console.log('✅ Regenerated Insight:');
    console.log('---');
    console.log(regeneratedInsight.insightText);
    console.log('---');
    console.log(`From cache: ${regeneratedInsight.metadata.fromCache}`);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Check OpenAI dashboard for API usage');
    console.log('   2. Implement UI components (Session 5)');
    console.log('   3. Add insights to MetricsScreen');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}