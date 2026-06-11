import { redirect } from "next/navigation";

export default function SongLibraryPage() {
  redirect("/songs/upload");
}
