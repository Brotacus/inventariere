# Inventariere frontend — teal + dark mode

Versiunea aceasta păstrează logica React/API existentă și schimbă stratul vizual.
Culoarea de brand este inspirată direct din logo: `#00868B`.

## Ce este nou

- dark mode real, persistent în `localStorage`;
- respectă tema sistemului la prima pornire;
- comutator light/dark în topbar;
- logo integrat în sidebar și ca favicon;
- identitate vizuală teal/graphite;
- command palette cu `Ctrl + K` pentru navigare rapidă;
- sidebar, topbar, carduri, tabele și formulare rafinate;
- hover/focus states și micro-animații discrete;
- tabele cu header sticky;
- responsive pentru desktop/tabletă/mobil;
- suport pentru `prefers-reduced-motion`;
- fără dependențe npm suplimentare.

## Aplicare

Din rădăcina repo-ului:

```bash
cd ~/inventariere
```

Fă întâi un branch, dacă nu ești deja pe unul:

```bash
git switch -c feature/frontend-dark-teal
```

Înlocuiește conținutul frontend-ului cu fișierele din această arhivă. Dacă ai extras arhiva în `~/Downloads/inventariere-frontend-teal`:

```bash
rm -rf frontend/src
cp -r ~/Downloads/inventariere-frontend-teal/src frontend/src
cp ~/Downloads/inventariere-frontend-teal/index.html frontend/index.html
mkdir -p frontend/public
cp ~/Downloads/inventariere-frontend-teal/public/inventory-logo.png frontend/public/inventory-logo.png
```

Nu este necesar să modifici backend-ul și nu sunt necesare pachete npm noi.

## Pornire

Backend:

```bash
cd ~/inventariere/backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload
```

Frontend, în alt terminal:

```bash
cd ~/inventariere/frontend
npm run dev
```

## Verificare și commit

```bash
cd ~/inventariere/frontend
npm run build
```

Dacă build-ul este OK:

```bash
cd ~/inventariere
git status
git add frontend
git commit -m "Redesign frontend with teal identity and dark mode"
git push -u origin feature/frontend-dark-teal
```
