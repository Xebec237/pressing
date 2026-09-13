import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieAPoser = { name: string; value: string; options?: CookieOptions };

export async function supabaseServeur() {
  const magasin = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return magasin.getAll();
        },
        setAll(aPoser: CookieAPoser[]) {
          try {
            aPoser.forEach(({ name, value, options }) =>
              magasin.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component : impossible d'écrire un
            // cookie ici. Le middleware rafraîchit déjà la session.
          }
        },
      },
    },
  );
}
