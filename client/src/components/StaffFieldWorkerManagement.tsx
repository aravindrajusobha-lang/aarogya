import React, { useState } from 'react';
import { AuthUser } from './AuthPanel';
import { AssignmentManager } from './AssignmentManager';
import { InvitationManager } from './InvitationManager';

interface StaffFieldWorkerManagementProps {
  accessToken: string | null;
  currentUser: AuthUser | null;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

type ActiveTab = 'onboarding' | 'jurisdiction';

export const StaffFieldWorkerManagement: React.FC<StaffFieldWorkerManagementProps> = ({
  accessToken,
  currentUser,
  onRequireLogin,
  onGoToAuth,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('onboarding');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(6, 214, 160, 0.12) 0%, rgba(28, 114, 147, 0.18) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1.6rem' }}>👥</span>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>Staff &amp; Field Worker Management</h2>
          <span className="badge badge-real">Unified Admin Console</span>
        </div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.88rem', margin: 0, maxWidth: '900px' }}>
          Manage 72-hour staff onboarding and frontline worker village jurisdiction from one place. Onboard staff first, then assign ASHA/ANM village scope without leaving this section.
        </p>
      </div>

      <nav style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'onboarding' ? 'active' : ''}`}
          onClick={() => setActiveTab('onboarding')}
        >
          ✉️ Tab A: Staff Onboarding
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'jurisdiction' ? 'active' : ''}`}
          onClick={() => setActiveTab('jurisdiction')}
        >
          📍 Tab B: Worker Jurisdiction
        </button>
      </nav>

      {activeTab === 'onboarding' && (
        <div>
          <InvitationManager accessToken={accessToken} currentUser={currentUser} />
        </div>
      )}

      {activeTab === 'jurisdiction' && (
        <div>
          <AssignmentManager
            accessToken={accessToken}
            currentUser={currentUser}
            onRequireLogin={onRequireLogin}
            onGoToAuth={onGoToAuth}
          />
        </div>
      )}
    </div>
  );
};

export default StaffFieldWorkerManagement;
