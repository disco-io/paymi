import { useRef, useState } from 'react';
import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';
import { useSplitStore } from '@/features/split/splitStore';
import {
  uploadReceiptImage,
  parseReceiptImage,
  createReceipt,
} from '@/features/receipt/api';
import { isDevPreviewActive } from '@/features/dev/devPreview';
import { colors, spacing, typography, radius } from '@/theme';

export default function CameraScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const setImage = useSplitStore((s) => s.setImage);
  const applyParsed = useSplitStore((s) => s.applyParsed);
  const setReceiptId = useSplitStore((s) => s.setReceiptId);

  const capture = async () => {
    if (!cameraRef.current || !groupId || capturing) return;
    if (!user && !isDevPreviewActive()) return;

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error('No photo');

      setImage(photo.uri, '');

      if (isDevPreviewActive()) {
        applyParsed({
          merchant: 'Sunset Bistro',
          receipt_date: null,
          items: [
            { name: 'Caesar salad', amount_cents: 1400, quantity: 1 },
            { name: 'Margherita pizza', amount_cents: 2200, quantity: 1 },
            { name: 'Tiramisu', amount_cents: 900, quantity: 1 },
          ],
          tax_cents: 450,
          tip_cents: 900,
        });
        router.replace({
          pathname: '/(app)/split/review',
          params: { groupId },
        });
        return;
      }

      const path = await uploadReceiptImage(groupId, user!.id, photo.uri);
      setImage(photo.uri, path);

      const [parsed, receipt] = await Promise.all([
        parseReceiptImage(path),
        createReceipt(groupId, user!.id, {
          image_path: path,
          merchant: null,
          receipt_date: null,
          tax_cents: 0,
          tip_cents: 0,
        }),
      ]);

      setReceiptId(receipt.id);
      applyParsed(parsed);

      router.replace({
        pathname: '/(app)/split/review',
        params: { groupId },
      });
    } catch (e) {
      console.error(e);
      router.replace({
        pathname: '/(app)/split/review',
        params: { groupId, manual: '1' },
      });
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) {
    return <View style={styles.centered} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>camera access needed to scan receipts</Text>
        <Pressable onPress={requestPermission} style={styles.permBtn}>
          <Text style={styles.permBtnText}>allow camera</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.replace({
              pathname: '/(app)/split/review',
              params: { groupId: groupId ?? '', manual: '1' },
            })
          }
        >
          <Text style={styles.manualLink}>enter manually instead</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <LinearGradient
        colors={['transparent', 'rgba(250,247,242,0.95)']}
        style={styles.bottomGradient}
      />

      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.hint}>line up the receipt</Text>
        <Pressable
          onPress={capture}
          disabled={capturing}
          style={[styles.shutter, capturing && styles.shutterDisabled]}
        >
          {capturing ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
        <Pressable
          onPress={() =>
            router.replace({
              pathname: '/(app)/split/review',
              params: { groupId: groupId ?? '', manual: '1' },
            })
          }
        >
          <Text style={styles.manualLink}>no receipt? type it in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.cream,
    gap: spacing.md,
  },
  permText: {
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
  },
  permBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  permBtnText: { color: colors.cream, ...typography.subtitle },
  topBar: {
    position: 'absolute',
    top: 56,
    left: spacing.lg,
    zIndex: 10,
  },
  close: {
    fontSize: 28,
    color: colors.cream,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
  },
  bottom: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: spacing.md,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.6 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.cream,
  },
  manualLink: {
    ...typography.caption,
    color: colors.primaryDark,
  },
});
