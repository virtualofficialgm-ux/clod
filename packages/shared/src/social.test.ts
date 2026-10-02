import { describe, expect, it } from 'vitest';
import { DEFAULT_PRIVACY, isOnline, notificationTarget, withDefaults } from './social';

describe('уведомления и присутствие', () => {
  it('ведёт уведомление в нужное место', () => {
    expect(notificationTarget({ kind: 'new_response', task_id: 't', actor_id: 'a' })).toEqual({ to: 'responses', id: 't' });
    expect(notificationTarget({ kind: 'work_submitted', task_id: 't', actor_id: 'a' })).toEqual({ to: 'room', id: 't' });
    expect(notificationTarget({ kind: 'direct_message', task_id: null, actor_id: 'a' })).toEqual({ to: 'direct', id: 'a' });
    expect(notificationTarget({ kind: 'contact_request', task_id: null, actor_id: 'a' })).toEqual({ to: 'connections', tab: 'requests' });
    expect(notificationTarget({ kind: 'skill_task', task_id: 't', actor_id: 'a' })).toEqual({ to: 'task', id: 't' });
  });

  it('«в сети» — последние 3 минуты', () => {
    const now = Date.parse('2026-10-02T12:00:00Z');
    expect(isOnline('2026-10-02T11:58:30Z', now)).toBe(true);
    expect(isOnline('2026-10-02T11:50:00Z', now)).toBe(false);
    expect(isOnline(null, now)).toBe(false);
  });

  it('приватность по умолчанию открыта', () => {
    expect(withDefaults({ city: 'me' })).toEqual({ ...DEFAULT_PRIVACY, city: 'me' });
  });
});

describe('рядом: расстояние, время, длительность', () => {
  it('считает расстояние и время пешком', async () => {
    const { distanceM, walkMinutes, durationBucket, routeUrl } = await import('./service');
    const d = distanceM({ lat: 55.75, lng: 37.61 }, { lat: 55.76, lng: 37.61 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
    expect(walkMinutes(1000)).toBe(16);
    expect(durationBucket(10)).toBe('short');
    expect(durationBucket(20)).toBe('mid');
    expect(durationBucket(45)).toBe('long');
    expect(durationBucket(null)).toBeNull();
    expect(routeUrl({ lat: 1, lng: 2 })).toContain('destination=1,2');
  });
});
