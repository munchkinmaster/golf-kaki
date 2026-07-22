import { Bird, Check, Flag, Flame, Gauge, MapPin, Repeat, Target, UserPlus, Users, X } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from './Avatar';
import type { AttestableBadge } from '../data/attestations';
import type { FriendRequest } from '../data/kaki';
import type { MatchInvite } from '../data/matches';
import { getInitials } from '../data/profile';
import { colors, getFontFamily, getPlayerColors, palette, radius, shadows, spacing } from '../theme/tokens';

/** The "Today" actionable cards shared by Home's inline notifications section and the full Notifications screen. */
export function GameInviteCard({
  invite,
  colorIndex,
  onDecline,
  onAccept,
}: {
  invite: MatchInvite;
  colorIndex: number;
  onDecline: () => void;
  onAccept: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);
  const holesPart = invite.summaryLine.split(' · ')[0];

  return (
    <View style={[styles.notifCard, styles.notifCardInvite]}>
      <View style={styles.notifTopRow}>
        <Avatar initials={getInitials(invite.hostName)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>{invite.hostName}</Text> invited you
          </Text>
          <Text style={styles.notifHeadline}>{invite.matchName}</Text>
        </View>
        <View style={[styles.newPill, styles.newPillOrange]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelOrange]}>New</Text>
        </View>
      </View>
      <View style={styles.notifMetaRow}>
        <View style={styles.notifMetaItem}>
          <MapPin size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>{invite.courseName}</Text>
        </View>
        <View style={styles.notifMetaItem}>
          <Flag size={13} color={colors.textDisabled} />
          <Text style={styles.notifMetaText}>
            {holesPart} · {invite.gameModeName}
          </Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionGhost} onPress={onDecline}>
          <X size={16} color={colors.textMuted} />
          <Text style={styles.notifActionGhostLabel}>Decline</Text>
        </Pressable>
        <Pressable style={styles.notifActionAccent} onPress={onAccept}>
          <Check size={16} color={palette.white} />
          <Text style={styles.notifActionAccentLabel}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function FriendRequestCard({
  request,
  colorIndex,
  onIgnore,
  onAccept,
}: {
  request: FriendRequest;
  colorIndex: number;
  onIgnore: () => void;
  onAccept: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);

  return (
    <View style={[styles.notifCard, styles.notifCardFriend]}>
      <View style={styles.notifTopRow}>
        <Avatar initials={getInitials(request.name)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>{request.name}</Text> wants to be your kaki
          </Text>
          <View style={styles.notifMetaRow}>
            <View style={styles.notifMetaItem}>
              <Users size={13} color={colors.textDisabled} />
              <Text style={styles.notifMetaText}>{request.handle}</Text>
            </View>
            {request.handicap !== null ? (
              <View style={styles.notifMetaItem}>
                <Target size={13} color={colors.textDisabled} />
                <Text style={styles.notifMetaText}>HCP {request.handicap}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.newPill, styles.newPillGreen]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelGreen]}>New</Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionGhost} onPress={onIgnore}>
          <X size={16} color={colors.textMuted} />
          <Text style={styles.notifActionGhostLabel}>Ignore</Text>
        </Pressable>
        <Pressable style={styles.notifActionPrimary} onPress={onAccept}>
          <UserPlus size={16} color={palette.white} />
          <Text style={styles.notifActionAccentLabel}>Accept</Text>
        </Pressable>
      </View>
    </View>
  );
}

function badgeTypeLabel(badgeType: AttestableBadge['badgeType']): string {
  switch (badgeType) {
    case 'birdie_streak':
      return 'birdie streak';
    case 'par_streak':
      return 'par streak';
    case 'hole_in_one':
      return 'hole-in-one';
    case 'eagle':
      return 'eagle';
    case 'broke_80':
      return 'Broke 80';
  }
}

const BADGE_TYPE_ICON: Record<AttestableBadge['badgeType'], typeof Flame> = {
  birdie_streak: Flame,
  par_streak: Repeat,
  hole_in_one: Target,
  eagle: Bird,
  broke_80: Gauge,
};

export function BadgeAttestationCard({
  badge,
  colorIndex,
  onConfirm,
}: {
  badge: AttestableBadge;
  colorIndex: number;
  onConfirm: () => void;
}) {
  const playerColor = getPlayerColors(colorIndex);
  const Icon = BADGE_TYPE_ICON[badge.badgeType];

  return (
    <View style={[styles.notifCard, styles.notifCardFriend]}>
      <View style={styles.notifTopRow}>
        <Avatar initials={getInitials(badge.playerName)} size={42} backgroundColor={playerColor.background} color={playerColor.color} />
        <View style={styles.notifBody}>
          <Text style={styles.notifLead}>
            <Text style={styles.notifLeadStrong}>{badge.playerName}</Text>'s {badgeTypeLabel(badge.badgeType)}
          </Text>
          <View style={styles.notifMetaRow}>
            <View style={styles.notifMetaItem}>
              <Icon size={13} color={colors.textDisabled} />
              <Text style={styles.notifMetaText}>{badge.detail}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.newPill, styles.newPillGreen]}>
          <Text style={[styles.newPillLabel, styles.newPillLabelGreen]}>New</Text>
        </View>
      </View>
      <View style={styles.notifActions}>
        <Pressable style={styles.notifActionPrimary} onPress={onConfirm}>
          <Check size={16} color={palette.white} />
          <Text style={styles.notifActionAccentLabel}>Confirm</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notifCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[3] + 2,
    marginBottom: spacing[2] + 2,
    ...shadows.xs,
  },
  notifCardInvite: {
    borderColor: palette.orange[200],
  },
  notifCardFriend: {
    borderColor: palette.green[200],
  },
  notifTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 3,
  },
  notifBody: {
    flex: 1,
    minWidth: 0,
  },
  notifLead: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 13,
    color: colors.textMuted,
  },
  notifLeadStrong: {
    fontFamily: getFontFamily('body', '700'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notifHeadline: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 1,
  },
  newPill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 4,
    paddingHorizontal: spacing[2] + 1,
    flexShrink: 0,
  },
  newPillLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  newPillOrange: {
    backgroundColor: palette.orange[100],
    borderColor: palette.orange[200],
  },
  newPillLabelOrange: {
    color: palette.orange[700],
  },
  newPillGreen: {
    backgroundColor: colors.surfaceBrandSoft,
    borderColor: palette.green[200],
  },
  newPillLabelGreen: {
    color: colors.statusSuccess,
  },
  notifMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3] + 1,
    marginTop: spacing[2] + 1,
  },
  notifMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1] + 1,
  },
  notifMetaText: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
  },
  notifActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3] + 1,
  },
  notifActionGhost: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  notifActionGhostLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: colors.textMuted,
  },
  notifActionAccent: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
    ...shadows.accent,
  },
  notifActionPrimary: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1] + 3,
  },
  notifActionAccentLabel: {
    fontFamily: getFontFamily('body', '600'),
    fontWeight: '600',
    fontSize: 14,
    color: palette.white,
  },
});
