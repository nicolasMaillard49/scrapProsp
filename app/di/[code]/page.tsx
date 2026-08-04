import { demoMetadata, StaticDemoView } from "@/app/lib/demo";
import IgDemoTracker from "@/app/components/IgDemoTracker";
import { getInstagramProspectByCode } from "@/app/lib/instagramDemo";
import type { Metadata } from "next";

// Aperçu sur-mesure d'un prospect Instagram : /di/{8 premiers caractères de l'UUID}.
// Réutilise les templates de démo (StaticDemoView : table différente, pas de
// tracking demo_views ni de Stripe) ; alimenté par instagram_prospects.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return demoMetadata(await getInstagramProspectByCode(code));
}

export default async function InstagramDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const { code } = await params;
  const { style } = await searchParams;
  const prospect = await getInstagramProspectByCode(code);
  return (
    <>
      <StaticDemoView prospect={prospect} style={style} />
      {/* Traceur invisible : « il regarde sa maquette MAINTENANT » est le
          signal le plus fort du tunnel, et c'etait le seul qu'on ne voyait
          pas. Il n'ajoute rien a l'ecran — une maquette envoyee en DM ne doit
          pas ressembler a une page de vente. */}
      {prospect && <IgDemoTracker prospectId={prospect.id} />}
    </>
  );
}
