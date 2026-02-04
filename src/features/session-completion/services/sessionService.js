import { deepWorkStore } from '../../../services/deepWorkStore';

class SessionService {
  async saveRating(sessionId, rating) {
    const session = await deepWorkStore.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    await deepWorkStore.updateSession(sessionId, {
      ...session,
      rating: {
        rating: rating.rating,
        notes: rating.notes,
        ratedAt: rating.ratedAt,
      },
    });
  }

  async getSession(sessionId) {
    const session = await deepWorkStore.getSession(sessionId);
    if (!session) return null;
    
    const activity = await deepWorkStore.getActivity(session.activityId);
    
    return {
      id: session.id,
      activityName: activity?.name || 'Focus Session',
      duration: session.duration,
      completedAt: session.completedAt,
      rating: session.rating,
    };
  }
}

export const sessionService = new SessionService();