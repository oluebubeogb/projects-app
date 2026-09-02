import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { uid } from "@/lib/utils";

export async function notify(opts: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.insert(notifications).values({
      id: uid(),
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body || "",
      link: opts.link || "",
      meta: JSON.stringify(opts.meta || {}),
    });
  } catch (e) {
    console.error("[notify]", e);
  }
}
