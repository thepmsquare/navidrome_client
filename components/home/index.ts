import React from "react";

import { MostPlayedSection } from "./MostPlayedSection";
import { NewlyAddedReleasesSection } from "./NewlyAddedReleasesSection";
import { RandomAlbumsSection } from "./RandomAlbumsSection";
import { RandomTracksSection } from "./RandomTracksSection";
import { RecentlyPlayedSection } from "./RecentlyPlayedSection";
import { RecentlyReleasedSection } from "./RecentlyReleasedSection";

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
  {
    id: "random_albums",
    component: RandomAlbumsSection,
  },
  {
    id: "newly_added_releases",
    component: NewlyAddedReleasesSection,
  },
  {
    id: "recently_released",
    component: RecentlyReleasedSection,
  },
];

export {
  MostPlayedSection,
  NewlyAddedReleasesSection,
  RandomAlbumsSection,
  RandomTracksSection,
  RecentlyPlayedSection,
  RecentlyReleasedSection,
};
