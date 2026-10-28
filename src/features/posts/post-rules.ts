import { localDateInZone } from "../events/recurrence.ts";

export type AnnouncementTiming = {
  status: "DRAFT" | "PUBLISHED";
  isPublic: boolean;
  startDate: string | null;
  endDate: string | null;
  timezone: string;
};

export type AnnouncementPhase = "draft" | "scheduled" | "live" | "ended";

// Only Draft and Published are stored. Scheduled and Ended follow from the dates, read in the announcement's
// own time zone, with both the start and the end day included.
export function announcementPhase(post: AnnouncementTiming, now = new Date()): AnnouncementPhase {
  if (post.status === "DRAFT") return "draft";
  const today = localDateInZone(now, post.timezone);
  if (post.startDate && today < post.startDate) return "scheduled";
  if (post.endDate && today > post.endDate) return "ended";
  return "live";
}

// The one test for "may the public see this". The public site uses this and nothing else: published, switched
// on for the website, and inside its dates.
export function isPubliclyVisible(post: AnnouncementTiming, now = new Date()) {
  return post.isPublic && announcementPhase(post, now) === "live";
}

// A published announcement is set back to Draft before it can be deleted.
export function canDeleteAnnouncement(post: { status: "DRAFT" | "PUBLISHED" }) {
  return post.status === "DRAFT";
}

const ENDED_SHOWN = 20;

type Listed = AnnouncementTiming & { createdAt: string };

// Soonest start first, then newest created. Announcements with no start date come after the dated ones. The
// ended group shows what ended most recently, and only the latest twenty.
export function announcementGroups<T extends Listed>(items: T[], now = new Date()) {
  const byStart = (a: T, b: T) => {
    if (a.startDate && b.startDate && a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    if (a.startDate && !b.startDate) return -1;
    if (!a.startDate && b.startDate) return 1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  };
  const newestFirst = (a: T, b: T) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
  const phase = (wanted: AnnouncementPhase) => items.filter((item) => announcementPhase(item, now) === wanted);
  const ended = phase("ended").sort((a, b) => {
    const left = a.endDate ?? "";
    const right = b.endDate ?? "";
    return left === right ? newestFirst(a, b) : left < right ? 1 : -1;
  });
  return {
    drafts: phase("draft").sort(newestFirst),
    live: phase("live").sort(byStart),
    scheduled: phase("scheduled").sort(byStart),
    ended: ended.slice(0, ENDED_SHOWN),
    endedTotal: ended.length,
  };
}

type UpdateInput = {
  status?: "DRAFT" | "PUBLISHED";
  isPublic?: boolean;
  title?: string;
  body?: string;
  startDate?: string | null;
  endDate?: string | null;
  eventId?: string | null;
  facebookText?: string | null;
  instagramText?: string | null;
};

export type AnnouncementUpdateDecision =
  | { ok: true; status: "DRAFT" | undefined; sentBackToDraft: boolean }
  | { ok: false; error: string };

// Who may change what. Publishing, unpublishing and the website switch need the Publish permission. Someone
// without it can still edit the words of a published announcement, but that sends it back to Draft until a
// person who can publish approves it, so Edit alone can never change what the congregation sees.
export function decideAnnouncementUpdate({ existing, input, canPublish }: { existing: { status: "DRAFT" | "PUBLISHED"; isPublic: boolean }; input: UpdateInput; canPublish: boolean }): AnnouncementUpdateDecision {
  if (canPublish) return { ok: true, status: undefined, sentBackToDraft: false };
  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const publicChanged = input.isPublic !== undefined && input.isPublic !== existing.isPublic;
  if (statusChanged || publicChanged) {
    return { ok: false, error: "Only people who can publish can publish, unpublish, or change the website setting." };
  }
  const contentChanged = [input.title, input.body, input.startDate, input.endDate, input.eventId, input.facebookText, input.instagramText].some((value) => value !== undefined);
  if (existing.status === "PUBLISHED" && contentChanged) return { ok: true, status: "DRAFT", sentBackToDraft: true };
  return { ok: true, status: undefined, sentBackToDraft: false };
}
