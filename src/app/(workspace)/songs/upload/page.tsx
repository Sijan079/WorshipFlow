import { redirect } from "next/navigation";

export default function LegacyUploadLyricsPage() {
  redirect("/song-formatter/upload");
}
