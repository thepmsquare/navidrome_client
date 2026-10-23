import { formatTime } from "@/utils/time";

describe("formatTime", () => {
  it("formats zero and negative values to 0:00", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(-10)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
  });

  it("formats seconds correctly under one minute", () => {
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(59)).toBe("0:59");
  });

  it("formats minutes and seconds correctly", () => {
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(125)).toBe("2:05");
    expect(formatTime(600)).toBe("10:00");
  });

  it("formats hours correctly for long tracks or podcasts", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3665)).toBe("1:01:05");
    expect(formatTime(7325)).toBe("2:02:05");
  });
});
