// Contact details are ordinary editing. Whether search engines may list the whole site changes what the world
// can find, so it needs Publish, like the website switch on an announcement.
export function decideSettingsUpdate({ existing, input, canPublish }: { existing: { indexable: boolean }; input: { indexable?: boolean; [field: string]: unknown }; canPublish: boolean }):
  { ok: true } | { ok: false; error: string } {
  if (!canPublish && input.indexable !== undefined && input.indexable !== existing.indexable) {
    return { ok: false, error: "Only people who can publish can change whether search engines list the website." };
  }
  return { ok: true };
}
