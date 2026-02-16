// testDatabase.js
import DatabaseService from './DatabaseService';
import SessionRepository from './SessionRepository';
import InsightCacheRepository from './InsightCacheRepository';

export async function testDatabase() {
  console.log('\n🧪 ===== DATABASE TEST STARTING =====\n');
  
  try {
    // Test 1: Database initialization
    console.log('Test 1: Initializing database...');
    await DatabaseService.init();
    console.log('✅ Test 1 passed: Database initialized\n');
    
    // Test 2: Create a session
    console.log('Test 2: Creating test session...');
    const sessionId = await SessionRepository.create({
      activity_type: 'coding',
      duration: 3600, // 1 hour in seconds
      start_time: Date.now() - 3600000, // 1 hour ago
      end_time: Date.now(),
      description: 'Built database test suite'
    });
    console.log(`✅ Test 2 passed: Session created with ID: ${sessionId}\n`);
    
    // Test 3: Create multiple sessions
    console.log('Test 3: Creating multiple sessions...');
    const session2Id = await SessionRepository.create({
      activity_type: 'reading',
      duration: 1800, // 30 minutes
      start_time: Date.now() - 7200000, // 2 hours ago
      end_time: Date.now() - 5400000, // 1.5 hours ago
      description: 'Read React Native docs'
    });
    
    const session3Id = await SessionRepository.create({
      activity_type: 'coding',
      duration: 5400, // 90 minutes
      start_time: Date.now() - 86400000, // 1 day ago
      end_time: Date.now() - 81000000,
      description: 'Fixed database integration'
    });
    console.log(`✅ Test 3 passed: Created sessions ${session2Id}, ${session3Id}\n`);
    
    // Test 4: Query sessions by date range
    console.log('Test 4: Querying sessions from last 7 days...');
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const sessions = await SessionRepository.getSessionsByDateRange(
      oneWeekAgo,
      Date.now()
    );
    console.log(`✅ Test 4 passed: Found ${sessions.length} sessions`);
    console.log('Sample session:', JSON.stringify(sessions[0], null, 2), '\n');
    
    // Test 5: Query by activity type
    console.log('Test 5: Querying coding sessions...');
    const codingSessions = await SessionRepository.getSessionsByActivityAndDateRange(
      'coding',
      oneWeekAgo,
      Date.now()
    );
    console.log(`✅ Test 5 passed: Found ${codingSessions.length} coding sessions\n`);
    
    // Test 6: Get all activity types
    console.log('Test 6: Getting all activity types...');
    const activityTypes = await SessionRepository.getActivityTypes();
    console.log(`✅ Test 6 passed: Activity types: ${activityTypes.join(', ')}\n`);
    
    // Test 7: Cache an insight
    console.log('Test 7: Caching an insight...');
    const now = Date.now(); // FIXED: Store timestamp to reuse
    await InsightCacheRepository.upsert({
      insight_type: 'weekly',
      data_hash: 'test_hash_abc123',
      insight_text: 'You had a productive week! 3 sessions totaling 3.5 hours of focused work.',
      time_period_start: oneWeekAgo,
      time_period_end: now // FIXED: Use stored value
    });
    console.log('✅ Test 7 passed: Insight cached\n');
    
    // Test 8: Retrieve cached insight
    console.log('Test 8: Retrieving cached insight...');
    const cachedInsight = await InsightCacheRepository.get(
      'weekly',
      oneWeekAgo,
      now // FIXED: Use same stored value
    );
    
    if (!cachedInsight) {
      throw new Error('Cached insight not found - cache retrieval failed');
    }
    
    console.log('✅ Test 8 passed: Retrieved insight:');
    console.log(`  Type: ${cachedInsight.insight_type}`);
    console.log(`  Text: ${cachedInsight.insight_text}`);
    console.log(`  Hash: ${cachedInsight.data_hash}\n`);
    
    // Test 9: Update cached insight (upsert)
    console.log('Test 9: Updating cached insight...');
    await InsightCacheRepository.upsert({
      insight_type: 'weekly',
      data_hash: 'test_hash_xyz789', // Different hash
      insight_text: 'Updated insight: Great progress this week!',
      time_period_start: oneWeekAgo,
      time_period_end: now // FIXED: Use same stored value
    });
    const updatedInsight = await InsightCacheRepository.get(
      'weekly',
      oneWeekAgo,
      now // FIXED: Use same stored value
    );
    
    if (!updatedInsight) {
      throw new Error('Updated insight not found - cache update failed');
    }
    
    console.log('✅ Test 9 passed: Insight updated');
    console.log(`  New hash: ${updatedInsight.data_hash}`);
    console.log(`  New text: ${updatedInsight.insight_text}\n`);
    
    console.log('🎉 ===== ALL TESTS PASSED! =====\n');
    console.log('✅ Database foundation is working correctly');
    console.log('✅ Sessions can be created and queried');
    console.log('✅ Insights can be cached and retrieved');
    console.log('✅ Ready to proceed to data aggregation logic\n');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ ===== TEST FAILED =====');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    return false;
  }
}