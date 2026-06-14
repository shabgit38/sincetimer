import { useEffect, useState } from 'react';
import { Bell, BellOff, Database, Info } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  const [historyMonths, setHistoryMonths] = useState(6);
  const [permission, setPermission] = useState(getNotificationPermission());
  const [pushEnabled, setPushEnabled] = useState(false);
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

  return (
    <section className="mx-auto grid max-w-4xl gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Settings</p>
        <h2 className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-50">App preferences</h2>
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
