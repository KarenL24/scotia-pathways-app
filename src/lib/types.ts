export type SeriesId = "growth" | "balanced" | "fhsa" | "hisa";

export type Suggestion = {
  id: string;
  series?: SeriesId;
  title: string;
  meta: string;
  cta: string;
  pros: string[];
  cons: string[];
};

export type Media = {
  title: string;
  type: "video" | "podcast";
  source: string;
  url: string;
  duration: string;
};

export type SourceCitation = {
  title: string;
  url: string;
};

export type ActiveGoal = {
  id: string;
  label: string;
  target: number;
  saved: number;
  kind: "save" | "debt";
  targetEtaMonths: number;
  nba: { title: string; cta: string; done: string; confirm: string; reason: string };
  suggestions: Suggestion[];
  media: Media[];
  sources: SourceCitation[];
};
