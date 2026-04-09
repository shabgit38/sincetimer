import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  HelperText,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAllEntries, insertEntry, updateEntry } from '../lib/db';
import type { Entry } from '../types/entry';

const categoryOptions = [
  { label: 'Purchase', value: 'purchase' },
  { label: 'Task', value: 'task' },
  { label: 'Event', value: 'event' },
  { label: 'Routine', value: 'routine' },
] as const;

type CategoryValue = (typeof categoryOptions)[number]['value'];

export default function AddEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const entryId = params.id ? Number(params.id) : null;
  const isEditing = Number.isFinite(entryId) && entryId !== null;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryValue>('purchase');
  const [entryDate, setEntryDate] = useState<Date>(new Date());
  const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date>(new Date());

  const [showEntryDatePicker, setShowEntryDatePicker] = useState(false);
  const [showNextDuePicker, setShowNextDuePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPurchase = category === 'purchase';

  const formattedEntryDate = useMemo(
    () => entryDate.toLocaleDateString(),
    [entryDate]
  );

  const formattedNextDueDate = useMemo(
    () => (nextDueDate ? nextDueDate.toLocaleDateString() : 'Not set'),
    [nextDueDate]
  );

  const formattedReminderTime = useMemo(
    () => reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [reminderTime]
  );

  const hydrateEntry = useCallback(async () => {
    if (!isEditing || entryId === null) return;
    const rows = await getAllEntries();
    const entry = (rows as Entry[]).find((row) => row.id === entryId);
    if (!entry) return;

    setTitle(entry.title);
    setCategory(entry.category);
    setEntryDate(new Date(entry.entry_date));
    setNextDueDate(entry.next_due_date ? new Date(entry.next_due_date) : null);
    setPrice(entry.price !== null && entry.price !== undefined ? String(entry.price) : '');
    setNotes(entry.notes ?? '');
    setReminderEnabled(entry.reminder_enabled === 1);
  }, [entryId, isEditing]);

  useEffect(() => {
    void hydrateEntry();
  }, [hydrateEntry]);

  const scheduleReminder = useCallback(async () => {
    if (!reminderEnabled || !nextDueDate) return;

    const scheduledDate = new Date(nextDueDate);
    scheduledDate.setHours(reminderTime.getHours(), reminderTime.getMinutes(), 0, 0);

    await Notifications.requestPermissionsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Since Timer',
        body: `Time to log: ${title || 'entry'}`,
      },
      trigger: scheduledDate,
    });
  }, [nextDueDate, reminderEnabled, reminderTime, title]);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    if (!entryDate) {
      setError('Please select an entry date.');
      return;
    }
    if (reminderEnabled && !nextDueDate) {
      setError('Please set a next due date for reminders.');
      return;
    }

    let priceValue: number | null = null;
    if (isPurchase && price.trim().length > 0) {
      const parsed = Number(price);
      if (Number.isNaN(parsed)) {
        setError('Price must be a valid number.');
        return;
      }
      priceValue = parsed;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        entry_date: entryDate.toISOString(),
        next_due_date: nextDueDate ? nextDueDate.toISOString() : null,
        price: isPurchase ? priceValue : null,
        notes: notes.trim() ? notes.trim() : null,
        reminder_enabled: reminderEnabled ? 1 : 0,
      };

      if (isEditing && entryId !== null) {
        await updateEntry(entryId, payload);
      } else {
        await insertEntry(payload);
      }

      await scheduleReminder();
      router.back();
    } catch (saveError) {
      setError('Failed to save entry.');
      console.error(saveError);
    } finally {
      setSaving(false);
    }
  }, [
    category,
    entryDate,
    entryId,
    isEditing,
    isPurchase,
    nextDueDate,
    notes,
    price,
    reminderEnabled,
    router,
    scheduleReminder,
    title,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text variant="headlineMedium" style={styles.header}>
          {isEditing ? 'Edit Entry' : 'Add Entry'}
        </Text>

        <TextInput
          label="Title"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          style={styles.input}
        />

        <Text variant="titleSmall" style={styles.sectionLabel}>
          Category
        </Text>
        <SegmentedButtons
          value={category}
          onValueChange={(value) => setCategory(value as CategoryValue)}
          buttons={categoryOptions}
          style={styles.segment}
        />

        <View style={styles.dateRow}>
          <View style={styles.dateColumn}>
            <Text variant="titleSmall" style={styles.sectionLabel}>
              Entry Date
            </Text>
            <Button mode="outlined" onPress={() => setShowEntryDatePicker(true)}>
              {formattedEntryDate}
            </Button>
          </View>
          <View style={styles.dateColumn}>
            <Text variant="titleSmall" style={styles.sectionLabel}>
              Next Due Date
            </Text>
            <Button mode="outlined" onPress={() => setShowNextDuePicker(true)}>
              {formattedNextDueDate}
            </Button>
          </View>
        </View>

        {isPurchase ? (
          <TextInput
            label="Price"
            value={price}
            onChangeText={setPrice}
            mode="outlined"
            keyboardType="decimal-pad"
            style={styles.input}
          />
        ) : null}

        <TextInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={4}
          style={styles.input}
        />

        <View style={styles.reminderRow}>
          <Text variant="titleSmall">Reminder</Text>
          <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
        </View>

        {reminderEnabled ? (
          <Button mode="outlined" onPress={() => setShowReminderTimePicker(true)}>
            Reminder Time: {formattedReminderTime}
          </Button>
        ) : null}

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        >
          {isEditing ? 'Save Changes' : 'Save Entry'}
        </Button>
      </ScrollView>

      {showEntryDatePicker ? (
        <DateTimePicker
          value={entryDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowEntryDatePicker(false);
            if (date) setEntryDate(date);
          }}
        />
      ) : null}

      {showNextDuePicker ? (
        <DateTimePicker
          value={nextDueDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowNextDuePicker(false);
            if (date) setNextDueDate(date);
          }}
        />
      ) : null}

      {showReminderTimePicker ? (
        <DateTimePicker
          value={reminderTime}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, date) => {
            setShowReminderTimePicker(false);
            if (date) setReminderTime(date);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'transparent',
  },
  sectionLabel: {
    marginBottom: 6,
  },
  segment: {
    alignSelf: 'stretch',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateColumn: {
    flex: 1,
  },
  reminderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    marginTop: 8,
  },
});
