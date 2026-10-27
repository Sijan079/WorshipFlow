export type EventOccurrenceSummary = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  venue: string | null;
  timezone: string;
  isPublic: boolean;
  repeats: boolean;
  edited: boolean;
  localDate: string;
  startsAt: string;
  endsAt: string;
  registrationUrl: string | null;
  responseCount: number | null;
  yesCount: number | null;
  noCount: number | null;
  attendanceCount: number | null;
  status: "SCHEDULED" | "CANCELLED";
  conflict: boolean;
};

export type EventListResponse = {
  items: EventOccurrenceSummary[];
  canCreate: boolean;
};
