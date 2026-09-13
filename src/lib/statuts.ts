export type StatutCommande =
  | "recue"
  | "triee"
  | "en_traitement"
  | "prete"
  | "en_livraison"
  | "livree"
  | "litige"
  | "abandonnee";

type Definition = {
  libelle: string;
  /** Ce que le client comprend, affiché sur la page de suivi. */
  publique: string;
  classe: string;
  /** Transitions proposées à l'écran. Le reste passe par le patron. */
  suivants: StatutCommande[];
};

export const STATUTS: Record<StatutCommande, Definition> = {
  recue: {
    libelle: "Reçue",
    publique: "Votre linge est enregistré",
    classe: "bg-slate-100 text-slate-700 ring-slate-300",
    suivants: ["triee", "litige"],
  },
  triee: {
    libelle: "Triée & étiquetée",
    publique: "Votre linge est trié",
    classe: "bg-sky-50 text-sky-800 ring-sky-300",
    suivants: ["en_traitement", "litige"],
  },
  en_traitement: {
    libelle: "En traitement",
    publique: "Votre linge est en traitement",
    classe: "bg-amber-50 text-amber-900 ring-amber-300",
    suivants: ["prete", "litige"],
  },
  prete: {
    libelle: "Prête",
    publique: "Votre linge est prêt",
    classe: "bg-emerald-50 text-emerald-800 ring-emerald-300",
    suivants: ["en_livraison", "livree", "litige"],
  },
  en_livraison: {
    libelle: "En livraison",
    publique: "Votre linge est en route",
    classe: "bg-indigo-clair text-indigo ring-indigo/40",
    suivants: ["livree", "litige"],
  },
  livree: {
    libelle: "Livrée",
    publique: "Livrée",
    classe: "bg-emerald-600 text-white ring-emerald-700",
    suivants: ["litige"],
  },
  litige: {
    libelle: "Litige",
    publique: "En cours de résolution",
    classe: "bg-rose-50 text-rose-800 ring-rose-300",
    suivants: ["en_traitement", "prete", "livree"],
  },
  abandonnee: {
    libelle: "Abandonnée",
    publique: "Non retirée",
    classe: "bg-neutral-200 text-neutral-600 ring-neutral-400",
    suivants: ["livree"],
  },
};

/** Statuts qui occupent encore l'atelier. */
export const EN_COURS: StatutCommande[] = ["recue", "triee", "en_traitement"];

export const METHODES_PAIEMENT = [
  { valeur: "om", libelle: "Orange Money" },
  { valeur: "momo", libelle: "MTN MoMo" },
  { valeur: "especes", libelle: "Espèces" },
  { valeur: "virement", libelle: "Virement" },
] as const;
