import DataAggregator from './DataAggregator';
import { getDateRangeForPeriod } from '../../utils/dateHelpers';
import { hashSessions } from '../../utils/hashHelper';

export async function testAggregator() {
  console.log('\n🧪 ===== AGGREGATOR TEST =====\n');
  
  // Mock sessions
  const sessions = [
    {
      id: 1,
      activity_type: 'coding',
      duration: 3600,
      created_at: Date.now(),
      description: 'Built authentication system'
    },
    {
      id: 2,
      activity_type: 'coding',
      duration: 5400,
      created_at: Date.now(),
      description: 'Fixed bugs in login'
    },
    {
      id: 3,
      activity_type: 'reading',
      duration: 1800,
      created_at: Date.now(),
      description: 'Read React Native docs'
    }
  ];
  
  // Test aggregation
  const aggregated = DataAggregator.aggregateSessions(sessions);
  console.log('Aggregated data:', JSON.stringify(aggregated, null, 2));
  
  // Test hash
  const hash = hashSessions(sessions);
  console.log('Data hash:', hash);
  
  // Test date helpers
  const weekRange = getDateRangeForPeriod('week');
  console.log('Week range:', weekRange);
  
  console.log('\n✅ Aggregator test complete!\n');
}