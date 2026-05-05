export const videoTracks = ["strategy_foundations", "execution_microstructure", "robustness_risk", "research_workflow", "advanced_diagnostics"] as const;
export type VideoTrack = (typeof videoTracks)[number];

export const videoStatuses = ["draft", "published"] as const;
export type VideoStatus = (typeof videoStatuses)[number];

export type VideoRecord = {
  id: string;
  title: string;
  slug: string;
  description: string;
  youtube_url: string;
  category: VideoTrack;
  episode_number: number;
  duration: string | null;
  thumbnail_override_url: string | null;
  status: VideoStatus;
  published_at: string | null;
  updated_at: string;
};
