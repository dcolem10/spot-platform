import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/ApiService';
import './AccountSettings.css';

export default function AccountSettings() {
  const navigate = useNavigate();
  const resetAuth = useAuthStore((s) => s.reset);
  const isDemoMode = useAuthStore((s) => s.isDemoMode);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Download all user data as JSON
  async function handleExport() {
    if (isDemoMode) {
      // In demo mode, return a stub export so the button isn't dead
      const blob = new Blob(
        [JSON.stringify({ demo: true, note: 'No real data in demo mode.' }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spot-data-demo.json';
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setExportDone(false);

    try {
      const result = await api.get('/api/profile/export');
      if (result.status === 'error') {
        setExportError(result.error ?? 'Export failed. Please try again.');
        return;
      }
      // Trigger browser download
      const blob = new Blob([JSON.stringify(result.data ?? result, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spot-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch {
      setExportError('An unexpected error occurred. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  // Confirm and submit account deletion
  async function handleDelete() {
    if (isDemoMode) {
      // Sign out of demo — no real deletion needed
      resetAuth();
      navigate('/', { replace: true });
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await api.delete('/api/profile');
      if (result.status === 'error') {
        setDeleteError(result.error ?? 'Deletion request failed. Please contact support.');
        setIsDeleting(false);
        return;
      }
      // Sign the user out — account is now marked for deletion
      try {
        const { signOut } = await import('aws-amplify/auth');
        await signOut();
      } catch {
        // ignore signOut errors
      }
      resetAuth();
      navigate('/?deleted=1', { replace: true });
    } catch {
      setDeleteError('An unexpected error occurred. Please contact support.');
      setIsDeleting(false);
    }
  }

  const deleteConfirmText = 'DELETE MY ACCOUNT';
  const deleteReady = deleteInput === deleteConfirmText;

  return (
    <div className="page-container account-settings">
      <div className="account-settings-header">
        <h1 className="account-settings-title">Account Settings</h1>
        <p className="account-settings-subtitle">
          Manage your data and account preferences.
        </p>
      </div>

      {/* ── Data & Privacy ── */}
      <section className="account-settings-section">
        <h2 className="account-settings-section-title">Data &amp; Privacy</h2>
        <p className="account-settings-section-desc">
          Under GDPR and CCPA you have the right to access a copy of your personal data and to
          request deletion of your account.
        </p>

        <div className="account-settings-cards">
          {/* Download card */}
          <div className="account-settings-card">
            <div className="account-settings-card-icon" aria-hidden="true">⬇</div>
            <div className="account-settings-card-body">
              <h3>Download Your Data</h3>
              <p>
                Export all data associated with your account — campaigns, offers, profile, and
                activity — as a JSON file.
              </p>
              {exportError && <p className="account-settings-error">{exportError}</p>}
              {exportDone && !exportError && (
                <p className="account-settings-success">
                  Download started. Check your downloads folder.
                </p>
              )}
            </div>
            <button
              className="account-settings-btn account-settings-btn--primary"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting…' : 'Download My Data'}
            </button>
          </div>

          {/* Delete card */}
          <div className="account-settings-card account-settings-card--danger">
            <div className="account-settings-card-icon" aria-hidden="true">🗑</div>
            <div className="account-settings-card-body">
              <h3>Delete Account</h3>
              <p>
                Permanently delete your account and all associated data. Your account will be
                deactivated immediately and all data will be removed within <strong>30 days</strong>.
                This action cannot be undone.
              </p>
            </div>
            {!showDeleteConfirm ? (
              <button
                className="account-settings-btn account-settings-btn--danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </button>
            ) : (
              <div className="account-settings-confirm">
                <p className="account-settings-confirm-label">
                  Type <strong>{deleteConfirmText}</strong> to confirm:
                </p>
                <input
                  className="account-settings-confirm-input"
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder={deleteConfirmText}
                  aria-label="Confirm account deletion"
                />
                {deleteError && <p className="account-settings-error">{deleteError}</p>}
                <div className="account-settings-confirm-actions">
                  <button
                    className="account-settings-btn account-settings-btn--ghost"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteInput('');
                      setDeleteError(null);
                    }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    className="account-settings-btn account-settings-btn--danger"
                    onClick={handleDelete}
                    disabled={!deleteReady || isDeleting}
                  >
                    {isDeleting ? 'Deleting…' : 'Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
