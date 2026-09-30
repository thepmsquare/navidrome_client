import React from "react";

import { MostPlayedSection } from "./MostPlayedSection";
import { RandomTracksSection } from "./RandomTracksSection";
import { RecentlyPlayedSection } from "./RecentlyPlayedSection";

export interface HomeSectionDefinition {
  id: string;
  component: React.ComponentType;
}

export const HOME_SECTIONS: HomeSectionDefinition[] = [
  {
    id: "most_played",
    component: MostPlayedSection,
  },
  {
    id: "random_tracks",
    component: RandomTracksSection,
  },
  {
    id: "recently_played",
    component: RecentlyPlayedSection,
  },
];

export { MostPlayedSection, RandomTracksSection, RecentlyPlayedSection };
