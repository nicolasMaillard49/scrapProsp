import { demoMetadata, DemoView } from "@/app/lib/demo";
import { getInstagramProspectByCode } from "@/app/lib/instagramDemo";
import type { Metadata } from "next";

// Aperçu sur-mesure d'un prospect Instagram : /di/{8 premiers caractères de l'UUID}.
// Réutilise les templates de démo (DemoView) ; alimenté par instagram_prospects.
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
  return <DemoView prospect={prospect} style={style} />;
}
