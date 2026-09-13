import { supabaseServeur } from "@/lib/supabase/serveur";
import { argent } from "@/lib/format";
import { basculerService, installerCatalogue, majTarif } from "./actions";

export const dynamic = "force-dynamic";

type Service = {
  id: string;
  categorie: string;
  traitement: string;
  libelle: string;
  prix: number;
  prix_express: number | null;
  delai_heures: number;
  actif: boolean;
};

export default async function Catalogue() {
  const supabase = await supabaseServeur();

  const { data, error } = await supabase
    .from("services")
    .select("id, categorie, traitement, libelle, prix, prix_express, delai_heures, actif")
    .order("ordre", { ascending: true })
    .returns<Service[]>();

  const services = data ?? [];

  const groupes = services.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.categorie] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="surtitre">Tarifs</span>
          <h1 className="text-2xl font-bold tracking-tight">Catalogue</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-600">
            Ces prix ne réécrivent jamais une commande déjà déposée : le tarif
            est copié sur la ligne au moment du dépôt.
          </p>
        </div>
        {services.length === 0 ? (
          <form action={installerCatalogue}>
            <button className="bouton">Installer le catalogue de départ</button>
          </form>
        ) : null}
      </div>

      {error ? (
        <p className="rounded border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error.message}
        </p>
      ) : null}

      {services.length === 0 && !error ? (
        <p className="carte px-4 py-10 text-center text-sm text-neutral-500">
          Aucun service. Installe le catalogue de départ, puis ajuste chaque
          prix sur ta grille réelle.
        </p>
      ) : null}

      {Object.entries(groupes).map(([categorie, liste]) => (
        <section key={categorie} className="carte overflow-hidden">
          <div className="border-b border-trait bg-panneau px-4 py-2">
            <h2 className="text-sm font-bold">{categorie}</h2>
          </div>

          <ul className="divide-y divide-trait">
            {liste.map((s) => (
              <li
                key={s.id}
                className={`flex flex-wrap items-end gap-3 px-4 py-3 ${
                  s.actif ? "" : "bg-neutral-50 opacity-60"
                }`}
              >
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-semibold">{s.libelle}</p>
                  <p className="font-mono text-xs text-neutral-500">{s.traitement}</p>
                </div>

                <form action={majTarif} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="service_id" value={s.id} />
                  <div className="w-28">
                    <label className="etiquette">Prix</label>
                    <input
                      name="prix"
                      type="number"
                      min={0}
                      step={50}
                      defaultValue={s.prix}
                      className="champ tabular-nums"
                    />
                  </div>
                  <div className="w-28">
                    <label className="etiquette">Express</label>
                    <input
                      name="prix_express"
                      type="number"
                      min={0}
                      step={50}
                      defaultValue={s.prix_express ?? ""}
                      placeholder="—"
                      className="champ tabular-nums"
                    />
                  </div>
                  <div className="w-24">
                    <label className="etiquette">Délai (h)</label>
                    <input
                      name="delai_heures"
                      type="number"
                      min={1}
                      step={1}
                      defaultValue={s.delai_heures}
                      className="champ tabular-nums"
                    />
                  </div>
                  <button className="bouton-secondaire">Enregistrer</button>
                </form>

                <form action={basculerService}>
                  <input type="hidden" name="service_id" value={s.id} />
                  <input type="hidden" name="actif" value={String(s.actif)} />
                  <button className="pb-2 text-xs font-medium text-neutral-500 hover:underline">
                    {s.actif ? "Désactiver" : "Réactiver"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {services.length > 0 ? (
        <p className="text-xs text-neutral-500">
          Total du catalogue : {services.length} services ·{" "}
          {services.filter((s) => s.actif).length} actifs · panier moyen
          théorique {argent(
            Math.round(
              services.filter((s) => s.actif).reduce((n, s) => n + s.prix, 0) /
                Math.max(1, services.filter((s) => s.actif).length),
            ),
          )}
        </p>
      ) : null}
    </div>
  );
}
