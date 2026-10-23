import * as ExpoHaptics from "expo-haptics";
import { getHapticsEnabled } from "@/services/db";
import { triggerHapticImpact, triggerHapticSelection } from "@/utils/haptics";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

jest.mock("@/services/db", () => ({
  getHapticsEnabled: jest.fn(),
}));

describe("haptics utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("triggers selection haptic when enabled", async () => {
    (getHapticsEnabled as jest.Mock).mockReturnValue(true);

    await triggerHapticSelection();

    expect(ExpoHaptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("does not trigger selection haptic when disabled", async () => {
    (getHapticsEnabled as jest.Mock).mockReturnValue(false);

    await triggerHapticSelection();

    expect(ExpoHaptics.selectionAsync).not.toHaveBeenCalled();
  });

  it("triggers impact haptic when enabled", async () => {
    (getHapticsEnabled as jest.Mock).mockReturnValue(true);

    await triggerHapticImpact(ExpoHaptics.ImpactFeedbackStyle.Light);

    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith("light");
  });

  it("does not trigger impact haptic when disabled", async () => {
    (getHapticsEnabled as jest.Mock).mockReturnValue(false);

    await triggerHapticImpact(ExpoHaptics.ImpactFeedbackStyle.Light);

    expect(ExpoHaptics.impactAsync).not.toHaveBeenCalled();
  });
});
