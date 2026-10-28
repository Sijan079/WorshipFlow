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
  changeNote: string | null;
  dateCount: number;
  // How many of the event's dates are not cancelled. An event can be deleted only when this is 0.
  activeDates: number;
  doneAt: string | null;
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
  canEdit: boolean;
  canDelete: boolean;
  needsReviewCount: number;
  canCreateAnnouncement: boolean;
};
