import React from "react";
import { View, Pressable, Image, StyleSheet } from "react-native";
import { IconButton } from "react-native-paper";

interface ModalArtViewerProps {
  isVisible: boolean;
  artUrl: string | null;
  onClose: () => void;
}

// Simple Modal Overlay Component
const ModalOverlay = ({ children, onDismiss }: { 
    children: React.ReactNode; 
    onDismiss: () => void 
}) => {
    return (
        <Pressable style={styles.overlay} onPress={onDismiss}>
            {/* Prevent accidental clicks on the image itself if it's wrapped */}
            <View style={styles.innerContent}>{children}</View>
        </Pressable>
    );
};

// Component for viewing art in a full-screen modal
export const ModalArtViewer = ({ isVisible, artUrl, onClose }: ModalArtViewerProps) => {
    if (!isVisible || !artUrl) return null;

    return (
        <ModalOverlay onDismiss={onClose}>
            <View style={[styles.modalContainer, { backgroundColor: 'black' }]}>
                <Image
                    source={{ uri: artUrl }}
                    style={styles.image}
                    contentFit="cover"
                />
                {/* Close button overlay */}
                <IconButton
                    icon="close"
                    size={30}
                    iconColor="#FFF"
                    onPress={onClose}
                    style={styles.closeButton}
                />
            </View>
        </ModalOverlay>
    );
};

// Basic styling for modal components
const styles = {
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000, // Ensure it's above everything else
    },
    innerContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 1; // Ensure it's clickable over the image
    }
};
