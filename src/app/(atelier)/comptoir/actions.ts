"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServeur } from "@/lib/supabase/serveur";

export type ClientTrouve = {
  id: string;
  nom: string;
  telephone: string;
  quartier: string | null;
  adresse: string | null;
};

/** Le numéro de téléphone est la clé de recherche au comptoir. */
export async function rechercherClient(
  telephone: string,
): Promise<ClientTrouve | null> {
  const propre = telephone.trim();
  if (propre.length < 6) return null;

  const supabase = await supabaseServeur();
  const { data } = await supabase
    .from("clients")
    .select("id, nom, telephone, quartier, adresse")
    .eq("telephone", propre)
    .maybeSingle();

  return data ?? null;
}

export type PayloadCommande = {
  client_id?: string | null;
  client?: {
    nom: string;
    telephone: string;
    quartier?: string;
    adresse?: string;
  };
  mode_retrait: "comptoir" | "livraison";
  adresse_livraison?: string;
  express: boolean;
  promis_pour: string;
  note?: string;
  lignes: {
    service_id: string;
    quantite: number;
    pieces: { description?: string; couleur?: string; defauts?: string[] }[];
  }[];
};

export async function enregistrerCommande(payload: PayloadCommande) {
  const supabase = await supabaseServeur();

  // Tout se joue dans creer_commande : client, commande, lignes et pièces
  // sont écrits dans une seule transaction. Les prix viennent du catalogue
  // côté base — ce que le navigateur envoie n'est jamais facturé.
  const { data, error } = await supabase.rpc("creer_commande", { p: payload });

  if (error) {
    return { erreur: error.message };
  }

  const resultat = data as { id: string; code: string };
  revalidatePath("/jour");
  redirect(`/commandes/${resultat.id}?nouveau=1`);
}
