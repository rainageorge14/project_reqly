import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/validations/auth";
import { db } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const result = loginSchema.safeParse(json);

    if (!result.success) {
      const issue = result.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || "Invalid email or password" },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Secure authentication check: constant time-style error without revealing user existence
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await logAudit({
      userId: user.id,
      action: "USER_LOGIN",
      metadata: { email: user.email },
    });

    await setSessionCookie({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
