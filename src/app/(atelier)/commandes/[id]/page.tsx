import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServeur } from "@/lib/supabase/serveur";
import { argent, dateHeure, delaiLisible } from "@/lib/format";
import { METHODES_PAIEMENT, STATUTS, type StatutCommande } from "@/lib/statuts";
import { bonDeDepot, lienWhatsApp, messagePrete } from "@/lib/whatsapp";
import { changerStatut, encaisser } from "./actions";

export const dynamic = "force-dynamic";

type Client = { nom: string; telephone: string; quartier: string | null; adresse: string | null };
type Piece = { id: string; code: string; description: string | null; couleur: string | null; marque: string | null; defauts: string[] | null };
type LigneFacture = { id: string; libelle: string; quantite: number; prix_unitaire: number };
type Paiement = { id: string; montant: number; methode: string; reference: string | null; encaisse_le: string };
type Evenement = { id: number; type: string; ancien_statut: string | null; nouveau_statut: string | null; cree_le: string };

type Commande = {
  id: string; code: string; statut: StatutCommande; mode_retrait: string;
  adresse_livraison: string | null; express: boolean; depose_le: string;
  promis_pour: string; prete_le: string | null; livree_le: string | null;
  total: number; statut_paiement: string; note: string | null; jeton_suivi: string;
  clients: Client | Client[] | null;
  lignes: LigneFacture[]; pieces: Piece[];
  paiements: Paiement[]; evenements: Evenement[];
};

const seul = <T,>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

export default async function FicheCommande({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const { id } = await params;
  const { nouveau } = await searchParams;
  const supabase = await supabaseServeur();

  const { data } = await supabase
    .from("commandes")
    .select(
      `id, code, statut, mode_retrait, adresse_livraison, express, depose_le,
       promis_pour, prete_le, livree_le, total, statut_paiement, note, jeton_suivi,
       clients(nom, telephone, quartier, adresse),
       lignes(id, libelle, quantite, prix_unitaire),
       pieces(id, code, description, couleur, marque, defauts),
       paiements(id, montant, methode, reference, encaisse_le),
       evenements(id, type, ancien_statut, nouveau_statut, cree_le)`,
    )
    .eq("id", id)
    .maybeSingle<Commande>();

  if (!data) notFound();

  const client = seul(data.clients);
  const pieces = [...(data.pieces ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  const paye = (data.paiements ?? []).reduce((s, p) => s + p.montant, 0);
  const reste = Math.max(0, data.total - paye);
  const nomPressing = process.env.NEXT_PUBLIC_NOM_PRESSING ?? "Pressing";
  const journal = [...(data.evenements ?? [])].sort((a, b) => b.id - a.id);

  const lienDepot = client
    ? lienWhatsApp(
        client.telephone,
        bonDeDepot(nomPressing, { code: data.code, total: data.total, promis_pour: data.promis_pour, jeton_suivi: data.jeton_suivi }, pieces),
      )
    : null;

  const lienPrete = client
    ? lienWhatsApp(client.telephone, messagePrete(nomPressing, data.code, reste))
    : null;

  return (
    <div className="flex flex-col gap-6">
      {nouveau ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            Commande {data.code} enregistrée — {pieces.length} pièce
            {pieces.length > 1 ? "s" : ""}, {argent(data.total)}.
          </p>
          {lienDepot ? (
            <a href={lienDepot} target="_blank" rel="noreferrer" className="bouton mt-3">
              Envoyer le bon de dépôt sur WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="surtitre">Commande</span>
          <h1 className="font-mono text-3xl font-bold tracking-tight">{data.code}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Déposée {dateHeure(data.depose_le)} · à rendre {dateHeure(data.promis_pour)}{" "}
            <span className="text-neutral-500">({delaiLisible(data.promis_pour)})</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`pastille ${STATUTS[data.statut].classe}`}>
            {STATUTS[data.statut].libelle}
          </span>
          {data.express ? (
            <span className="pastille bg-amber-100 text-amber-900 ring-amber-300">Express</span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          {/* Pièces */}
          <section className="carte">
            <div className="border-b border-trait bg-panneau px-4 py-2">
              <h2 className="text-sm font-bold">
                Les pièces{" "}
                <span className="font-mono text-xs font-normal text-neutral-500">
                  ({pieces.length})
                </span>
              </h2>
            </div>
            <ul className="divide-y divide-trait">
              {pieces.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="font-mono text-sm font-semibold text-indigo">{p.code}</span>
                  <span className="text-sm">
                    {[p.couleur, p.description, p.marque].filter(Boolean).join(" · ") || "Pièce"}
                  </span>
                  {p.defauts?.length ? (
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-inset ring-rose-200">
                      constaté à la réception : {p.defauts.join(", ")}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Facture */}
          <section className="carte">
            <div className="border-b border-trait bg-panneau px-4 py-2">
              <h2 className="text-sm font-bold">Détail</h2>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {(data.lignes ?? []).map((l) => (
                  <tr key={l.id} className="border-b border-trait">
                    <td className="px-4 py-2">{l.libelle}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                      {l.quantite} × {argent(l.prix_unitaire)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {argent(l.quantite * l.prix_unitaire)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-panneau">
                  <td className="px-4 py-2 font-bold" colSpan={2}>Total</td>
                  <td className="px-4 py-2 text-right text-base font-bold tabular-nums">
                    {argent(data.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {data.note ? (
            <section className="carte p-4">
              <p className="surtitre mb-1">Note interne</p>
              <p className="text-sm text-neutral-700">{data.note}</p>
            </section>
          ) : null}

          {/* Journal */}
          <section className="carte">
            <div className="border-b border-trait bg-panneau px-4 py-2">
              <h2 className="text-sm font-bold">Journal</h2>
            </div>
            <ul className="divide-y divide-trait">
              {journal.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                  <span>
                    {e.type === "creation"
                      ? "Commande créée"
                      : `${STATUTS[e.ancien_statut as StatutCommande]?.libelle ?? e.ancien_statut} → ${STATUTS[e.nouveau_statut as StatutCommande]?.libelle ?? e.nouveau_statut}`}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-neutral-500">
                    {dateHeure(e.cree_le)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ---------------- Colonne d'action ---------------- */}
        <aside className="flex h-max flex-col gap-4 lg:sticky lg:top-6">
          <section className="carte p-4">
            <h2 className="mb-1 text-sm font-bold">{client?.nom ?? "Client inconnu"}</h2>
            <p className="font-mono text-sm text-neutral-600">{client?.telephone}</p>
            <p className="mt-1 text-sm text-neutral-600">
              {data.mode_retrait === "livraison"
                ? `Livraison — ${data.adresse_livraison ?? client?.adresse ?? ""}`
                : `Retrait au comptoir${client?.quartier ? ` · ${client.quartier}` : ""}`}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {lienDepot ? (
                <a href={lienDepot} target="_blank" rel="noreferrer" className="bouton-secondaire">
                  Renvoyer le bon de dépôt
                </a>
              ) : null}
              {lienPrete && ["prete", "en_livraison"].includes(data.statut) ? (
                <a href={lienPrete} target="_blank" rel="noreferrer" className="bouton">
                  Prévenir que c&apos;est prêt
                </a>
              ) : null}
            </div>
          </section>

          <section className="carte p-4">
            <h2 className="mb-3 text-sm font-bold">Faire avancer</h2>
            <div className="flex flex-wrap gap-2">
              {STATUTS[data.statut].suivants.map((s) => (
                <form key={s} action={changerStatut}>
                  <input type="hidden" name="commande_id" value={data.id} />
                  <input type="hidden" name="statut" value={s} />
                  <button
                    className={s === "litige" ? "bouton-secondaire" : "bouton"}
                    type="submit"
                  >
                    {STATUTS[s].libelle}
                  </button>
                </form>
              ))}
            </div>
          </section>

          <section className="carte p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-bold">Encaissement</h2>
              <span
                className={`pastille ${
                  data.statut_paiement === "paye"
                    ? "bg-emerald-50 text-emerald-800 ring-emerald-300"
                    : "bg-amber-50 text-amber-900 ring-amber-300"
                }`}
              >
                {data.statut_paiement === "paye"
                  ? "Payé"
                  : data.statut_paiement === "partiel"
                    ? "Partiel"
                    : "Impayé"}
              </span>
            </div>

            <p className="mb-3 text-sm text-neutral-600">
              Reçu {argent(paye)} · reste{" "}
              <strong className="text-encre">{argent(reste)}</strong>
            </p>

            {(data.paiements ?? []).length > 0 ? (
              <ul className="mb-3 flex flex-col gap-1 text-xs text-neutral-600">
                {data.paiements.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span>
                      {METHODES_PAIEMENT.find((m) => m.valeur === p.methode)?.libelle ?? p.methode}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </span>
                    <span className="tabular-nums">{argent(p.montant)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {reste > 0 ? (
              <form action={encaisser} className="flex flex-col gap-2">
                <input type="hidden" name="commande_id" value={data.id} />
                <input
                  name="montant"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={reste}
                  className="champ tabular-nums"
                  aria-label="Montant encaissé"
                />
                <select name="methode" className="champ" aria-label="Méthode">
                  {METHODES_PAIEMENT.map((m) => (
                    <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
                  ))}
                </select>
                <input
                  name="reference"
                  className="champ"
                  placeholder="Référence transaction (facultatif)"
                />
                <button className="bouton">Enregistrer l&apos;encaissement</button>
              </form>
            ) : null}
          </section>

          <section className="carte p-4">
            <p className="surtitre mb-1">Lien de suivi client</p>
            <Link
              href={`/suivi/${data.jeton_suivi}`}
              className="break-all font-mono text-xs text-indigo hover:underline"
            >
              /suivi/{data.jeton_suivi}
            </Link>
            <p className="mt-2 text-xs text-neutral-500">
              Consultable sans compte. Ne contient ni le nom ni le numéro du
              client — seulement sa commande.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
