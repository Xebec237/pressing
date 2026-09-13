import { supabaseServeur } from "@/lib/supabase/serveur";
import Formulaire, { type Service } from "./formulaire";

export const dynamic = "force-dynamic";

export default async function Comptoir() {
  const supabase = await supabaseServeur();

  const { data: services, error } = await supabase
    .from("services")
    .select(
      "id, categorie, traitement, libelle, prix, prix_express, delai_heures, delai_express_heures",
    )
    .eq("actif", true)
    .order("ordre", { ascending: true })
    .returns<Service[]>();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="surtitre">Comptoir</span>
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle commande</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Compte les pièces et note les défauts <strong>maintenant</strong>, à la
          réception. C&apos;est ce qui règle les litiges dans trois jours.
        </p>
      </div>

      {error ? (
        <p className="rounded border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          Catalogue illisible : {error.message}
        </p>
      ) : null}

      {!error && (services ?? []).length === 0 ? (
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Le catalogue est vide. Passe par <strong>Catalogue</strong> pour
          installer les services de départ avant de prendre une commande.
        </p>
      ) : null}

      <Formulaire services={services ?? []} />
    </div>
  );
}
