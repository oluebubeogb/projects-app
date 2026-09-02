import { NextRequest, NextResponse } from "next/server";
import { registerUser, createSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const user = await registerUser(data.email, data.name, data.password);
    await createSession(user.id);
    return NextResponse.json({ user });
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors[0]?.message
        : err instanceof Error
          ? err.message
          : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
