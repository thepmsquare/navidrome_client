import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Dialog,
  Divider,
  IconButton,
  List,
  Portal,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";

import {
  cancelSleepTimer,
  setDurationTimer,
  setEndOfTrackTimer,
  useSleepTimer,
} from "@/services/sleepTimer";
import { useAppTheme } from "@/types";
import { spacing } from "@/utils/spacing";

interface SleepTimerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onTimerSet?: (message: string) => void;
}

const PRESET_DURATIONS = [15, 30, 45, 60];

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function SleepTimerModal({
  visible,
  onDismiss,
  onTimerSet,
}: SleepTimerModalProps) {
  const theme = useAppTheme();
  const timerState = useSleepTimer();
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  const handleSelectPreset = (minutes: number) => {
    setDurationTimer(minutes);
    onTimerSet?.(`sleep timer set for ${minutes} minutes`);
    setShowCustomInput(false);
    setCustomMinutes("");
    onDismiss();
  };

  const handleSelectEndOfTrack = () => {
    setEndOfTrackTimer();
    onTimerSet?.("sleep timer set for end of current track");
    setShowCustomInput(false);
    setCustomMinutes("");
    onDismiss();
  };

  const handleCustomSubmit = () => {
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      onTimerSet?.("please enter a valid number of minutes");
      return;
    }
    setDurationTimer(mins);
    onTimerSet?.(`sleep timer set for ${mins} minutes`);
    setShowCustomInput(false);
    setCustomMinutes("");
    onDismiss();
  };

  const handleCancelTimer = () => {
    cancelSleepTimer();
    onTimerSet?.("sleep timer turned off");
    setShowCustomInput(false);
    setCustomMinutes("");
    onDismiss();
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          { backgroundColor: theme.colors.surfaceContainerLow },
        ]}
      >
        <Dialog.Title
          style={[styles.dialogTitle, { color: theme.colors.onSurface }]}
        >
          sleep timer
        </Dialog.Title>

        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Active timer status and cancel option */}
            {timerState.isActive && (
              <Surface
                elevation={1}
                style={[
                  styles.activeSurface,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <View style={styles.activeInfoRow}>
                  <IconButton
                    icon="timer"
                    size={22}
                    iconColor={theme.colors.onPrimaryContainer}
                    style={styles.activeIcon}
                  />
                  <View style={styles.activeTextContainer}>
                    <Text
                      variant="labelMedium"
                      style={[
                        styles.activeHeader,
                        { color: theme.colors.onPrimaryContainer },
                      ]}
                    >
                      timer active
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: theme.colors.onPrimaryContainer }}
                    >
                      {timerState.mode === "end_of_track"
                        ? "stopping at end of current track"
                        : `${formatRemaining(timerState.remainingSeconds)} remaining`}
                    </Text>
                  </View>
                </View>
                <Button
                  mode="text"
                  textColor={theme.colors.error}
                  onPress={handleCancelTimer}
                  style={styles.turnOffButton}
                  labelStyle={styles.turnOffLabel}
                  accessibilityLabel="turn off timer"
                >
                  turn off timer
                </Button>
              </Surface>
            )}

            {/* Presets */}
            {PRESET_DURATIONS.map((minutes) => {
              const isSelected =
                timerState.isActive &&
                timerState.mode === "duration" &&
                Math.round(timerState.remainingSeconds / 60) === minutes;

              return (
                <List.Item
                  key={minutes}
                  title={`${minutes} minutes`}
                  titleStyle={{
                    color: isSelected
                      ? theme.colors.primary
                      : theme.colors.onSurface,
                    fontWeight: isSelected ? "600" : "normal",
                  }}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon="clock-outline"
                      color={
                        isSelected
                          ? theme.colors.primary
                          : theme.colors.onSurfaceVariant
                      }
                    />
                  )}
                  onPress={() => handleSelectPreset(minutes)}
                  style={styles.listItem}
                  accessibilityRole="button"
                  accessibilityLabel={`${minutes} minutes`}
                />
              );
            })}

            {/* End of Track */}
            <List.Item
              title="end of current track"
              titleStyle={{
                color:
                  timerState.isActive && timerState.mode === "end_of_track"
                    ? theme.colors.primary
                    : theme.colors.onSurface,
                fontWeight:
                  timerState.isActive && timerState.mode === "end_of_track"
                    ? "600"
                    : "normal",
              }}
              left={(props) => (
                <List.Icon
                  {...props}
                  icon="skip-next-circle-outline"
                  color={
                    timerState.isActive && timerState.mode === "end_of_track"
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
              )}
              onPress={handleSelectEndOfTrack}
              style={styles.listItem}
              accessibilityRole="button"
              accessibilityLabel="end of current track"
            />

            <Divider style={styles.divider} />

            {/* Custom Minutes */}
            {showCustomInput ? (
              <View style={styles.customRow}>
                <TextInput
                  mode="outlined"
                  dense
                  label="minutes"
                  placeholder="e.g. 20"
                  keyboardType="number-pad"
                  value={customMinutes}
                  onChangeText={setCustomMinutes}
                  style={styles.customInput}
                  accessibilityLabel="custom minutes input"
                />
                <Button
                  mode="contained"
                  onPress={handleCustomSubmit}
                  style={styles.customSubmitButton}
                  labelStyle={styles.actionLabel}
                  accessibilityLabel="set custom timer"
                >
                  set
                </Button>
              </View>
            ) : (
              <List.Item
                title="custom minutes"
                titleStyle={{ color: theme.colors.onSurface }}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon="pencil-outline"
                    color={theme.colors.onSurfaceVariant}
                  />
                )}
                onPress={() => setShowCustomInput(true)}
                style={styles.listItem}
                accessibilityRole="button"
                accessibilityLabel="custom minutes"
              />
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button
            mode="text"
            onPress={onDismiss}
            labelStyle={styles.actionLabel}
            accessibilityLabel="close"
          >
            close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 20,
    maxHeight: "85%",
  },
  dialogTitle: {
    textAlign: "left",
    paddingBottom: spacing.xs,
  },
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  activeSurface: {
    borderRadius: 14,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  activeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeIcon: {
    margin: 0,
    marginRight: spacing.xs,
  },
  activeTextContainer: {
    flex: 1,
  },
  activeHeader: {
    fontWeight: "700",
  },
  turnOffButton: {
    alignSelf: "flex-end",
    marginTop: spacing.xs / 2,
  },
  turnOffLabel: {
    fontSize: 12,
    textTransform: "lowercase",
  },
  listItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
  },
  divider: {
    marginVertical: spacing.xs,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  customInput: {
    flex: 1,
  },
  customSubmitButton: {
    alignSelf: "center",
  },
  actionLabel: {
    textTransform: "lowercase",
  },
});
