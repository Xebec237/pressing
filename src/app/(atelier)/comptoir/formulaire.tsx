"use client";

import { useMemo, useState, useTransition } from "react";
import { argent } from "@/lib/format";
import {
  enregistrerCommande,
  rechercherClient,
  type PayloadCommande,
} from "./actions";

export type Service = {
  id: string;
  categorie: string;
  traitement: string;
  libelle: string;
  prix: number;
  prix_express: number | null;
  delai_heures: number;
  delai_express_heures: number | null;
};

type PieceSaisie = { description: string; couleur: string; defauts: string };
type LigneSaisie = {
  cle: string;
  service_id: string;
  quantite: number;
  pieces: PieceSaisie[];
};

const nouvelleCle = () => Math.random().toString(36).slice(2, 9);

/** Une pièce saisie = une étiquette physique attachée au vêtement. */
function ajusterPieces(
  pieces: PieceSaisie[],
  quantite: number,
  categorie: string,
): PieceSaisie[] {
  const suite = pieces.slice(0, quantite);
  while (suite.length < quantite) {
    suite.push({ description: categorie, couleur: "", defauts: "" });
  }
  return suite;
}

function pourDatetimeLocal(d: Date) {
  const decalage = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - decalage).toISOString().slice(0, 16);
}

export default function Formulaire({ services }: { services: Service[] }) {
  const [telephone, setTelephone] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [quartier, setQuartier] = useState("");
  const [adresse, setAdresse] = useState("");
  const [connu, setConnu] = useState(false);

  const [modeRetrait, setModeRetrait] = useState<"comptoir" | "livraison">("comptoir");
  const [express, setExpress] = useState(false);
  const [note, setNote] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([]);
  const [promisPour, setPromisPour] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const parId = useMemo(
    () => new Map(services.map((s) => [s.id, s])),
    [services],
  );

  const categories = useMemo(() => {
    const groupes = new Map<string, Service[]>();
    services.forEach((s) => {
      const liste = groupes.get(s.categorie) ?? [];
      liste.push(s);
      groupes.set(s.categorie, liste);
    });
    return [...groupes.entries()];
  }, [services]);

  const prixDe = (s: Service) =>
    express && s.prix_express != null ? s.prix_express : s.prix;

  const total = lignes.reduce((somme, l) => {
    const s = parId.get(l.service_id);
    return s ? somme + prixDe(s) * l.quantite : somme;
  }, 0);

  const nbPieces = lignes.reduce((n, l) => n + l.pieces.length, 0);

  // Le délai promis est celui du service le plus lent de la commande.
  const echeanceAuto = useMemo(() => {
    const heures = lignes.reduce((max, l) => {
      const s = parId.get(l.service_id);
      if (!s) return max;
      const h =
        express && s.delai_express_heures != null
          ? s.delai_express_heures
          : s.delai_heures;
      return Math.max(max, h);
    }, 0);
    return pourDatetimeLocal(new Date(Date.now() + (heures || 48) * 3_600_000));
  }, [lignes, express, parId]);

  const echeance = promisPour ?? echeanceAuto;

  async function chercher() {
    const trouve = await rechercherClient(telephone);
    if (trouve) {
      setClientId(trouve.id);
      setNom(trouve.nom);
      setQuartier(trouve.quartier ?? "");
      setAdresse(trouve.adresse ?? "");
      setConnu(true);
    } else {
      setClientId(null);
      setConnu(false);
    }
  }

  function ajouterLigne() {
    const premier = services[0];
    if (!premier) return;
    setLignes((l) => [
      ...l,
      {
        cle: nouvelleCle(),
        service_id: premier.id,
        quantite: 1,
        pieces: ajusterPieces([], 1, premier.categorie),
      },
    ]);
  }

  function majLigne(cle: string, patch: Partial<LigneSaisie>) {
    setLignes((liste) =>
      liste.map((l) => {
        if (l.cle !== cle) return l;
        const fusion = { ...l, ...patch };
        const s = parId.get(fusion.service_id);
        return {
          ...fusion,
          pieces: ajusterPieces(
            fusion.pieces,
            fusion.quantite,
            s?.categorie ?? "Pièce",
          ),
        };
      }),
    );
  }

  function majPiece(cle: string, index: number, patch: Partial<PieceSaisie>) {
    setLignes((liste) =>
      liste.map((l) =>
        l.cle === cle
          ? {
              ...l,
              pieces: l.pieces.map((p, i) => (i === index ? { ...p, ...patch } : p)),
            }
          : l,
      ),
    );
  }

  function envoyer() {
    setErreur(null);

    if (!telephone.trim()) return setErreur("Le numéro du client est obligatoire.");
    if (!clientId && !nom.trim()) return setErreur("Le nom du client est obligatoire.");
    if (lignes.length === 0) return setErreur("Ajoute au moins un service.");
    if (modeRetrait === "livraison" && !adresse.trim())
      return setErreur("Une livraison a besoin d'une adresse.");

    const payload: PayloadCommande = {
      client_id: clientId,
      client: clientId
        ? undefined
        : { nom: nom.trim(), telephone: telephone.trim(), quartier, adresse },
      mode_retrait: modeRetrait,
      adresse_livraison: modeRetrait === "livraison" ? adresse : undefined,
      express,
      promis_pour: new Date(echeance).toISOString(),
      note: note.trim() || undefined,
      lignes: lignes.map((l) => ({
        service_id: l.service_id,
        quantite: l.quantite,
        pieces: l.pieces.map((p) => ({
          description: p.description.trim() || undefined,
          couleur: p.couleur.trim() || undefined,
          defauts: p.defauts
            .split(",")
            .map((d) => d.trim())
            .filter(Boolean),
        })),
      })),
    };

    demarrer(async () => {
      const retour = await enregistrerCommande(payload);
      if (retour?.erreur) setErreur(retour.erreur);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-6">
        {/* ---------------- Client ---------------- */}
        <section className="carte p-4">
          <h2 className="mb-3 text-sm font-bold">Client</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiquette" htmlFor="tel">
                Téléphone
              </label>
              <div className="flex gap-2">
                <input
                  id="tel"
                  className="champ"
                  inputMode="tel"
                  placeholder="+237 6.. .. .. .."
                  value={telephone}
                  onChange={(e) => {
                    setTelephone(e.target.value);
                    setClientId(null);
                    setConnu(false);
                  }}
                  onBlur={chercher}
                />
                <button type="button" className="bouton-secondaire shrink-0" onClick={chercher}>
                  Chercher
                </button>
              </div>
              {connu ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Client déjà connu — fiche rappelée.
                </p>
              ) : null}
            </div>

            <div>
              <label className="etiquette" htmlFor="nom">
                Nom
              </label>
              <input
                id="nom"
                className="champ"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom et prénom"
              />
            </div>

            <div>
              <label className="etiquette" htmlFor="quartier">
                Quartier
              </label>
              <input
                id="quartier"
                className="champ"
                value={quartier}
                onChange={(e) => setQuartier(e.target.value)}
                placeholder="Akwa, Bonapriso…"
              />
            </div>

            <div>
              <label className="etiquette" htmlFor="adresse">
                Adresse {modeRetrait === "livraison" ? "(obligatoire)" : "(si livraison)"}
              </label>
              <input
                id="adresse"
                className="champ"
                value={adresse}
                onChange={(e) => setAdresse(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---------------- Pièces ---------------- */}
        <section className="carte p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Le linge</h2>
            <button type="button" className="bouton-secondaire" onClick={ajouterLigne}>
              + Ajouter un service
            </button>
          </div>

          {lignes.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              Aucun service. Commence par en ajouter un.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {lignes.map((l) => {
                const s = parId.get(l.service_id);
                return (
                  <div key={l.cle} className="rounded border border-trait bg-panneau/50 p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[200px] flex-1">
                        <label className="etiquette">Service</label>
                        <select
                          className="champ"
                          value={l.service_id}
                          onChange={(e) => majLigne(l.cle, { service_id: e.target.value })}
                        >
                          {categories.map(([categorie, liste]) => (
                            <optgroup key={categorie} label={categorie}>
                              {liste.map((srv) => (
                                <option key={srv.id} value={srv.id}>
                                  {srv.libelle} — {argent(prixDe(srv))}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="etiquette">Quantité</label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          className="champ tabular-nums"
                          value={l.quantite}
                          onChange={(e) =>
                            majLigne(l.cle, {
                              quantite: Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                            })
                          }
                        />
                      </div>

                      <div className="w-28 text-right">
                        <label className="etiquette">Sous-total</label>
                        <p className="py-2 text-sm font-semibold tabular-nums">
                          {argent(s ? prixDe(s) * l.quantite : 0)}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="pb-2 text-xs font-medium text-rose-700 hover:underline"
                        onClick={() => setLignes((liste) => liste.filter((x) => x.cle !== l.cle))}
                      >
                        Retirer
                      </button>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <p className="surtitre">
                        {l.pieces.length} étiquette{l.pieces.length > 1 ? "s" : ""}
                      </p>
                      {l.pieces.map((p, i) => (
                        <div key={i} className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_1.4fr]">
                          <input
                            className="champ"
                            placeholder="Description"
                            value={p.description}
                            onChange={(e) => majPiece(l.cle, i, { description: e.target.value })}
                          />
                          <input
                            className="champ"
                            placeholder="Couleur"
                            value={p.couleur}
                            onChange={(e) => majPiece(l.cle, i, { couleur: e.target.value })}
                          />
                          <input
                            className="champ"
                            placeholder="Défauts constatés (séparés par des virgules)"
                            value={p.defauts}
                            onChange={(e) => majPiece(l.cle, i, { defauts: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="carte p-4">
          <label className="etiquette" htmlFor="note">
            Note interne
          </label>
          <textarea
            id="note"
            className="champ min-h-[72px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Instruction particulière pour l'atelier"
          />
        </section>
      </div>

      {/* ---------------- Récapitulatif ---------------- */}
      <aside className="flex h-max flex-col gap-4 lg:sticky lg:top-6">
        <section className="carte p-4">
          <h2 className="mb-3 text-sm font-bold">Retrait</h2>

          <div className="mb-3 grid grid-cols-2 gap-2">
            {(["comptoir", "livraison"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeRetrait(m)}
                className={`rounded border px-3 py-2 text-sm font-semibold capitalize transition ${
                  modeRetrait === m
                    ? "border-indigo bg-indigo-clair text-indigo"
                    : "border-trait bg-white text-neutral-600 hover:bg-panneau"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={express}
              onChange={(e) => {
                setExpress(e.target.checked);
                setPromisPour(null);
              }}
              className="h-4 w-4 accent-indigo"
            />
            <span className="font-medium">Express</span>
            <span className="text-neutral-500">— tarif et délai majorés</span>
          </label>

          <label className="etiquette" htmlFor="echeance">
            Prêt le
          </label>
          <input
            id="echeance"
            type="datetime-local"
            className="champ"
            value={echeance}
            onChange={(e) => setPromisPour(e.target.value)}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Calculé sur le service le plus lent. Ne promets pas plus court que
            ce que l&apos;atelier tient.
          </p>
        </section>

        <section className="carte p-4">
          <div className="flex items-baseline justify-between">
            <span className="surtitre">Total</span>
            <span className="text-2xl font-bold tabular-nums">{argent(total)}</span>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {nbPieces} pièce{nbPieces > 1 ? "s" : ""} · {lignes.length} service
            {lignes.length > 1 ? "s" : ""}
          </p>

          {erreur ? (
            <p className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {erreur}
            </p>
          ) : null}

          <button
            type="button"
            className="bouton mt-4 w-full"
            disabled={enCours}
            onClick={envoyer}
          >
            {enCours ? "Enregistrement…" : "Enregistrer la commande"}
          </button>
          <p className="mt-2 text-center text-xs text-neutral-500">
            Le bon de dépôt WhatsApp s&apos;affiche juste après.
          </p>
        </section>
      </aside>
    </div>
  );
}
