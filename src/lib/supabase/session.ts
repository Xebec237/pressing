import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieAPoser = { name: string; value: string; options?: CookieOptions };

/** Chemins accessibles sans être connecté. */
const PUBLICS = ["/connexion", "/suivi"];

export async function majSession(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return requete.cookies.getAll();
        },
        setAll(aPoser: CookieAPoser[]) {
          aPoser.forEach(({ name, value }) => requete.cookies.set(name, value));
          reponse = NextResponse.next({ request: requete });
          aPoser.forEach(({ name, value, options }) =>
            reponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() et non getSession() : seul getUser() revalide le jeton
  // auprès de Supabase. getSession() fait confiance au cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const chemin = requete.nextUrl.pathname;
  const estPublic = PUBLICS.some((p) => chemin.startsWith(p));

  if (!user && !estPublic) {
    const url = requete.nextUrl.clone();
    url.pathname = "/connexion";
    url.searchParams.set("suite", chemin);
    return NextResponse.redirect(url);
  }

  if (user && chemin === "/connexion") {
    const url = requete.nextUrl.clone();
    url.pathname = "/jour";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return reponse;
}
