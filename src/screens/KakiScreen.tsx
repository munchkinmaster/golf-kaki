import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ArrowDownUp,
  Check,
  ChevronRight,
  Clock,
  Plus,
  Search,
  Share2,
  UserPlus,
  UserRoundSearch,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Avatar } from '../components/Avatar';
import { BottomNav } from '../components/BottomNav';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { NotificationBell } from '../components/NotificationBell';
import type { AddCandidate, Friend, FriendRequest } from '../data/kaki';
import { acceptFriendRequest, fetchKakiOverview, removeKakiRelationship, sendFriendRequest } from '../data/kaki';
import { useNotificationCount } from '../hooks/useNotificationCount';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../state/AuthContext';
import { colors, getFontFamily, getPlayerColors, motion, palette, radius, screenGutter, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Kaki'>;

export function KakiScreen({ navigation }: Props) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const notificationCount = useNotificationCount(userId);

  const [query, setQuery] = useState('');
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [addCandidates, setAddCandidates] = useState<AddCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback((id: string) => {
    setLoading(true);
    setLoadError(false);
    fetchKakiOverview(id)
      .then(({ friends: f, requests: r, directory }) => {
        setFriends(f);
        setRequests(r);
        setAddCandidates(directory);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (userId) load(userId);
  }, [userId, load]);

  function confirmRequest(id: string) {
    const person = requests.find((r) => r.id === id);
    if (!person) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setFriends((prev) => [{ ...person, strokes18: 0 }, ...prev]);
    acceptFriendRequest(person.relationshipId).catch(() => userId && load(userId));
  }

  function dismissRequest(id: string) {
    const person = requests.find((r) => r.id === id);
    if (!person) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    removeKakiRelationship(person.relationshipId).catch(() => userId && load(userId));
  }

  function toggleAddCandidate(id: string) {
    const candidate = addCandidates.find((c) => c.id === id);
    if (!candidate || !userId) return;

    if (candidate.status === 'add') {
      setAddCandidates((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'requested' } : p)));
      sendFriendRequest(userId, id)
        .then((relationshipId) => {
          setAddCandidates((prev) => prev.map((p) => (p.id === id ? { ...p, relationshipId } : p)));
        })
        .catch(() => load(userId));
    } else {
      setAddCandidates((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'add' } : p)));
      if (candidate.relationshipId) removeKakiRelationship(candidate.relationshipId).catch(() => load(userId));
    }
  }

  const q = query.trim().toLowerCase();
  const filteredFriends = useMemo(
    () =>
      friends
        .filter((f) => !q || f.name.toLowerCase().includes(q) || f.handle.toLowerCase().includes(q))
        .slice()
        .sort((a, b) => (a.handicap ?? Infinity) - (b.handicap ?? Infinity)),
    [friends, q],
  );

  const aq = addQuery.trim();
  const aql = aq.toLowerCase();
  const filteredAddCandidates = useMemo(
    () => addCandidates.filter((p) => !aql || p.name.toLowerCase().includes(aql) || p.handle.toLowerCase().includes(aql)),
    [addCandidates, aql],
  );

  const showRequests = requests.length > 0 && !q;
  const noFriendsResult = filteredFriends.length === 0;

  return (
    <View style={styles.page}>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kaki</Text>
          <View style={styles.headerActions}>
            <NotificationBell count={notificationCount} size={40} iconSize={18} onPress={() => navigation.navigate('Notifications')} />
            <Button
              label="Add"
              variant="ghost"
              size="sm"
              icon={<UserPlus size={15} color={colors.primary} />}
              onPress={() => setAddOpen(true)}
              style={styles.addButton}
            />
          </View>
        </View>

        <View style={styles.searchWrap}>
          <SearchBar value={query} onChange={setQuery} placeholder="Search your kaki" />
          {loadError ? <Text style={styles.loadErrorText}>Couldn't load your kaki — check your connection and try again.</Text> : null}
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {loading ? <Text style={styles.loadingText}>Loading your kaki…</Text> : null}

          {!loading && showRequests ? (
            <View style={styles.requestsSection}>
              <View style={styles.requestsHeader}>
                <Text style={styles.sectionLabel}>Requests</Text>
                <View style={styles.requestCountBadge}>
                  <Text style={styles.requestCountText}>{requests.length}</Text>
                </View>
              </View>
              <View style={styles.requestList}>
                {requests.map((person, index) => (
                  <RequestRow
                    key={person.id}
                    person={person}
                    colorIndex={index}
                    onConfirm={() => confirmRequest(person.id)}
                    onDismiss={() => dismissRequest(person.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {!loading ? (
            <>
              <View style={styles.friendsHeader}>
                <Text style={styles.sectionLabel}>Friends · {friends.length}</Text>
                <View style={styles.sortIndicator}>
                  <ArrowDownUp size={12} color={colors.textDisabled} />
                  <Text style={styles.sortLabel}>Handicap</Text>
                </View>
              </View>

              <View style={styles.friendList}>
                {filteredFriends.map((person, index) => (
                  <FriendRow key={person.id} person={person} colorIndex={index} />
                ))}
                {noFriendsResult ? <NoFriendsResult /> : null}
              </View>
            </>
          ) : null}
        </ScrollView>

        <BottomNav
          active="kaki"
          onNavigate={(tab) => {
            if (tab === 'home') navigation.navigate('Home');
            if (tab === 'profile') navigation.navigate('Profile');
            if (tab === 'rounds') navigation.navigate('Rounds');
          }}
          onStart={() => navigation.navigate('SelectCourse')}
        />
      </SafeAreaView>

      <AddFriendSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        query={addQuery}
        onQueryChange={setAddQuery}
        candidates={filteredAddCandidates}
        hasQuery={aq.length > 0}
        onToggle={toggleAddCandidate}
      />
    </View>
  );
}

function getStrokeInfo(strokes18: number) {
  if (strokes18 > 0) {
    return { label: `give ${strokes18}`, background: palette.orange[100], border: palette.orange[200], color: palette.orange[700] };
  }
  if (strokes18 < 0) {
    return { label: `get ${Math.abs(strokes18)}`, background: palette.green[100], border: palette.green[200], color: palette.green[600] };
  }
  return { label: 'even', background: colors.surfaceSunken, border: colors.borderDefault, color: colors.textDisabled };
}

function handicapMeta(person: { handle: string; handicap: number | null }) {
  return `${person.handle} · HCP ${person.handicap ?? '–'}`;
}

function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchBar}>
      <Search size={18} color={colors.textDisabled} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textDisabled}
        style={styles.searchInput}
      />
      {value ? (
        <Pressable style={styles.searchClear} onPress={() => onChange('')}>
          <X size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function RequestRow({
  person,
  colorIndex,
  onConfirm,
  onDismiss,
}: {
  person: FriendRequest;
  colorIndex: number;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);

  return (
    <Card style={styles.requestCard} padding={11}>
      <View style={styles.requestTopRow}>
        <Avatar initials={person.name.charAt(0)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{person.name}</Text>
          <Text style={styles.personMeta}>{handicapMeta(person)}</Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <Pressable style={styles.confirmButton} onPress={onConfirm}>
          <Check size={15} color={colors.textInverse} />
          <Text style={styles.confirmLabel}>Confirm</Text>
        </Pressable>
        <Pressable style={styles.dismissButton} onPress={onDismiss}>
          <X size={16} color={colors.textDisabled} />
        </Pressable>
      </View>
    </Card>
  );
}

function FriendRow({ person, colorIndex }: { person: Friend; colorIndex: number }) {
  const playerColor = getPlayerColors(colorIndex);
  const stroke = getStrokeInfo(person.strokes18);

  return (
    <Card style={styles.friendRow} padding={11}>
      <Avatar initials={person.name.charAt(0)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{person.name}</Text>
        <Text style={styles.personMeta}>{handicapMeta(person)}</Text>
      </View>
      <View style={[styles.strokePill, { backgroundColor: stroke.background, borderColor: stroke.border }]}>
        <Text style={[styles.strokeLabel, { color: stroke.color }]}>{stroke.label}</Text>
      </View>
      <ChevronRight size={17} color={palette.sand[400]} />
    </Card>
  );
}

function NoFriendsResult() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <Users size={24} color={palette.sand[500]} />
      </View>
      <Text style={styles.emptyTitle}>No kaki match that</Text>
      <Text style={styles.emptyMeta}>Try another name or tap Add to find more.</Text>
    </View>
  );
}

function CandidateRow({
  candidate,
  colorIndex,
  onToggle,
}: {
  candidate: AddCandidate;
  colorIndex: number;
  onToggle: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);
  const requested = candidate.status === 'requested';

  return (
    <Card style={styles.candidateRow} padding={9}>
      <Avatar initials={candidate.name.charAt(0)} size={40} backgroundColor={playerColor.background} color={playerColor.color} />
      <View style={styles.personInfo}>
        <Text style={styles.personName}>{candidate.name}</Text>
        <Text style={styles.personMeta}>{handicapMeta(candidate)}</Text>
      </View>
      <Pressable
        style={[styles.candidateButton, requested ? styles.candidateButtonRequested : styles.candidateButtonAdd]}
        onPress={onToggle}
      >
        {requested ? <Clock size={14} color={colors.textMuted} /> : <Plus size={14} color={colors.textInverse} />}
        <Text style={[styles.candidateButtonLabel, requested ? styles.candidateButtonLabelRequested : styles.candidateButtonLabelAdd]}>
          {requested ? 'Requested' : 'Add'}
        </Text>
      </Pressable>
    </Card>
  );
}

function AddNoResults() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <UserRoundSearch size={24} color={palette.sand[500]} />
      </View>
      <Text style={styles.emptyTitle}>No kaki found</Text>
      <Text style={[styles.emptyMeta, styles.emptyMetaWide]}>Share your invite link and they'll pop up here.</Text>
    </View>
  );
}

const SHEET_OFFSCREEN_Y = 700;

function AddFriendSheet({
  open,
  onClose,
  query,
  onQueryChange,
  candidates,
  hasQuery,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  candidates: AddCandidate[];
  hasQuery: boolean;
  onToggle: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: motion.duration.slow,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSCREEN_Y, 0] });
  const noResults = hasQuery && candidates.length === 0;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5], transform: [{ translateY }] }]}>
          <View style={styles.sheetHandleWrap}>
            <View style={styles.sheetHandle} />
          </View>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Add friend</Text>
              <Text style={styles.sheetSubtitle}>Find your kaki by name or @handle</Text>
            </View>
            <Pressable style={styles.sheetCloseButton} onPress={onClose}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.sheetSearchWrap}>
            <SearchBar value={query} onChange={onQueryChange} placeholder='Try "marcus" or @handle' />
          </View>
          <Text style={[styles.sectionLabel, styles.sheetListLabel]}>{hasQuery ? 'Results' : 'Suggested'}</Text>
          <ScrollView style={styles.sheetList} contentContainerStyle={styles.sheetListContent}>
            {candidates.map((candidate, index) => (
              <CandidateRow key={candidate.id} candidate={candidate} colorIndex={index} onToggle={() => onToggle(candidate.id)} />
            ))}
            {noResults ? <AddNoResults /> : null}
          </ScrollView>
          <View style={styles.sheetFooter}>
            <Button
              label="Share your invite link"
              variant="ghost"
              block
              icon={<Share2 size={18} color={colors.primary} />}
              style={styles.shareButton}
              onPress={() => Share.share({ message: 'Join me on Golf Kaki — track score, add fun.' }).catch(() => {})}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingTop: screenGutter,
    paddingBottom: spacing[2],
  },
  headerTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 22,
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
  },
  addButton: {
    borderWidth: 1,
    borderColor: palette.green[200],
  },
  searchWrap: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[2] + 2,
  },
  searchBar: {
    height: 46,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 1,
    paddingHorizontal: spacing[3] + 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: getFontFamily('body', '400'),
    fontSize: 15,
    color: colors.textPrimary,
  },
  searchClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadErrorText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: spacing[2],
  },
  loadingText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: spacing[6],
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[7],
  },
  sectionLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  requestsSection: {
    marginBottom: spacing[1],
  },
  requestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2] + 2,
  },
  requestCountBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: spacing[2] - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestCountText: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 11,
    color: palette.white,
  },
  requestList: {
    gap: spacing[2],
  },
  requestCard: {
    backgroundColor: palette.sand[50],
    borderColor: palette.sand[300],
  },
  requestTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[2] + 2,
  },
  confirmButton: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 2,
  },
  confirmLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
    color: colors.textInverse,
  },
  dismissButton: {
    width: 46,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing[3] + 2,
    marginBottom: spacing[2] + 2,
  },
  sortIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  sortLabel: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
  },
  friendList: {
    gap: spacing[2],
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  personInfo: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textPrimary,
  },
  personMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 11,
    color: colors.textDisabled,
    marginTop: 1,
  },
  strokePill: {
    paddingVertical: spacing[1] + 1,
    paddingHorizontal: spacing[2] + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  strokeLabel: {
    fontFamily: getFontFamily('numeric', '700'),
    fontWeight: '700',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[4],
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  emptyTitle: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 15,
    color: colors.textPrimary,
  },
  emptyMeta: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    marginTop: 3,
    textAlign: 'center',
  },
  emptyMetaWide: {
    maxWidth: 220,
    lineHeight: 19,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  candidateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
    paddingVertical: spacing[2] - 1,
    paddingHorizontal: spacing[3] + 1,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  candidateButtonAdd: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  candidateButtonRequested: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.borderDefault,
  },
  candidateButtonLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 13,
  },
  candidateButtonLabelAdd: {
    color: colors.textInverse,
  },
  candidateButtonLabelRequested: {
    color: colors.textMuted,
  },
  modalRoot: {
    flex: 1,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlayScrim,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    backgroundColor: colors.surfacePage,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    // Shadow casts upward off the sheet's top edge — same inverted-offset
    // treatment BottomNav uses for its top edge, rather than the standard
    // downward-cast `shadows` tokens.
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
  },
  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
  },
  sheetTitle: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 21,
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textDisabled,
    marginTop: 2,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSearchWrap: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[3] + 2,
    paddingBottom: spacing[2],
  },
  sheetListLabel: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[2],
  },
  sheetList: {
    flexGrow: 0,
  },
  sheetListContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  sheetFooter: {
    paddingHorizontal: screenGutter,
    paddingTop: spacing[2] + 2,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  shareButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
});
