import { getProspectById } from "@/app/lib/demo";
import { renderOgImage, ogSize, ogContentType, ogAlt } from "@/app/lib/ogImage";

export const dynamic = "force-dynamic";
export const size = ogSize;
export const contentType = ogContentType;
export const alt = ogAlt;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderOgImage(await getProspectById(id));
}
