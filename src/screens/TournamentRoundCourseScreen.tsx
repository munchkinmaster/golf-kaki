import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import type { CourseSelection } from '../components/CoursePicker';
import { CoursePicker } from '../components/CoursePicker';
import { IconButton } from '../components/IconButton';
import type { RootStackParamList } from '../navigation/types';
import { colors, getFontFamily, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'TournamentRoundCourse'>;

/**
 * MR11's "Change" — the MR2b course picker, titled for the round being set
 * up, with the planned (or current) course prefilled. Nothing is saved
 * here: "Save" hands the selection back to MR11, which confirms it.
 */
export function TournamentRoundCourseScreen({ navigation, route }: Props) {
  const { tournamentId, roundIndex, subtitle } = route.params;
  const [selection, setSelection] = useState<CourseSelection>(route.params.selection);
  const onChange = useCallback((patch: Partial<CourseSelection>) => setSelection((prev) => ({ ...prev, ...patch })), []);
  const canSave = Boolean(selection.courseId && selection.comboId && selection.defaultTee);

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <IconButton icon={ChevronLeft} size={44} iconSize={20} onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleGroup}>
            <Text style={styles.headerTitle}>Round {roundIndex} course</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <CoursePicker value={selection} onChange={onChange} autoPick showStartHole teeNote="Default for this round — players can still change their own tee" />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={`Save Round ${roundIndex}`}
            variant="accent"
            size="lg"
            block
            disabled={!canSave}
            onPress={() => navigation.popTo('TournamentSetupRound', { tournamentId, roundIndex, selection })}
            icon={<Check size={19} color={colors.textOnAccent} />}
            iconPosition="right"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfacePage },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[3],
  },
  headerTitleGroup: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 21,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: spacing[1], paddingBottom: spacing[6], gap: spacing[4] },
  footer: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3],
    paddingBottom: spacing[5],
    backgroundColor: colors.surfacePage,
  },
});
