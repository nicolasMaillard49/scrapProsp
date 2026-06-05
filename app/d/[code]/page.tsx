import { getProspectByCode, demoMetadata, DemoView } from "@/app/lib/demo";
import type { Metadata } from "next";

// Route courte des démos : /d/{8 premiers caractères de l'UUID}.
// Plus courte que /demo/{uuid complet} -> SMS en 1 segment (cf. lib/sms).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return demoMetadata(await getProspectByCode(code));
}

export default async function ShortDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const { code } = await params;
  const { style } = await searchParams;
  const prospect = await getProspectByCode(code);
  return <DemoView prospect={prospect} style={style} />;
}
