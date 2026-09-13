import Link from "next/link";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { argent, delaiLisible, jourHeure, retardHeures } from "@/lib/format";
import { EN_COURS, STATUTS, type StatutCommande } from "@/lib/statuts";

export const dynamic = "force-dynamic";

type Ligne = {
  id: string;
  code: string;
  statut: StatutCommande;
  promis_pour: string;
  prete_le: string | null;
  total: number;
  statut_paiement: string;
  mode_retrait: string;
  clients: { nom: string; telephone: string } | { nom: string; telephone: string }[] | null;
};

function nomClient(c: Ligne["clients"]) {
  const client = Array.isArray(c) ? c[0] : c;
  return client?.nom ?? "—";
}

function Tuile({
  titre,
  valeur,
  ton,
}: {
  titre: string;
  valeur: number | string;
  ton?: "alerte" | "calme";
}) {
  return (
    <div
      className={`carte px-4 py-3 ${
        ton === "alerte" ? "border-rose-300 bg-rose-50" : ""
      }`}
    >
      <p className="surtitre">{titre}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          ton === "alerte" ? "text-rose-800" : ""
        }`}
      >
        {valeur}
      </p>
    </div>
  );
}

function Tableau({ titre, vide, lignes }: { titre: string; vide: string; lignes: Ligne[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold">
        {titre}{" "}
        <span className="font-mono text-xs font-normal text-neutral-500">
          ({lignes.length})
        </span>
      </h2>

      {lignes.length === 0 ? (
        <p className="carte px-4 py-6 text-center text-sm text-neutral-500">{vide}</p>
      ) : (
        <div className="carte overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-trait bg-panneau text-left">
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Code</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Client</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Statut</th>
                <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Échéance</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-neutral-500">Montant</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((c) => {
                const enRetard = retardHeures(c.promis_pour) > 0;
                return (
                  <tr key={c.id} className="border-b border-trait last:border-0 hover:bg-panneau/60">
                    <td className="px-3 py-2">
                      <Link href={`/commandes/${c.id}`} className="font-mono font-semibold text-indigo hover:underline">
                        {c.code}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{nomClient(c.clients)}</td>
                    <td className="px-3 py-2">
                      <span className={`pastille ${STATUTS[c.statut].classe}`}>
                        {STATUTS[c.statut].libelle}
                      </span>
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${enRetard ? "font-semibold text-rose-700" : "text-neutral-600"}`}>
                      {jourHeure(c.promis_pour)}
                      <span className="ml-2 text-xs text-neutral-500">{delaiLisible(c.promis_pour)}</span>
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
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function Jour() {
  const supabase = await supabaseServeur();

  const champs =
    "id, code, statut, promis_pour, prete_le, total, statut_paiement, mode_retrait, clients(nom, telephone)";

  const [enCours, pretes] = await Promise.all([
    supabase
      .from("commandes")
      .select(champs)
      .in("statut", EN_COURS)
      .order("promis_pour", { ascending: true })
      .returns<Ligne[]>(),
    supabase
      .from("commandes")
      .select(champs)
      .in("statut", ["prete", "en_livraison"])
      .order("prete_le", { ascending: true })
      .returns<Ligne[]>(),
  ]);

  const atelier = enCours.data ?? [];
  const aRemettre = pretes.data ?? [];

  const enRetard = atelier.filter((c) => retardHeures(c.promis_pour) > 0);
  const dortDepuisLongtemps = aRemettre.filter(
    (c) => c.prete_le && retardHeures(c.prete_le) > 72,
  );
  const impaye = [...atelier, ...aRemettre]
    .filter((c) => c.statut_paiement !== "paye")
    .reduce((somme, c) => somme + c.total, 0);

  const erreur = enCours.error ?? pretes.error;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="surtitre">Tableau du jour</span>
          <h1 className="text-2xl font-bold tracking-tight">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h1>
        </div>
        <Link href="/comptoir" className="bouton">
          Nouvelle commande
        </Link>
      </div>

      {erreur ? (
        <p className="rounded border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Lecture impossible : {erreur.message}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tuile titre="À l'atelier" valeur={atelier.length} />
        <Tuile
          titre="En retard"
          valeur={enRetard.length}
          ton={enRetard.length > 0 ? "alerte" : undefined}
        />
        <Tuile titre="Prêtes à remettre" valeur={aRemettre.length} />
        <Tuile titre="Encours impayé" valeur={argent(impaye)} />
      </div>

      {dortDepuisLongtemps.length > 0 ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{dortDepuisLongtemps.length}</strong> commande
          {dortDepuisLongtemps.length > 1 ? "s" : ""} prête
          {dortDepuisLongtemps.length > 1 ? "s" : ""} depuis plus de 3 jours et
          jamais retirée{dortDepuisLongtemps.length > 1 ? "s" : ""}. Un rappel
          WhatsApp coûte moins cher qu&apos;un mètre carré de rangement.
        </p>
      ) : null}

      <Tableau
        titre="À traiter"
        vide="Rien à l'atelier. Tout est passé en prêt."
        lignes={atelier}
      />
      <Tableau
        titre="Prêtes — à remettre ou à livrer"
        vide="Aucune commande en attente de remise."
        lignes={aRemettre}
      />
    </div>
  );
}
