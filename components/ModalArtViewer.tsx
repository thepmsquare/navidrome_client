import { Image } from "expo-image";
import React, { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { IconButton, Modal, Portal } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/utils/spacing";

export interface ModalArtViewerProps {
  isVisible: boolean;
  artUrl: string | null;
  onClose: () => void;
}

export function ModalArtViewer({
  isVisible,
  artUrl,
  onClose,
}: ModalArtViewerProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!isVisible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [isVisible, onClose]);

  if (!isVisible || !artUrl) return null;

  return (
    <Portal>
      <Modal
        visible={isVisible}
        onDismiss={onClose}
        style={styles.modalRoot}
        contentContainerStyle={styles.contentContainer}
      >
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="close artwork viewer, full screen album artwork"
        >
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: artUrl }}
              style={styles.image}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
            />
          </View>
        </Pressable>

        <IconButton
          icon="close"
          size={28}
          iconColor="#FFFFFF"
          containerColor="rgba(0, 0, 0, 0.45)"
          onPress={onClose}
          accessibilityLabel="close artwork viewer"
          style={[
            styles.closeButton,
            { top: Math.max(insets.top, spacing.md) },
          ]}
        />
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    margin: 0,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
  },
  contentContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  backdrop: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    padding: spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    right: spacing.md,
    margin: 0,
    zIndex: 10,
  },
});
