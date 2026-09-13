/**
 * Le franc CFA n'a pas de subdivision en usage : tous les montants sont
 * des entiers, du formulaire jusqu'à la base. Jamais de virgule.
 */
export function argent(montant: number | null | undefined) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(montant ?? 0))} FCFA`;
}

export function dateHeure(valeur: string | Date | null | undefined) {
  if (!valeur) return "—";
  return new Date(valeur).toLocaleString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function jourHeure(valeur: string | Date | null | undefined) {
  if (!valeur) return "—";
  return new Date(valeur).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Retard en heures ; négatif si la commande est encore dans les temps. */
export function retardHeures(promisPour: string) {
  return (Date.now() - new Date(promisPour).getTime()) / 3_600_000;
}

export function delaiLisible(promisPour: string) {
  const h = retardHeures(promisPour);
  if (h > 24) return `${Math.floor(h / 24)} j de retard`;
  if (h > 0) return `${Math.floor(h)} h de retard`;
  if (h > -1) return "dans moins d'une heure";
  if (h > -24) return `dans ${Math.abs(Math.ceil(h))} h`;
  return `dans ${Math.abs(Math.ceil(h / 24))} j`;
}
