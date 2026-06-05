/**
 * Villes a scanner par region pour le Radar de nouveaux prospects.
 * Prefectures + sous-prefectures + villes moyennes.
 * Cle = region key tel que stocke dans la table prospects.
 */
export const REGION_CITIES: Record<string, string[]> = {
  "lorraine-rurale": [
    "Metz", "Nancy", "Thionville", "Epinal", "Bar-le-Duc",
    "Verdun", "Luneville", "Sarrebourg", "Sarreguemines", "Forbach",
    "Saint-Die-des-Vosges", "Pont-a-Mousson", "Toul", "Commercy",
  ],
  "occitanie-rurale": [
    "Cahors", "Rodez", "Mende", "Auch", "Albi",
    "Montauban", "Tarbes", "Foix", "Millau", "Figeac",
    "Villefranche-de-Rouergue", "Castres", "Condom", "Decazeville",
  ],
  "auvergne": [
    "Clermont-Ferrand", "Moulins", "Aurillac", "Le Puy-en-Velay",
    "Vichy", "Montlucon", "Riom", "Issoire", "Thiers",
    "Yssingeaux", "Brioude", "Ambert", "Saint-Flour",
  ],
  "bourgogne": [
    "Dijon", "Auxerre", "Nevers", "Macon", "Chalon-sur-Saone",
    "Sens", "Beaune", "Autun", "Le Creusot", "Montceau-les-Mines",
    "Avallon", "Joigny", "Tonnerre",
  ],
  "centre": [
    "Orleans", "Tours", "Bourges", "Chartres", "Blois",
    "Chateauroux", "Dreux", "Vierzon", "Montargis", "Vendome",
    "Chinon", "Amboise", "Romorantin-Lanthenay",
  ],
  "champagne-rurale": [
    "Troyes", "Charleville-Mezieres", "Chaumont", "Sedan",
    "Saint-Dizier", "Langres", "Vitry-le-Francois", "Rethel",
    "Nogent-sur-Seine", "Romilly-sur-Seine", "Bar-sur-Aube",
  ],
  "limousin": [
    "Limoges", "Brive-la-Gaillarde", "Tulle", "Gueret",
    "Ussel", "Saint-Junien", "Aubusson", "Bellac",
    "Saint-Yrieix-la-Perche", "Egletons",
  ],
  "normandie-rurale": [
    "Caen", "Rouen", "Le Havre", "Alencon", "Evreux",
    "Lisieux", "Cherbourg", "Dieppe", "Fecamp", "Bayeux",
    "Argentan", "Flers", "Vire", "Coutances",
  ],
  "poitou": [
    "Poitiers", "Niort", "La Rochelle", "Angouleme", "Saintes",
    "Cognac", "Rochefort", "Chatellerault", "Bressuire",
    "Parthenay", "Thouars", "Royan", "Jonzac",
  ],
  "pyrenees-rurales": [
    "Pau", "Tarbes", "Bayonne", "Biarritz", "Oloron-Sainte-Marie",
    "Lourdes", "Orthez", "Lannemezan", "Bagneres-de-Bigorre",
    "Saint-Jean-de-Luz", "Hendaye", "Mourenx",
  ],
};
