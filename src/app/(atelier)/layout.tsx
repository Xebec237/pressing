import Link from "next/link";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { deconnecter } from "@/app/connexion/actions";

const LIENS = [
  { href: "/jour", libelle: "Le jour" },
  { href: "/comptoir", libelle: "Nouvelle commande" },
  { href: "/commandes", libelle: "Commandes" },
  { href: "/catalogue", libelle: "Catalogue" },
];

export default async function LayoutAtelier({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServeur();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Filtrer sur auth_user_id est indispensable : les politiques d'accès
  // laissent voir TOUS les collègues du pressing, donc sans ce filtre la
  // requête renvoie plusieurs lignes dès la deuxième personne recrutée.
  const { data: membre } = await supabase
    .from("membres")
    .select("nom, role, pressings(nom, quartier)")
    .eq("auth_user_id", user?.id ?? "")
    .maybeSingle();

  // Un compte Supabase sans ligne dans membres n'appartient à aucun
  // pressing : toutes les politiques d'accès le renverront à vide.
  if (!membre) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <div className="carte p-6">
          <h1 className="mb-2 text-lg font-bold">Compte non rattaché</h1>
          <p className="text-sm leading-relaxed text-neutral-600">
            Ce compte n&apos;est associé à aucun pressing. Ajoute une ligne dans
            la table <code className="font-mono">membres</code> avec son{" "}
            <code className="font-mono">auth_user_id</code> et l&apos;identifiant
            du pressing, puis reconnecte-toi.
          </p>
          <form action={deconnecter} className="mt-4">
            <button className="bouton-secondaire">Se déconnecter</button>
          </form>
        </div>
      </main>
    );
  }

  const pressing = Array.isArray(membre.pressings)
    ? membre.pressings[0]
    : membre.pressings;

  return (
    <div className="min-h-screen">
      <header className="border-b border-trait bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <div className="mr-auto">
            <p className="text-sm font-bold leading-tight">
              {pressing?.nom ?? "Pressing"}
            </p>
            <p className="text-xs text-neutral-500">
              {membre.nom} · {membre.role}
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
            {LIENS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-panneau"
              >
                {l.libelle}
              </Link>
            ))}
          </nav>

          <form action={deconnecter}>
            <button className="text-xs font-medium text-neutral-500 underline-offset-2 hover:underline">
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
