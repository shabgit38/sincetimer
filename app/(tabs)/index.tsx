import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">Entry List</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        Your tracked items will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  subtitle: {
    marginTop: 8,
    opacity: 0.6,
  },
});
