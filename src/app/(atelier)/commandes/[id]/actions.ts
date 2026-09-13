"use server";

import { revalidatePath } from "next/cache";
import { supabaseServeur } from "@/lib/supabase/serveur";

export async function changerStatut(donnees: FormData) {
  const id = String(donnees.get("commande_id"));
  const statut = String(donnees.get("statut"));

  const supabase = await supabaseServeur();
  await supabase.from("commandes").update({ statut }).eq("id", id);

  // L'horodatage (prete_le, livree_le) et le journal sont posés par des
  // déclencheurs en base : ils s'appliquent quelle que soit la voie
  // d'écriture, y compris une correction faite à la main dans Supabase.
  revalidatePath(`/commandes/${id}`);
  revalidatePath("/jour");
}

export async function encaisser(donnees: FormData) {
  const id = String(donnees.get("commande_id"));
  const montant = Number(donnees.get("montant"));
  if (!Number.isFinite(montant) || montant <= 0) return;

  const supabase = await supabaseServeur();

  const { data: commande } = await supabase
    .from("commandes")
    .select("pressing_id")
    .eq("id", id)
    .maybeSingle();

  if (!commande) return;

  await supabase.from("paiements").insert({
    commande_id: id,
    pressing_id: commande.pressing_id,
    montant: Math.round(montant),
    methode: String(donnees.get("methode")),
    reference: String(donnees.get("reference") ?? "") || null,
  });

  revalidatePath(`/commandes/${id}`);
  revalidatePath("/jour");
}
