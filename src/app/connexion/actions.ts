"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServeur } from "@/lib/supabase/serveur";

export async function connecter(donnees: FormData) {
  const supabase = await supabaseServeur();
  const suite = (donnees.get("suite") as string) || "/jour";

  const { error } = await supabase.auth.signInWithPassword({
    email: String(donnees.get("email") ?? ""),
    password: String(donnees.get("motdepasse") ?? ""),
  });

  if (error) {
    // Message volontairement générique : ne pas révéler si l'adresse existe.
    redirect(`/connexion?erreur=${encodeURIComponent("Adresse e-mail ou mot de passe incorrect.")}`);
  }

  revalidatePath("/", "layout");
  redirect(suite);
}

export async function deconnecter() {
  const supabase = await supabaseServeur();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/connexion");
}
