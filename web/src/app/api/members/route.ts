import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getWorkspaceToken, getWorkspaceMembers } from "@/db/queries";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = req.nextUrl.searchParams.get("workspace");
  if (!workspace) return NextResponse.json({ error: "workspace query param required" }, { status: 400 });

  const token = await getWorkspaceToken(session.userId, workspace);
  if (!token) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await getWorkspaceMembers(workspace);
  return NextResponse.json({ members });
}
