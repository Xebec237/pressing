import { connecter } from "./actions";

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; suite?: string }>;
}) {
  const { erreur, suite } = await searchParams;
  const nom = process.env.NEXT_PUBLIC_NOM_PRESSING ?? "Pressing";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-5 py-12">
      <div className="flex flex-col gap-2">
        <span className="surtitre">Espace équipe</span>
        <h1 className="text-3xl font-bold tracking-tight">{nom}</h1>
      </div>

      <form action={connecter} className="carte flex flex-col gap-4 p-5">
        <input type="hidden" name="suite" value={suite ?? "/jour"} />

        <div>
          <label className="etiquette" htmlFor="email">
            Adresse e-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="champ"
            placeholder="vous@exemple.cm"
          />
        </div>

        <div>
          <label className="etiquette" htmlFor="motdepasse">
            Mot de passe
          </label>
          <input
            id="motdepasse"
            name="motdepasse"
            type="password"
            required
            autoComplete="current-password"
            className="champ"
          />
        </div>

        {erreur ? (
          <p className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {erreur}
          </p>
        ) : null}

        <button type="submit" className="bouton w-full">
          Se connecter
        </button>
      </form>

      <p className="text-xs leading-relaxed text-neutral-500">
        Les comptes de l&apos;équipe se créent depuis le tableau de bord
        Supabase, puis se rattachent au pressing dans la table{" "}
        <code className="font-mono">membres</code>.
      </p>
    </main>
  );
}
