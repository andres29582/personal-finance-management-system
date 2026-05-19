import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReactNode } from 'react';
import { FinanceTheme } from '../styles/financeTheme';

type FinanceAppHeaderProps = {
  action?: ReactNode;
  avatarSource?: ImageSourcePropType;
  eyebrow?: string;
  meta?: string;
  onLogout?: () => void;
  onProfilePress?: () => void;
  subtitle?: string;
  title: string;
};

export function FinanceAppHeader({
  action,
  avatarSource,
  eyebrow,
  meta,
  onLogout,
  onProfilePress,
  subtitle,
  title,
}: FinanceAppHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        {avatarSource && onProfilePress ? (
          <Pressable
            accessibilityLabel="Abrir perfil do usuario"
            onPress={onProfilePress}
            style={({ pressed }) => [
              styles.avatarButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Image source={avatarSource} style={styles.avatar} />
          </Pressable>
        ) : null}

        <View style={styles.titleGroup}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        {action ? <View>{action}</View> : null}

        {meta ? (
          <View style={styles.periodPill}>
            <MaterialCommunityIcons
              color={FinanceTheme.colors.cyanMuted}
              name="calendar-month"
              size={16}
            />
            <Text style={styles.periodText}>{meta}</Text>
          </View>
        ) : null}

        {onLogout ? (
          <Pressable
            accessibilityLabel="Sair da conta"
            onPress={onLogout}
            style={({ pressed }) => [
              styles.logoutButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <MaterialCommunityIcons
              color={FinanceTheme.colors.danger}
              name="logout"
              size={18}
            />
            <Text style={styles.logoutText}>Sair</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: FinanceTheme.spacing.sm,
    justifyContent: 'flex-end',
  },
  avatar: {
    borderRadius: 23,
    height: 46,
    width: 46,
  },
  avatarButton: {
    borderColor: FinanceTheme.neon.cyan.borderColor,
    borderRadius: 24,
    borderWidth: FinanceTheme.borderWidth.hairline,
    overflow: 'hidden',
  },
  eyebrow: {
    color: FinanceTheme.colors.cyanMuted,
    fontSize: FinanceTheme.typography.micro,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: FinanceTheme.spacing.md,
    justifyContent: 'space-between',
    marginBottom: FinanceTheme.spacing.lg,
    minHeight: 76,
  },
  identity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.sm,
    minWidth: 0,
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 122, 144, 0.10)',
    borderColor: 'rgba(255, 122, 144, 0.30)',
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xs,
    minHeight: 40,
    paddingHorizontal: FinanceTheme.spacing.sm,
  },
  logoutText: {
    color: FinanceTheme.colors.danger,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '800',
  },
  periodPill: {
    alignItems: 'center',
    backgroundColor: FinanceTheme.colors.glassSubtle,
    borderColor: FinanceTheme.colors.border,
    borderRadius: FinanceTheme.radius.md,
    borderWidth: FinanceTheme.borderWidth.hairline,
    flexDirection: 'row',
    gap: FinanceTheme.spacing.xs,
    minHeight: 40,
    paddingHorizontal: FinanceTheme.spacing.sm,
  },
  periodText: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    fontWeight: '700',
  },
  pressed: {
    opacity: FinanceTheme.opacity.pressed,
  },
  subtitle: {
    color: FinanceTheme.colors.textMuted,
    fontSize: FinanceTheme.typography.caption,
    marginTop: FinanceTheme.spacing.xxs,
  },
  title: {
    color: FinanceTheme.colors.text,
    fontSize: FinanceTheme.typography.title,
    fontWeight: '800',
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
  },
});
