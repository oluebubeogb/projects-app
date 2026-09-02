import { NextRequest, NextResponse } from "next/server";
import { loginUser, createSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const user = await loginUser(data.email, data.password);
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
