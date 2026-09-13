"use server";

import { revalidatePath } from "next/cache";
import { supabaseServeur } from "@/lib/supabase/serveur";

export async function installerCatalogue() {
  const supabase = await supabaseServeur();

  const { data: pressingId } = await supabase.rpc("mon_pressing_id");
  if (!pressingId) return;

  await supabase.rpc("installer_catalogue_par_defaut", { p_pressing: pressingId });
  revalidatePath("/catalogue");
}

export async function majTarif(donnees: FormData) {
  const id = String(donnees.get("service_id"));
  const prix = Number(donnees.get("prix"));
  const express = donnees.get("prix_express");
  const delai = Number(donnees.get("delai_heures"));

  if (!Number.isFinite(prix) || prix < 0) return;

  const supabase = await supabaseServeur();
  await supabase
    .from("services")
    .update({
      prix: Math.round(prix),
      prix_express:
        express === null || String(express).trim() === ""
          ? null
          : Math.round(Number(express)),
      delai_heures: Number.isFinite(delai) && delai > 0 ? Math.round(delai) : 48,
    })
    .eq("id", id);

  // Les commandes déjà déposées ne bougent pas : leur prix a été copié
  // dans lignes.prix_unitaire au moment du dépôt.
  revalidatePath("/catalogue");
}

export async function basculerService(donnees: FormData) {
  const id = String(donnees.get("service_id"));
  const actif = String(donnees.get("actif")) === "true";

  const supabase = await supabaseServeur();
  await supabase.from("services").update({ actif: !actif }).eq("id", id);
  revalidatePath("/catalogue");
}
