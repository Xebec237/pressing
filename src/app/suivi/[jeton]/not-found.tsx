export default function Introuvable() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-sm flex-col justify-center gap-3 px-5 text-center">
      <h1 className="text-xl font-bold">Lien de suivi invalide</h1>
      <p className="text-sm leading-relaxed text-neutral-600">
        Ce lien ne correspond à aucune commande. Vérifiez le message reçu, ou
        appelez directement le pressing.
      </p>
    </main>
  );
}
