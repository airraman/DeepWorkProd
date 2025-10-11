import { InsightGenerator } from './InsightGenerator';
import { SessionRepository } from '../database/SessionRepository';

export async function testInsightGenerator() {
  console.log('🧪 Testing InsightGenerator...\n');

  const generator = new InsightGenerator();
  const sessionRepo = new SessionRepository();

  try {
    // Add test sessions
    console.log('Adding test sessions...');
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    await sessionRepo.createSession({
      activity_type: 'Deep Work',
      duration: 3600,
      start_time: yesterday,
      end_time: yesterday + 3600000,
      description: 'Worked on React Native project',
    });

    await sessionRepo.createSession({
      activity_type: 'Reading',
      duration: 1800,
      start_time: yesterday + 4000000,
      end_time: yesterday + 5800000,
      description: 'Read technical documentation',
    });

    // Test 1: Generate daily insight (should generate new)
    console.log('\n📊 Test 1: Generate daily insight...');
    const dailyInsight1 = await generator.generate('daily');
    console.log('Result:', dailyInsight1.success ? '✅ PASS' : '❌ FAIL');
    console.log('Insight:', dailyInsight1.insightText.substring(0, 100) + '...');
    console.log('From cache:', dailyInsight1.metadata.fromCache ? 'Yes' : 'No (Fresh)');

    // Test 2: Generate again (should use cache)
    console.log('\n📊 Test 2: Generate daily insight again (should hit cache)...');
    const dailyInsight2 = await generator.generate('daily');
    console.log('Result:', dailyInsight2.success ? '✅ PASS' : '❌ FAIL');
    console.log('From cache:', dailyInsight2.metadata.fromCache ? '✅ Yes' : '❌ No');

    // Test 3: Force regenerate
    console.log('\n📊 Test 3: Force regenerate...');
    const dailyInsight3 = await generator.generate('daily', { forceRegenerate: true });
    console.log('Result:', dailyInsight3.success ? '✅ PASS' : '❌ FAIL');
    console.log('From cache:', dailyInsight3.metadata.fromCache ? '❌ Yes' : '✅ No (Forced)');

    // Test 4: Activity-specific insight
    console.log('\n📊 Test 4: Activity-specific insight...');
    const activityInsight = await generator.generate('activity_deepwork_week', {
      activityType: 'Deep Work',
    });
    console.log('Result:', activityInsight.success ? '✅ PASS' : '❌ FAIL');
    console.log('Insight:', activityInsight.insightText.substring(0, 100) + '...');

    console.log('\n✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}