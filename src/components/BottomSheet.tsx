import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { colors, getFontFamily, motion, radius, screenGutter, spacing } from '../theme/tokens';

// How far below the screen the sheet starts before it slides up — comfortably
// past any phone's height so the opening frame never shows a sliver of it.
const SHEET_OFFSCREEN_Y = 700;

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Scrollable body content. Omit `scrollable` (defaults true) unless the child manages its own scrolling (e.g. a stepper-only sheet). */
  children: ReactNode;
  scrollable?: boolean;
  /** Rendered below the scrollable body, above the safe-area inset — for anchored action rows like "Reset to auto" / "Save". */
  footer?: ReactNode;
};

/**
 * Shared bottom-sheet shell — scrim fade + slide-up sheet with a grab handle,
 * optional title/close header, and an optional anchored footer. Extracted
 * from CreateGameScreen's GameModeInfoSheet so every picker/config sheet
 * (tee picker, edit handicap, side-game/skins config, skins participation)
 * shares one implementation instead of re-copying the Animated/Modal setup.
 */
export function BottomSheet({ visible, onClose, title, subtitle, children, scrollable = true, footer }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: motion.duration.slow,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_OFFSCREEN_Y, 0] });
  const Body = scrollable ? ScrollView : View;
  const bodyProps = scrollable ? { style: styles.body, contentContainerStyle: styles.bodyContent } : { style: styles.bodyStatic };

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + spacing[5], transform: [{ translateY }] }]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          {title ? (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <X size={17} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <Body {...(bodyProps as object)}>{children}</Body>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '85%',
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: screenGutter,
    shadowColor: '#0E3A28',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: spacing[2] + 2,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderDefault,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: getFontFamily('display', '700'),
    fontWeight: '700',
    fontSize: 18,
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontFamily: getFontFamily('body', '400'),
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: spacing[2] + 1,
    marginBottom: spacing[2] + 2,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    gap: spacing[3] + 1,
    paddingBottom: spacing[3],
  },
  bodyStatic: {
    paddingBottom: spacing[3],
  },
  footer: {
    paddingTop: spacing[3],
  },
});
