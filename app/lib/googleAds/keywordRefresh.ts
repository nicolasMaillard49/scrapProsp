/**
 * Rafraîchissement des mots-clés d'une campagne EXISTANTE (sans la recréer).
 *
 * Cœur PUR : construit les opérations `mutateResources` (supprime les anciens
 * `ad_group_criterion` mots-clés + crée les nouveaux sur le groupe d'annonces).
 * Aucune I/O ici → testé unitairement. La lecture des resource_names existants et
 * l'appel mutate vivent dans create.ts (smoke-test runtime).
 */
import { enums } from "google-ads-api";
import type { Keyword } from "./copy";

/**
 * Opération mutate (forme tolérante, comme dans create.ts).
 * `mutateResources` lit `resource` comme valeur du oneof d'opération :
 *  - create → un objet ressource
 *  - remove → la **string** resource_name (sinon `{ remove: undefined }` → oneof vide).
 */
export interface MutateOp {
  entity: string;
  operation: "create" | "remove";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resource?: any;
}

/**
 * Construit les ops pour remplacer les mots-clés d'un groupe d'annonces :
 *  - 1 op `remove` par mot-clé existant (par resource_name)
 *  - 1 op `create` par nouveau mot-clé (text + match_type) sur le groupe
 */
export function buildKeywordRefreshOps(
  adGroupResourceName: string,
  existingKeywordResourceNames: string[],
  newKeywords: Keyword[],
): MutateOp[] {
  const removes: MutateOp[] = existingKeywordResourceNames.map((rn) => ({
    entity: "ad_group_criterion",
    operation: "remove",
    resource: rn, // string resource_name = valeur du oneof `remove`
  }));

  const creates: MutateOp[] = newKeywords.map((kw) => ({
    entity: "ad_group_criterion",
    operation: "create",
    resource: {
      ad_group: adGroupResourceName,
      status: enums.AdGroupCriterionStatus.ENABLED,
      keyword: { text: kw.text, match_type: enums.KeywordMatchType[kw.match] },
    },
  }));

  return [...removes, ...creates];
}
