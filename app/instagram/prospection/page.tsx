import { redirect } from "next/navigation";

// L'outil de prospection est désormais intégré en haut de /instagram
// (outil au-dessus, liste des prospects en dessous).
export default function ProspectionRedirect() {
  redirect("/instagram");
}
