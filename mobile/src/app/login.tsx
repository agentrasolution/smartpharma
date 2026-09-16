import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useAuth } from '@/contexts/AuthContext';
import { useServerSettings } from '@/contexts/ServerSettingsContext';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const theme = useThemeColor();
  const { login, register } = useAuth();
  const { baseUrl, setBaseUrl } = useServerSettings();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [pharmacyName, setPharmacyName] = useState('');
  const [branchName, setBranchName] = useState('Main Branch');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  function openServerModal() {
    setServerUrl(baseUrl);
    setServerModalOpen(true);
  }

  async function handleSubmit() {
    if (loading) return;
    setError('');
    if (mode === 'login') {
      if (!username || !password) return;
      setLoading(true);
      const err = await login(username, password);
      if (err) setError(err);
      setLoading(false);
      return;
    }
    if (!pharmacyName.trim() || !name.trim() || !username.trim() || !password) return;
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const err = await register({
      pharmacyName: pharmacyName.trim(),
      branchName: branchName.trim() || undefined,
      name: name.trim(),
      username: username.trim(),
      password,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
    if (err) setError(err);
    setLoading(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Pressable onPress={openServerModal} style={styles.serverBtn} hitSlop={8}>
            <Ionicons name="server-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.serverBtnText, { color: theme.textSecondary }]}>Server</Text>
          </Pressable>

          <View style={styles.brand}>
            <View style={[styles.logoWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Image
                source={require('@/assets/images/faraz-logo.png')}
                style={styles.logo}
                contentFit="cover"
              />
            </View>
            <Text style={[styles.appName, { color: theme.text, fontFamily: Fonts.sans }]}>
              Faraz Pharmacy
            </Text>
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>
              {mode === 'login' ? 'Sign in to your account' : 'Create your pharmacy'}
            </Text>
          </View>

          <View style={styles.form}>
            {mode === 'register' ? (
              <>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Pharmacy Name</Text>
                  <Input
                    value={pharmacyName}
                    onChangeText={setPharmacyName}
                    placeholder="e.g. Green Cross Pharmacy"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Branch Name (optional)</Text>
                  <Input
                    value={branchName}
                    onChangeText={setBranchName}
                    placeholder="e.g. Main Branch"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Your Name</Text>
                  <Input
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
                  <Input
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Admin username"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </>
            ) : (
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Username</Text>
                <Input
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="next"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
              <View style={styles.passwordRow}>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                  containerStyle={styles.passwordInput}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>
            </View>

            {mode === 'register' ? (
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm Password</Text>
                <Input
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat password"
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                />
              </View>
            ) : null}

            {mode === 'register' ? (
              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Email (optional)</Text>
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Phone (optional)</Text>
                  <Input value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
                </View>
              </View>
            ) : null}

            {mode === 'register' ? (
              <Text style={[styles.trialNote, { color: theme.textSecondary }]}>
                Creates your pharmacy with a 30-day free trial. Your first account becomes the pharmacy
                super admin.
              </Text>
            ) : null}

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: `${theme.danger}12`, borderColor: `${theme.danger}30` }]}>
                <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Button fullWidth size="lg" loading={loading} onPress={handleSubmit}>
              {mode === 'register' ? 'Create pharmacy & sign in' : 'Sign in'}
            </Button>

            {mode === 'login' ? (
              <Pressable onPress={() => switchMode('register')}>
                <Text style={[styles.switchLink, { color: theme.accent }]}>New pharmacy? Sign up</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => switchMode('login')}>
                <Text style={[styles.switchLink, { color: theme.accent }]}>
                  Already have an account? Sign in
                </Text>
              </Pressable>
            )}

            <View style={styles.serverStatus}>
              <Ionicons name="link-outline" size={14} color={theme.mutedFg} />
              <Text style={[styles.statusUrl, { color: theme.mutedFg }]} numberOfLines={1}>
                {baseUrl}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={serverModalOpen} transparent animationType="slide" onRequestClose={() => setServerModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setServerModalOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Server URL</Text>
              <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                Address of the SmartPharma server. Make sure your phone and server are on the same network.
              </Text>
            </View>
            <Input
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="http://192.168.1.10:3001"
              autoCapitalize="none"
              autoCorrect={false}
              containerStyle={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <Button variant="secondary" onPress={() => setServerModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onPress={async () => {
                  await setBaseUrl(serverUrl);
                  setServerModalOpen(false);
                }}>
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.five,
  },
  serverBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  serverBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  brand: {
    alignItems: 'center',
    gap: 10,
  },
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 60,
    height: 60,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 14,
  },
  form: {
    gap: Spacing.three,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  passwordRow: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
  },
  switchLink: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  trialNote: {
    fontSize: 12,
    lineHeight: 17,
  },
  serverStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusUrl: {
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: 32,
  },
  modalHeader: {
    gap: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'flex-end',
  },
});