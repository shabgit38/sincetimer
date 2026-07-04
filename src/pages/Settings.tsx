import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Database, Download, Info, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  createBackup,
  downloadExcelBackup,
  downloadJsonBackup,
  getBackupSummary,
  readBackupFile,
  restoreBackup,
  type BackupFormat,
  type RestoreMode,
} from '@/lib/backup';
import { getHistoryMonths, pruneOldHistory } from '@/lib/db';
import {
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushSubscription,
  getNotificationPermission,
  getPushSupport,
} from '@/lib/pushNotifications';

const retentionOptions = [1, 3, 6, 12];

export default function SettingsPage() {
  const pushSupport = getPushSupport();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [historyMonths, setHistoryMonths] = useState(6);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [pushEnabled, setPushEnabled] = useState(false);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [months, subscription] = await Promise.all([getHistoryMonths(), getCurrentPushSubscription()]);
        setHistoryMonths(months);
        setPushEnabled(Boolean(subscription));
        setPermission(getNotificationPermission());
      } catch (loadError) {
        console.error(loadError);
        setError('Unable to load settings.');
      }
    };
    void load();
  }, []);

  const handleRetentionChange = async (months: number) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await pruneOldHistory(months);
      setHistoryMonths(months);
      setStatus(`History retention set to ${months} month${months === 1 ? '' : 's'}.`);
    } catch (saveError) {
      console.error(saveError);
      setError('Unable to update history retention.');
    } finally {
      setBusy(false);
    }
  };

  const handleEnablePush = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await enablePushNotifications();
      setPushEnabled(true);
      setPermission(getNotificationPermission());
      setStatus('Push notifications enabled for this device.');
    } catch (enableError) {
      console.error(enableError);
      setPermission(getNotificationPermission());
      setError(enableError instanceof Error ? enableError.message : 'Unable to enable push notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await disablePushNotifications();
      setPushEnabled(false);
      setPermission(getNotificationPermission());
      setStatus('Push notifications disabled for this device.');
    } catch (disableError) {
      console.error(disableError);
      setError('Unable to disable push notifications.');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async (format: BackupFormat) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const backup = await createBackup();
      if (format === 'json') {
        downloadJsonBackup(backup);
      } else {
        downloadExcelBackup(backup);
      }
      setStatus(`Backup exported (${getBackupSummary(backup)}).`);
    } catch (exportError) {
      console.error(exportError);
      setError(exportError instanceof Error ? exportError.message : 'Unable to export backup.');
    } finally {
      setBusy(false);
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    if (
      restoreMode === 'replace' &&
      !window.confirm('Replace your current app data with this backup? This removes your current entries, logs, plans, areas, categories, and settings first.')
    ) {
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const backup = await readBackupFile(file);
      const result = await restoreBackup(backup, restoreMode);
      const restored = Object.entries(result.counts)
        .map(([table, count]) => `${table}: ${count}`)
        .join(', ');
      setStatus(`Backup imported in ${restoreMode} mode (${restored}).`);
    } catch (importError) {
      console.error(importError);
      setError(importError instanceof Error ? importError.message : 'Unable to import backup.');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto grid max-w-4xl gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Settings</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-50">App preferences</h2>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-start gap-3">
          <Download className="mt-1 h-5 w-5 text-stone-500 dark:text-stone-400" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Backup and restore</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Download a portable backup or restore your entries, history, plans, areas, categories, and settings.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void handleExport('json')}>
                Export JSON
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void handleExport('xlsx')}>
                Export Excel
              </Button>
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <label className="text-sm font-medium text-stone-700 dark:text-stone-200" htmlFor="restore-mode">
                Import mode
              </label>
              <select
                id="restore-mode"
                value={restoreMode}
                disabled={busy}
                onChange={(event) => setRestoreMode(event.target.value as RestoreMode)}
                className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 dark:border-white/10 dark:bg-stone-950 dark:text-stone-100"
              >
                <option value="merge">Merge with current data</option>
                <option value="replace">Replace my current data</option>
              </select>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Replace mode clears your current user data first. Device push notification registrations are not imported.
              </p>
              <div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => void handleImportFile(event.target.files?.[0])}
                />
                <Button type="button" variant="outline" disabled={busy} onClick={() => importInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import backup
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-start gap-3">
          <Database className="mt-1 h-5 w-5 text-stone-500 dark:text-stone-400" />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-50">History retention</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Keep logged history for the selected number of months.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {retentionOptions.map((months) => (
                <Button
                  key={months}
                  type="button"
                  variant={historyMonths === months ? 'default' : 'outline'}
                  disabled={busy}
                  onClick={() => void handleRetentionChange(months)}
                >
                  {months} month{months === 1 ? '' : 's'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-start gap-3">
          {pushEnabled ? (
            <Bell className="mt-1 h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          ) : (
            <BellOff className="mt-1 h-5 w-5 text-stone-500 dark:text-stone-400" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Push notifications</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Register this browser or installed PWA to receive reminder notifications when the app is not open.
            </p>
            <dl className="mt-4 grid gap-3 text-sm text-stone-600 dark:text-stone-300 sm:grid-cols-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <dt className="text-xs uppercase tracking-[0.16em] text-stone-400">Support</dt>
                <dd className="mt-1 font-medium">{pushSupport.supported ? 'Available' : 'Unavailable'}</dd>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <dt className="text-xs uppercase tracking-[0.16em] text-stone-400">Permission</dt>
                <dd className="mt-1 font-medium">{permission}</dd>
              </div>
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                <dt className="text-xs uppercase tracking-[0.16em] text-stone-400">This device</dt>
                <dd className="mt-1 font-medium">{pushEnabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
            </dl>
            {!pushSupport.supported ? (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{pushSupport.reason}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" disabled={busy || !pushSupport.supported || pushEnabled} onClick={() => void handleEnablePush()}>
                Enable on this device
              </Button>
              <Button type="button" variant="outline" disabled={busy || !pushEnabled} onClick={() => void handleDisablePush()}>
                Disable on this device
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-start gap-3">
          <Info className="mt-1 h-5 w-5 text-stone-500 dark:text-stone-400" />
          <div>
            <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-50">Version</h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">GUIDR web 0.0.0</p>
          </div>
        </div>
      </div>

      {status ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
    </section>
  );
}
