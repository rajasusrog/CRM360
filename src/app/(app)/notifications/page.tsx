import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/kit";
import { formatDateTime } from "@/lib/format";
import { requireStaff } from "@/lib/session";

export default async function NotificationsPage() {
  const session = await requireStaff();
  const { data: notes } = await session.supabase.from("notifications").select("*").eq("user_id", session.profile.id).order("created_at", { ascending: false }).limit(30);

  async function markRead() {
    "use server";
    const current = await requireStaff();
    await current.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", current.profile.id).is("read_at", null);
    revalidatePath("/notifications");
  }

  return (
    <div>
      <PageHeader eyebrow="Inbox" title="Notifications" action={<form action={markRead}><button className="text-sm underline" type="submit">Mark all read</button></form>} />
      <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
        {(notes ?? []).map((note) => (
          <li key={note.id} className="px-4 py-3 text-sm">
            <p className={note.read_at ? "text-muted-foreground" : "font-medium"}>{note.title}</p>
            <p className="text-muted-foreground">{note.body}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(note.created_at)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
