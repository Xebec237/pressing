import type { NextRequest } from "next/server";
import { majSession } from "@/lib/supabase/session";

export async function middleware(requete: NextRequest) {
  return majSession(requete);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
