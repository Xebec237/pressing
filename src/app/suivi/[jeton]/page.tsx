import { notFound } from "next/navigation";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { argent, dateHeure } from "@/lib/format";
import { STATUTS, type StatutCommande } from "@/lib/statuts";

export const dynamic = "force-dynamic";

const PARCOURS: StatutCommande[] = [
  "recue",
  "triee",
  "en_traitement",
  "prete",
  "livree",
];

type Suivi = {
  code: string;
  statut: StatutCommande;
  depose_le: string;
  promis_pour: string;
  prete_le: string | null;
  mode_retrait: string;
  express: boolean;
  total: number;
  statut_paiement: string;
  pressing: { nom: string; telephone: string | null; quartier: string | null };
  lignes: { libelle: string; quantite: number; prix_unitaire: number }[];
  pieces: {
    code: string;
    description: string | null;
    couleur: string | null;
    defauts: string[] | null;
  }[];
};

export default async function Suivi({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const supabase = await supabaseServeur();

  // Une fonction dédiée, pas un accès direct aux tables : rien d'autre
  // que ces champs ne sort de la base sans authentification.
  const { data } = await supabase.rpc("suivi_commande", { p_jeton: jeton });
  const suivi = data as Suivi | null;

  if (!suivi) notFound();

  const etapeCourante = PARCOURS.indexOf(suivi.statut);
  const horsParcours = etapeCourante === -1;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-1">
        <span className="surtitre">{suivi.pressing.nom}</span>
        <h1 className="font-mono text-3xl font-bold tracking-tight">{suivi.code}</h1>
        <p className="text-sm text-neutral-600">
          {STATUTS[suivi.statut].publique}
          {suivi.express ? " · express" : ""}
        </p>
      </header>

      {/* Parcours */}
      <section className="carte p-4">
        {horsParcours ? (
          <p className={`pastille ${STATUTS[suivi.statut].classe}`}>
            {STATUTS[suivi.statut].publique}
          </p>
        ) : (
          <ol className="flex flex-col gap-0">
            {PARCOURS.map((etape, i) => {
              const faite = i <= etapeCourante;
              return (
                <li key={etape} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`mt-1 flex h-3.5 w-3.5 shrink-0 rounded-full ring-2 ${
                        faite ? "bg-indigo ring-indigo/30" : "bg-white ring-trait"
                      }`}
                    />
                    {i < PARCOURS.length - 1 ? (
                      <span
                        className={`w-0.5 flex-1 ${faite ? "bg-indigo/40" : "bg-trait"}`}
                      />
                    ) : null}
                  </div>
                  <div className={`pb-4 ${faite ? "" : "opacity-50"}`}>
                    <p className="text-sm font-semibold">{STATUTS[etape].publique}</p>
                    {etape === "prete" && suivi.prete_le ? (
                      <p className="text-xs text-neutral-500">{dateHeure(suivi.prete_le)}</p>
                    ) : null}
                    {etape === "recue" ? (
                      <p className="text-xs text-neutral-500">{dateHeure(suivi.depose_le)}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="carte p-4">
        <div className="flex items-baseline justify-between">
          <span className="surtitre">
            {suivi.mode_retrait === "livraison" ? "Livraison prévue" : "À retirer"}
          </span>
          <span className="text-sm font-semibold">{dateHeure(suivi.promis_pour)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-trait pt-2">
          <span className="surtitre">Montant</span>
          <span className="text-lg font-bold tabular-nums">{argent(suivi.total)}</span>
        </div>
        {suivi.statut_paiement === "paye" ? (
          <p className="mt-1 text-right text-xs font-semibold text-emerald-700">Réglé</p>
        ) : null}
      </section>

      {/* Le bon de dépôt : ce qui a été confié, et dans quel état */}
      <section className="carte">
        <div className="border-b border-trait bg-panneau px-4 py-2">
          <h2 className="text-sm font-bold">
            Vos pièces{" "}
            <span className="font-mono text-xs font-normal text-neutral-500">
              ({suivi.pieces.length})
            </span>
          </h2>
        </div>
        <ul className="divide-y divide-trait">
          {suivi.pieces.map((p) => (
            <li key={p.code} className="px-4 py-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-xs font-semibold text-indigo">{p.code}</span>
                <span className="text-sm">
                  {[p.couleur, p.description].filter(Boolean).join(" · ") || "Pièce"}
                </span>
              </div>
              {p.defauts?.length ? (
                <p className="mt-1 text-xs text-rose-800">
                  Constaté au dépôt : {p.defauts.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="carte overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {suivi.lignes.map((l, i) => (
              <tr key={i} className="border-b border-trait last:border-0">
                <td className="px-4 py-2">{l.libelle}</td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                  {l.quantite} × {argent(l.prix_unitaire)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="text-center text-xs leading-relaxed text-neutral-500">
        {suivi.pressing.nom}
        {suivi.pressing.quartier ? ` · ${suivi.pressing.quartier}` : ""}
        {suivi.pressing.telephone ? (
          <>
            <br />
            <a href={`tel:${suivi.pressing.telephone}`} className="text-indigo hover:underline">
              {suivi.pressing.telephone}
            </a>
          </>
        ) : null}
      </footer>
    </main>
  );
}
