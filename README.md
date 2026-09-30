# ✨ Interactive k-Weisfeiler-Leman Visualization ✨
Visualisation 1-WL et 2-FWL avec backend Python/Eel.

- Saisie par arêtes : `[(0, 1), (1, 2)]`.
- Saisie par voisinages : `[(0, 1, 2), (2, 3)]` ajoute 0–1, 0–2 et 2–3.
- `(4,)` déclare un sommet isolé. Les identifiants sont des entiers ; les graphes sont non orientés.
- Pour comparer des graphes, saisir une liste par ligne (ou une liste de listes). Les identifiants peuvent se répéter entre graphes : les étiquettes sont conservées et les identifiants internes sont séparés. La galerie et le presse-papiers conservent ces frontières.

Sélectionner **2-FWL (paires)** affiche la matrice initiale ; **Run WL Iteration** affiche ensuite les matrices avant/après. Le survol d'une case met en évidence ses sommets et l'arête existante, en 2D comme en 3D. Les flèches permettent aussi de parcourir les cases après Tab. Tous les graphes ont leurs matrices affichées directement. Les grandes matrices se parcourent par défilement, avec chargement automatique des cases visibles.

Le calcul considère l'union disjointe des graphes, avec un dictionnaire de couleurs commun à toutes les composantes. Conformément à la variante demandée, seules les paires dans une même composante connexe sont calculées :

`c_next(u,v) = intern(c(u,v), multiensemble(tri(c(u,w), c(w,v)) pour w dans C(u)))`.

La convention retenue pour ce projet trie les **deux couleurs de chaque voisin**, puis les voisins eux-mêmes, sans supprimer leurs répétitions. Elle garantit `c(u,v) = c(v,u)` à chaque étape pour les graphes non orientés. C'est une variante symétrique de la définition à tuples de couleurs ordonnés. Les matrices affichent directement les couleurs calculées ; aucune symétrisation visuelle ne les modifie.

Un seul dictionnaire de signatures attribue les couleurs sur l'ensemble des graphes à chaque tour. Deux paires de même couleur ont donc la même signature de raffinement à cette étape. Cela ne prouve pas qu'elles soient équivalentes par automorphisme. Les numéros de couleurs ne sont pas comparables entre exécutions indépendantes.

Les paires entre composantes n'ont aucune couleur (cases grises « — »), même au sein d'un même graphe saisi. Les diagonales, arêtes, non-arêtes connexes et boucles sont distinguées à l'initialisation. Les histogrammes sont comparés par graphe ; leur égalité ne prouve pas l'isomorphisme. La convergence porte sur la stabilité de la partition, pas sur les numéros des couleurs.

Les matrices sont stockées par composante côté Python ; seuls deux tours sont conservés et au plus 40 × 40 cases par état sont transférées au frontend. Les limites sont définies dans `project/src/utils/graph.py` : 1 000 000 de paires connexes et 8 000 000 de triplets par itération. Le coût dépend des tailles des composantes (somme des carrés pour les matrices, somme des cubes avant tri pour le raffinement). Un dépassement affiche une erreur et préserve l'état consultable. Les signatures exactes sont compactées en octets, sans hachage probabiliste.

Tests backend, depuis la racine :

```sh
.venv/bin/python -m unittest discover -s project/tests -v
```

Test navigateur facultatif : après avoir démarré l'application Eel, exécuter `project/tests/browser_smoke.py` avec un environnement disposant de Playwright et de Chromium (`python -m playwright install chromium`). `WL_TEST_URL` permet de choisir l'URL locale (par défaut `http://localhost:8000`). Ce test charge ses propres graphes dans l'application de test.
