export type AnnouncementEventLink = {
  id: string;
  title: string;
  // The event's next upcoming date, or null when it has none left.
  next: { localDate: string; startsAt: string; endsAt: string; timezone: string } | null;
  // True when the event still has dates but every one of them is cancelled.
  cancelled: boolean;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED";
  isPublic: boolean;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  eventId: string | null;
  // Present only for people who can also view events; others see that a link exists but not what it is.
  event: AnnouncementEventLink | null;
  facebookText: string | null;
  instagramText: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type AnnouncementListResponse = {
  items: AnnouncementItem[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  // Events that can be linked; null when the person cannot view events.
  events: Array<{ id: string; title: string }> | null;
};
