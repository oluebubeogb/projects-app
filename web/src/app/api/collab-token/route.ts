import { NextResponse } from "next/server";
import { getSessionUser, createCollabToken } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const token = await createCollabToken(user.id);
  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      color: user.avatarColor,
    },
  });
}
