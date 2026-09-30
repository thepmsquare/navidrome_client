import React from "react";

import { MostPlayedSection } from "./MostPlayedSection";

export interface HomeSectionDefinition {
  id: string;
  component: React.ComponentType;
}

export const HOME_SECTIONS: HomeSectionDefinition[] = [
  {
    id: "most_played",
    component: MostPlayedSection,
  },
];

export { MostPlayedSection };
