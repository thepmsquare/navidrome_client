import React from "react";
import renderer from "react-test-renderer";

import { ConnectProgress } from "@/components/ConnectProgress";

describe("ConnectProgress", () => {
  it("renders stage 1 (ping) correctly with accessible metadata", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<ConnectProgress stage="ping" />);
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("step 1 of 2");
  });

  it("renders stage 2 (login) correctly", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(<ConnectProgress stage="login" />);
    });

    const tree = component.toJSON();
    expect(JSON.stringify(tree)).toContain("step 2 of 2");
  });

  it("handles loading state without throwing", () => {
    let component: any;
    renderer.act(() => {
      component = renderer.create(
        <ConnectProgress stage="ping" loading={true} />,
      );
    });

    expect(component.toJSON()).toBeDefined();

    renderer.act(() => {
      component.unmount();
    });
  });
});
