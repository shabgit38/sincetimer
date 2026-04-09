import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Card, Chip, Text, useTheme } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { getAllEntries } from '../../lib/db';
import { computeTimeSummary } from '../../lib/timeUtils';
import type { Entry } from '../../types/entry';

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<'all' | Entry['category']>('all');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getAllEntries();
      setEntries(rows as Entry[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
    }, [loadEntries])
  );

  const filteredEntries = useMemo(() => {
    if (categoryFilter === 'all') return entries;
    return entries.filter((entry) => entry.category === categoryFilter);
  }, [entries, categoryFilter]);

  const renderEntry = ({ item }: { item: Entry }) => {
    const entryDateLabel = formatDistanceToNowStrict(parseISO(item.entry_date), {
      addSuffix: true,
    });
    const summary = computeTimeSummary(item.entry_date, item.next_due_date);

    let dueLabel = 'No due date';
    let dueColor = theme.colors.onSurfaceVariant;
    if (item.next_due_date) {
      if (summary.isOverdue) {
        const overdueBy = Math.abs(summary.nextDueIn ?? 0);
        dueLabel = overdueBy === 0 ? 'Overdue' : `Overdue by ${overdueBy} days`;
        dueColor = theme.colors.error;
      } else if ((summary.nextDueIn ?? 0) === 0) {
        dueLabel = 'Due today';
        dueColor = theme.colors.tertiary;
      } else {
        dueLabel = `Due in ${summary.nextDueIn} days`;
      }
    }

    return (
      <Card
        style={styles.card}
        onPress={() => router.push(`/entry/${item.id}`)}
        mode="outlined"
      >
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            <Chip compact style={styles.badge} textStyle={styles.badgeText}>
              {item.category}
            </Chip>
          </View>
          <Text variant="bodySmall" style={styles.subtleText}>
            {entryDateLabel}
          </Text>
          <Text variant="bodyMedium" style={[styles.dueText, { color: dueColor }]}>
            {dueLabel}
          </Text>
          {item.category === 'purchase' && item.price !== null && item.price !== undefined ? (
            <Text variant="bodyMedium" style={styles.priceText}>
              ${Number(item.price).toFixed(2)}
            </Text>
          ) : null}
        </Card.Content>
      </Card>
    );
  };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={filteredEntries}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderEntry}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadEntries} />}
      ListHeaderComponent={
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { label: 'All', value: 'all' as const },
            { label: 'Purchase', value: 'purchase' as const },
            { label: 'Task', value: 'task' as const },
            { label: 'Event', value: 'event' as const },
            { label: 'Routine', value: 'routine' as const },
          ].map((chip) => (
            <Chip
              key={chip.value}
              selected={categoryFilter === chip.value}
              onPress={() => setCategoryFilter(chip.value)}
              style={styles.filterChip}
            >
              {chip.label}
            </Chip>
          ))}
        </ScrollView>
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text variant="headlineSmall">No entries yet</Text>
          <Text variant="bodyMedium" style={styles.subtleText}>
            Add your first entry to start tracking.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  filterRow: {
    paddingBottom: 12,
  },
  filterChip: {
    marginRight: 8,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
  badge: {
    alignSelf: 'flex-start',
  },
  badgeText: {
    textTransform: 'capitalize',
  },
  subtleText: {
    opacity: 0.6,
    marginTop: 4,
  },
  dueText: {
    marginTop: 6,
  },
  priceText: {
    marginTop: 6,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
    gap: 6,
  },
});
