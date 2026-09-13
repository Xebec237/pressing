import { argent, dateHeure } from "./format";

/**
 * Phase 1 : pas d'API WhatsApp Business.
 *
 * Le comptoir clique sur un lien wa.me qui ouvre la conversation avec le
 * message déjà rédigé, et envoie. Zéro configuration Meta, zéro
 * vérification d'entreprise, zéro coût — et le client reçoit exactement
 * la même chose. L'automatisation viendra quand le volume la justifiera.
 */
export function lienWhatsApp(telephone: string, message: string) {
  const numero = telephone.replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;
}

type Piece = {
  code: string;
  description: string | null;
  couleur: string | null;
  defauts: string[] | null;
};

type Commande = {
  code: string;
  total: number;
  promis_pour: string;
  jeton_suivi: string;
};

/**
 * Le bon de dépôt : la liste des pièces et les défauts constatés À LA
 * RÉCEPTION, horodatés dans la conversation du client. C'est ce message
 * qui règle les litiges — et c'est ce que le carnet du pressing d'en
 * face ne sait pas faire.
 */
export function bonDeDepot(
  pressing: string,
  commande: Commande,
  pieces: Piece[],
) {
  const base = process.env.NEXT_PUBLIC_URL_PUBLIQUE ?? "";
  const lignes = pieces.map((p) => {
    const details = [p.couleur, p.description].filter(Boolean).join(" ");
    const defauts = p.defauts?.length ? ` — constaté : ${p.defauts.join(", ")}` : "";
    return `${p.code} · ${details || "pièce"}${defauts}`;
  });

  return [
    `*${pressing}*`,
    `Dépôt enregistré — commande *${commande.code}*`,
    `${pieces.length} pièce${pieces.length > 1 ? "s" : ""} :`,
    "",
    ...lignes,
    "",
    `À retirer : ${dateHeure(commande.promis_pour)}`,
    `Montant : ${argent(commande.total)}`,
    "",
    `Suivi : ${base}/suivi/${commande.jeton_suivi}`,
  ].join("\n");
}

export function messagePrete(pressing: string, code: string, montant: number) {
  return [
    `*${pressing}*`,
    `Votre commande *${code}* est prête ✅`,
    `Montant à régler : ${argent(montant)}`,
  ].join("\n");
}
