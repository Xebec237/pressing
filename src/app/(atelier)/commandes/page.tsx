import Link from "next/link";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { argent, jourHeure } from "@/lib/format";
import { STATUTS, type StatutCommande } from "@/lib/statuts";

export const dynamic = "force-dynamic";

type Ligne = {
  id: string;
  code: string;
  statut: StatutCommande;
  depose_le: string;
  promis_pour: string;
  total: number;
  statut_paiement: string;
  clients: { nom: string; telephone: string } | { nom: string; telephone: string }[] | null;
};

export default async function Commandes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const { q, statut } = await searchParams;
  const supabase = await supabaseServeur();

  let requete = supabase
    .from("commandes")
    .select(
      "id, code, statut, depose_le, promis_pour, total, statut_paiement, clients(nom, telephone)",
    )
    .order("depose_le", { ascending: false })
    .limit(100);

  if (statut) requete = requete.eq("statut", statut);
  if (q?.trim()) requete = requete.ilike("code", `%${q.trim()}%`);

  const { data, error } = await requete.returns<Ligne[]>();
  const lignes = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="surtitre">Historique</span>
        <h1 className="text-2xl font-bold tracking-tight">Commandes</h1>
      </div>

      <form className="carte flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1">
          <label className="etiquette" htmlFor="q">
            Code de commande
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            className="champ font-mono"
            placeholder="A-0043"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="etiquette" htmlFor="statut">
            Statut
          </label>
          <select id="statut" name="statut" defaultValue={statut ?? ""} className="champ">
            <option value="">Tous</option>
            {(Object.keys(STATUTS) as StatutCommande[]).map((s) => (
              <option key={s} value={s}>
                {STATUTS[s].libelle}
              </option>
            ))}
          </select>
        </div>
        <button className="bouton">Filtrer</button>
        {q || statut ? (
          <Link href="/commandes" className="bouton-secondaire">
            Réinitialiser
          </Link>
        ) : null}
      </form>

      {error ? (
        <p className="rounded border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error.message}
        </p>
      ) : null}

      <div className="carte overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-trait bg-panneau text-left">
              {["Code", "Client", "Déposée", "Statut", "Montant"].map((t) => (
                <th
                  key={t}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 ${
                    t === "Montant" ? "text-right" : ""
                  }`}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-neutral-500">
                  Aucune commande ne correspond.
                </td>
              </tr>
            ) : (
              lignes.map((c) => {
                const client = Array.isArray(c.clients) ? c.clients[0] : c.clients;
                return (
                  <tr key={c.id} className="border-b border-trait last:border-0 hover:bg-panneau/60">
                    <td className="px-3 py-2">
                      <Link
                        href={`/commandes/${c.id}`}
                        className="font-mono font-semibold text-indigo hover:underline"
                      >
                        {c.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      {client?.nom ?? "—"}
                      <span className="ml-2 font-mono text-xs text-neutral-500">
                        {client?.telephone}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-neutral-600">
                      {jourHeure(c.depose_le)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`pastille ${STATUTS[c.statut].classe}`}>
                        {STATUTS[c.statut].libelle}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {argent(c.total)}
                      {c.statut_paiement !== "paye" ? (
                        <span className="ml-2 text-xs font-semibold text-amber-700">
                          {c.statut_paiement === "partiel" ? "partiel" : "impayé"}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
