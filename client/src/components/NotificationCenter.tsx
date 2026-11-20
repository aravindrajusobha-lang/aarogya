import React, { useState, useEffect } from 'react';
import { AuthUser } from './AuthPanel';

const createNotificationMutationId = (): string => typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.random() * 16 | 0;
    return (char === 'x' ? value : (value & 0x3 | 0x8)).toString(16);
  });

export interface ChannelDeliveryStatus {
  channel: 'in_app' | 'sms' | 'email';
  delivered: boolean;
  status: 'delivered' | 'BLOCKED_STUB' | 'skipped_by_preference' | 'failed';
  attemptedAt: string;
  reason?: string;
  claimed?: boolean;
}

export interface InAppNotification {
  notificationId: string;
  recipientId: string;
  recipientRole?: string;
  title: string;
  body: string;
  templateId?: string;
  category: 'screening' | 'referral' | 'camp' | 'duplicate_alert' | 'security' | 'advisory';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: ('in_app' | 'sms' | 'email')[];
  deliveryStatus: ChannelDeliveryStatus[];
  overallStatus: 'delivered' | 'partially_delivered' | 'blocked' | 'skipped';
  read: boolean;
  readAt?: string;
  link?: string;
  createdAt: string;
}

export interface UserPreferences {
  channels: {
    inApp: boolean;
    sms: boolean;
    email: boolean;
  };
  categories: {
    screening: boolean;
    referral: boolean;
    camp: boolean;
    duplicateAlert: boolean;
    securityAlert: boolean;
    advisory: boolean;
  };
  preferredLanguage: 'en' | 'te' | 'hi';
  phone?: string;
  email?: string;
}

interface NotificationCenterProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  accessToken,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'inbox' | 'compose' | 'preferences'>('inbox');
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  // Selected Notification for Delivery Status Modal
  const [selectedNotif, setSelectedNotif] = useState<InAppNotification | null>(null);

  // Compose State
  const [composeTemplate, setComposeTemplate] = useState<string>('SCREENING_RECORDED');
  const [composeCategory, setComposeCategory] = useState<string>('screening');
  const [composePriority, setComposePriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [composePatientId, setComposePatientId] = useState<string>('PAD-2026-88192');
  const [composeFacility, setComposeFacility] = useState<string>('Paderu Area Hospital');
  const [composeVillage, setComposeVillage] = useState<string>('Vankachinta');
  const [composeCampDate, setComposeCampDate] = useState<string>('2026-11-15');
  const [composeScore, setComposeScore] = useState<number>(85);
  const [composeChannels, setComposeChannels] = useState<{
    in_app: boolean;
    sms: boolean;
    email: boolean;
  }>({
    in_app: true,
    sms: true,
    email: true,
  });
  const [sending, setSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
    notice?: string;
    deliveryStatus?: ChannelDeliveryStatus[];
  } | null>(null);

  // Preferences State
  const [preferences, setPreferences] = useState<UserPreferences>({
    channels: { inApp: true, sms: false, email: false },
    categories: {
      screening: true,
      referral: true,
      camp: true,
      duplicateAlert: true,
      securityAlert: true,
      advisory: true,
    },
    preferredLanguage: 'en',
    phone: '',
    email: '',
  });
  const [prefLoading, setPrefLoading] = useState<boolean>(false);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);

  // Fetch Notifications
  const fetchNotifications = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/v1/notifications?limit=50`;
      if (unreadOnly) url += `&unreadOnly=true`;
      if (filterCategory !== 'all') url += `&category=${filterCategory}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept-Language': preferences.preferredLanguage,
        },
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to fetch notifications');
      }

      setNotifications(json.data?.notifications || []);
      setUnreadCount(json.data?.unreadCount || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to notification service');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Preferences
  const fetchPreferences = async () => {
    if (!accessToken) return;
    setPrefLoading(true);
    try {
      const res = await fetch('/api/v1/notifications/preferences', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const json = await res.json();
      if (res.ok && json.data?.preferences) {
        setPreferences({
          channels: json.data.preferences.channels || { inApp: true, sms: false, email: false },
          categories: json.data.preferences.categories || {
            screening: true,
            referral: true,
            camp: true,
            duplicateAlert: true,
            securityAlert: true,
            advisory: true,
          },
          preferredLanguage: json.data.preferences.preferredLanguage || 'en',
          phone: json.data.preferences.phone || '',
          email: json.data.preferences.email || '',
        });
      }
    } catch {
      // Keep defaults
    } finally {
      setPrefLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      fetchNotifications();
      fetchPreferences();
    }
  }, [accessToken, unreadOnly, filterCategory]);

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.notificationId === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // Ignore
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/v1/notifications/read-all', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() })));
        setUnreadCount(0);
      }
    } catch {
      // Ignore
    }
  };

  // Save Preferences
  const savePreferences = async () => {
    if (!accessToken) return;
    setPrefLoading(true);
    setPrefSuccess(null);
    try {
      const res = await fetch('/api/v1/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ ...preferences, mutationId: createNotificationMutationId() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to update preferences');
      setPrefSuccess('Notification preferences saved successfully.');
      setTimeout(() => setPrefSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Error updating preferences');
    } finally {
      setPrefLoading(false);
    }
  };

  // Dispatch Notification
  const handleDispatchNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSending(true);
    setSendResult(null);

    const activeChannels: ('in_app' | 'sms' | 'email')[] = [];
    if (composeChannels.in_app) activeChannels.push('in_app');
    if (composeChannels.sms) activeChannels.push('sms');
    if (composeChannels.email) activeChannels.push('email');

    let params: Record<string, any> = {};
    if (composeTemplate === 'SCREENING_RECORDED') {
      params = { patientId: composePatientId };
    } else if (composeTemplate === 'REFERRAL_DISPATCHED') {
      params = { patientId: composePatientId, facilityName: composeFacility };
    } else if (composeTemplate === 'CAMP_SCHEDULED') {
      params = { villageName: composeVillage, campDate: composeCampDate };
    } else if (composeTemplate === 'DUPLICATE_ALERT') {
      params = { patientId: composePatientId, score: composeScore };
    } else if (composeTemplate === 'SECURITY_ALERT') {
      params = { deviceInfo: 'Chrome / Windows (ASR District Field Tab)', timestamp: new Date().toLocaleTimeString() };
    }

    try {
      const res = await fetch('/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          templateId: composeTemplate,
          params,
          category: composeCategory,
          priority: composePriority,
          channels: activeChannels,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to enqueue notification');
      }

      setSendResult({
        success: true,
        message: 'Notification enqueued and evaluated through delivery queue.',
        notice: json.data?.notice,
        deliveryStatus: json.data?.deliveryStatus,
      });

      fetchNotifications();
    } catch (err: any) {
      setSendResult({
        success: false,
        message: err.message || 'Dispatch error occurred',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem', fontFamily: 'inherit' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          padding: '1.5rem',
          color: 'var(--text-primary)',
          boxShadow: 'var(--surface-shadow)',
          border: '1px solid var(--border)',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🔔</span>
            <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Notifications
            </h2>
            {unreadCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '20px',
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  boxShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Signed in as <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.fullName || currentUser?.userId || 'Health Worker'}</strong>
            <span> · {currentUser?.role?.replace(/_/g, ' ') || 'Account'}</span>
          </p>
        </div>

        {/* Safety & Adapter Banner */}
        <div
          style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-text)',
            borderRadius: '10px',
            padding: '0.6rem 0.9rem',
            color: 'var(--warning-text)',
            fontSize: '0.875rem',
            maxWidth: '420px',
            lineHeight: 1.5,
          }}
        >
          <strong>Demo delivery:</strong> SMS and email are unavailable. Notifications are shown in the app only.
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('inbox')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            border: `1px solid ${activeTab === 'inbox' ? 'var(--btn-primary-bg)' : 'var(--border)'}`,
            background: activeTab === 'inbox' ? 'var(--btn-primary-bg)' : 'var(--surface)',
            color: activeTab === 'inbox' ? 'var(--btn-primary-text)' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          📥 Inbox {unreadCount > 0 && `(${unreadCount})`}
        </button>
        <button
          onClick={() => setActiveTab('compose')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            border: `1px solid ${activeTab === 'compose' ? 'var(--btn-primary-bg)' : 'var(--border)'}`,
            background: activeTab === 'compose' ? 'var(--btn-primary-bg)' : 'var(--surface)',
            color: activeTab === 'compose' ? 'var(--btn-primary-text)' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ✉️ Dispatch Notification
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          style={{
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
            border: `1px solid ${activeTab === 'preferences' ? 'var(--btn-primary-bg)' : 'var(--border)'}`,
            background: activeTab === 'preferences' ? 'var(--btn-primary-bg)' : 'var(--surface)',
            color: activeTab === 'preferences' ? 'var(--btn-primary-text)' : 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          ⚙️ Notification Preferences
        </button>
      </div>

      {/* TAB 1: INBOX */}
      {activeTab === 'inbox' && (
        <div>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              marginBottom: '1rem',
              background: 'var(--surface)',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Filter category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                }}
              >
                <option value="all">All Categories</option>
                <option value="screening">Screening</option>
                <option value="referral">Referral</option>
                <option value="camp">Screening Camp</option>
                <option value="duplicate_alert">Duplicate Alert</option>
                <option value="security">Security Alert</option>
                <option value="advisory">Advisory</option>
              </select>

              <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
                Unread only
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={fetchNotifications}
                style={{
                  padding: '0.4rem 0.85rem',
                  background: 'var(--surface-2)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                🔄 Refresh
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  style={{
                    padding: '0.4rem 0.85rem',
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              Loading in-app notifications...
            </div>
          )}

          {/* Empty state */}
          {!loading && notifications.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                background: 'var(--surface)',
                borderRadius: '12px',
                border: '1px dashed var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No notifications yet</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Your inbox has no notifications matching the current filter.
              </p>
            </div>
          )}

          {/* Notifications List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {notifications.map((notif) => {
              const isUnread = !notif.read;
              const categoryColor: Record<string, string> = {
                screening: '#3b82f6',
                referral: '#a855f7',
                camp: '#10b981',
                duplicate_alert: '#f59e0b',
                security: '#ef4444',
                advisory: '#64748b',
              };
              const catColor = categoryColor[notif.category] || '#64748b';

              return (
                <div
                  key={notif.notificationId}
                  style={{
                    background: isUnread ? 'rgba(30, 58, 138, 0.25)' : 'rgba(30, 41, 59, 0.4)',
                    borderLeft: `4px solid ${catColor}`,
                    border: isUnread ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: `${catColor}22`,
                          color: catColor,
                          border: `1px solid ${catColor}55`,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {notif.category}
                      </span>
                      {notif.priority && notif.priority !== 'normal' && (
                        <span
                          style={{
                            background: notif.priority === 'urgent' ? '#7f1d1d' : '#854d0e',
                            color: '#fff',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {notif.priority}
                        </span>
                      )}
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f8fafc' }}>
                        {notif.title}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isUnread && (
                        <button
                          onClick={() => markAsRead(notif.notificationId)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#60a5fa',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>

                  <p style={{ margin: '0 0 0.75rem 0', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    {notif.body}
                  </p>
                  {notif.link && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const destination = new URL(notif.link!, window.location.origin);
                          if (destination.origin !== window.location.origin) return;
                          void markAsRead(notif.notificationId);
                          window.location.hash = destination.hash;
                        } catch { /* Ignore malformed or non-local notification destinations. */ }
                      }}
                      style={{ marginBottom: '0.75rem', cursor: 'pointer' }}
                    >
                      Open consultation
                    </button>
                  )}

                  {/* Channel Delivery Status Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Channels:</span>
                      {notif.deliveryStatus?.map((ds, idx) => {
                        const isBlocked = ds.status === 'BLOCKED_STUB';
                        const isDelivered = ds.delivered;
                        return (
                          <span
                            key={idx}
                            style={{
                              background: isDelivered
                                ? 'rgba(16, 185, 129, 0.15)'
                                : isBlocked
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(148, 163, 184, 0.15)',
                              color: isDelivered ? '#34d399' : isBlocked ? '#fbbf24' : '#94a3b8',
                              border: `1px solid ${
                                isDelivered
                                  ? 'rgba(16, 185, 129, 0.3)'
                                  : isBlocked
                                  ? 'rgba(245, 158, 11, 0.3)'
                                  : 'rgba(148, 163, 184, 0.3)'
                              }`,
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {ds.channel.toUpperCase()}: {ds.status}
                          </span>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setSelectedNotif(notif)}
                      style={{
                        background: 'transparent',
                        color: '#93c5fd',
                        border: 'none',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Audit Delivery Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMPOSE / DISPATCH */}
      {activeTab === 'compose' && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '1.5rem',
            boxShadow: 'var(--surface-shadow)',
          }}
        >
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            Enqueue & Dispatch Notification
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Simulate event-driven notification generation across in-app, SMS, and Email channels.
            External adapters are strictly BLOCKED stubs in simulation mode.
          </p>

          <form onSubmit={handleDispatchNotification}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Select Clinical Safety Template:
                </label>
                <select
                  value={composeTemplate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setComposeTemplate(val);
                    if (val === 'SCREENING_RECORDED') setComposeCategory('screening');
                    if (val === 'REFERRAL_DISPATCHED') setComposeCategory('referral');
                    if (val === 'CAMP_SCHEDULED') setComposeCategory('camp');
                    if (val === 'DUPLICATE_ALERT') setComposeCategory('duplicate_alert');
                    if (val === 'SECURITY_ALERT') setComposeCategory('security');
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    padding: '0.6rem',
                    borderRadius: '6px',
                  }}
                >
                  <option value="SCREENING_RECORDED">Oral Health Screening Recorded</option>
                  <option value="REFERRAL_DISPATCHED">Clinical Referral Consultation Requested</option>
                  <option value="CAMP_SCHEDULED">Oral Screening Camp Scheduled</option>
                  <option value="DUPLICATE_ALERT">Duplicate Patient Intake Review Required</option>
                  <option value="SECURITY_ALERT">New Device Authentication Session</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Priority:
                </label>
                <select
                  value={composePriority}
                  onChange={(e: any) => setComposePriority(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    padding: '0.6rem',
                    borderRadius: '6px',
                  }}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Template Parameters */}
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem',
              }}
            >
              <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--accent)', fontSize: '0.95rem' }}>
                Template Parameters:
              </h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {(composeTemplate === 'SCREENING_RECORDED' ||
                  composeTemplate === 'REFERRAL_DISPATCHED' ||
                  composeTemplate === 'DUPLICATE_ALERT') && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Patient ID:
                    </label>
                    <input
                      type="text"
                      value={composePatientId}
                      onChange={(e) => setComposePatientId(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                )}

                {composeTemplate === 'REFERRAL_DISPATCHED' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Specialist Facility:
                    </label>
                    <input
                      type="text"
                      value={composeFacility}
                      onChange={(e) => setComposeFacility(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                )}

                {composeTemplate === 'CAMP_SCHEDULED' && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Village / Habitation:
                      </label>
                      <input
                        type="text"
                        value={composeVillage}
                        onChange={(e) => setComposeVillage(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Camp Date:
                      </label>
                      <input
                        type="date"
                        value={composeCampDate}
                        onChange={(e) => setComposeCampDate(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'var(--surface)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                  </>
                )}

                {composeTemplate === 'DUPLICATE_ALERT' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Duplicate Similarity Score (%):
                    </label>
                    <input
                      type="number"
                      value={composeScore}
                      onChange={(e) => setComposeScore(parseInt(e.target.value, 10))}
                      style={{
                        width: '100%',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Channels Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem' }}>
                Delivery Channels:
              </label>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={composeChannels.in_app}
                    onChange={(e) => setComposeChannels((c) => ({ ...c, in_app: e.target.checked }))}
                  />
                  📱 In-App (Real Inbox Delivery)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={composeChannels.sms}
                    onChange={(e) => setComposeChannels((c) => ({ ...c, sms: e.target.checked }))}
                  />
                  💬 SMS (BLOCKED STUB)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={composeChannels.email}
                    onChange={(e) => setComposeChannels((c) => ({ ...c, email: e.target.checked }))}
                  />
                  ✉️ Email (BLOCKED STUB)
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              style={{
                padding: '0.75rem 1.75rem',
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-sm)',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Dispatching...' : '🚀 Enqueue & Dispatch Notification'}
            </button>
          </form>

          {/* Result Alert */}
          {sendResult && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                background: sendResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${sendResult.success ? 'var(--success-text)' : 'var(--danger-text)'}`,
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', color: sendResult.success ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {sendResult.success ? '✓ Dispatch Successful' : '✕ Dispatch Failed'}
              </h4>
              <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {sendResult.message}
              </p>
              {sendResult.notice && (
                <div style={{ background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning-text)', padding: '0.5rem 0.75rem', color: 'var(--warning-text)', fontSize: '0.85rem', borderRadius: '4px' }}>
                  {sendResult.notice}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PREFERENCES */}
      {activeTab === 'preferences' && (
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
            Recipient Notification Preferences
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Configure delivery channels, subscribed notification categories, and language localization.
          </p>

          {prefSuccess && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              ✓ {prefSuccess}
            </div>
          )}

          {/* Language Preference */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Preferred Notification Language:
            </label>
            <select
              value={preferences.preferredLanguage}
              onChange={(e: any) =>
                setPreferences((p) => ({ ...p, preferredLanguage: e.target.value }))
              }
              style={{
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                padding: '0.6rem 1rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            >
              <option value="en">English (Official)</option>
              <option value="te">తెలుగు (Telugu - Tribal Habitations)</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
          </div>

          {/* Delivery Channels */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              Channel Preferences:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.channels.inApp}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      channels: { ...p.channels, inApp: e.target.checked },
                    }))
                  }
                />
                In-App Notifications (Active Web App Session)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.channels.sms}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      channels: { ...p.channels, sms: e.target.checked },
                    }))
                  }
                />
                SMS Notifications (Enforces BLOCKED Stub in Simulation)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.channels.email}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      channels: { ...p.channels, email: e.target.checked },
                    }))
                  }
                />
                Email Notifications (Enforces BLOCKED Stub in Simulation)
              </label>
            </div>
          </div>

          {/* Category Subscriptions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
              Subscribed Categories:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.categories.screening}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      categories: { ...p.categories, screening: e.target.checked },
                    }))
                  }
                />
                Oral Health Screenings
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.categories.referral}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      categories: { ...p.categories, referral: e.target.checked },
                    }))
                  }
                />
                Specialist Referrals
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.categories.camp}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      categories: { ...p.categories, camp: e.target.checked },
                    }))
                  }
                />
                Community Screening Camps
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.categories.duplicateAlert}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      categories: { ...p.categories, duplicateAlert: e.target.checked },
                    }))
                  }
                />
                Duplicate Intake Alerts
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.categories.securityAlert}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      categories: { ...p.categories, securityAlert: e.target.checked },
                    }))
                  }
                />
                Security & Session Alerts
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  style={{ accentColor: 'var(--accent)' }}
                  checked={preferences.categories.advisory}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      categories: { ...p.categories, advisory: e.target.checked },
                    }))
                  }
                />
                System Advisories
              </label>
            </div>
          </div>

          <button
            onClick={savePreferences}
            disabled={prefLoading}
            style={{
              padding: '0.65rem 1.5rem',
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: prefLoading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              opacity: prefLoading ? 0.7 : 1,
            }}
          >
            {prefLoading ? 'Saving...' : '💾 Save Notification Preferences'}
          </button>
        </div>
      )}

      {/* DELIVERY STATUS AUDIT MODAL */}
      {selectedNotif && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              maxWidth: '650px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                Delivery Status Audit: {selectedNotif.notificationId}
              </h3>
              <button
                onClick={() => setSelectedNotif(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1.25rem', padding: '0.75rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Title:</div>
              <div style={{ fontWeight: 600 }}>{selectedNotif.title}</div>
            </div>

            <h4 style={{ margin: '0 0 0.75rem 0', color: '#93c5fd', fontSize: '0.95rem' }}>
              Channel Delivery Dispatches:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {selectedNotif.deliveryStatus?.map((ds, idx) => {
                const isBlocked = ds.status === 'BLOCKED_STUB';
                const isDelivered = ds.delivered;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(30, 41, 59, 0.6)',
                      border: `1px solid ${
                        isDelivered
                          ? 'rgba(16, 185, 129, 0.3)'
                          : isBlocked
                          ? 'rgba(245, 158, 11, 0.3)'
                          : 'rgba(148, 163, 184, 0.2)'
                      }`,
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                        Channel: {ds.channel}
                      </span>
                      <span
                        style={{
                          background: isDelivered ? '#065f46' : isBlocked ? '#854d0e' : '#334155',
                          color: '#fff',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {ds.status} (Delivered: {String(ds.delivered)})
                      </span>
                    </div>

                    {ds.reason && (
                      <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <strong>Reason / Evidence:</strong> {ds.reason}
                      </p>
                    )}

                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Attempted: {new Date(ds.attemptedAt).toLocaleString()} | Delivery Claimed: {String(ds.claimed ?? false)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                onClick={() => setSelectedNotif(null)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
