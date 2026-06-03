import { getProspectById, demoMetadata, DemoView } from "@/app/lib/demo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return demoMetadata(await getProspectById(id));
}

export default async function DemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ style?: string }>;
}) {
  const { id } = await params;
  const { style } = await searchParams;
  const prospect = await getProspectById(id);
  return <DemoView prospect={prospect} style={style} />;
}
