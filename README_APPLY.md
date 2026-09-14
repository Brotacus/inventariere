# Device tracking + locatii + imagini

Update-ul adauga:

- locatie obligatorie la crearea unui obiect nou;
- coloana de locatie direct in Inventar;
- pagina individuala pentru fiecare obiect (`Urmareste obiectul`);
- schimbarea locatiei curente din pagina obiectului;
- istoric permanent al mutarilor (locatie veche -> locatie noua + data/ora);
- upload multiplu de fotografii PNG/JPG/WEBP;
- galerie foto pe fiecare obiect;
- stergere individuala a fotografiilor;
- log-uri pentru asignarea/schimbarea locatiei si pentru upload/delete imagine;
- dark mode si tema teal existente sunt pastrate.

## Aplicare

Recomandat: creeaza intai un branch.

```bash
cd ~/inventariere
git switch -c feature/device-tracking
```

Extrage arhiva in Windows. Daca folderul extras este, de exemplu:

`C:\Users\RTX\Downloads\inventariere-tracking-update`

ruleaza din WSL:

```bash
cp -a /mnt/c/Users/RTX/Downloads/inventariere-tracking-update/. ~/inventariere/
```

`cp -a .../.` este important: face merge peste proiectul existent si copiaza inclusiv `.gitignore`, fara sa-ti stearga celelalte fisiere din backend.

## Backend

```bash
cd ~/inventariere/backend
source .venv/bin/activate
pip install -r requirements.txt
```

Este adaugat `python-multipart`, necesar pentru upload-ul imaginilor.

Pentru obiectele deja existente ruleaza o singura data:

```bash
python migrate_tracking.py
```

Scriptul creeaza tabelele noi si adauga o intrare initiala de tracking obiectelor care aveau deja `location_id`.
Obiectele vechi fara locatie raman marcate in UI cu `Locatie nesetata`; deschide obiectul si alege prima locatie.

Pornire backend:

```bash
python -m uvicorn app.main:app --reload
```

## Frontend

Intr-un terminal separat:

```bash
cd ~/inventariere/frontend
npm run dev
```

## Cum se foloseste

1. Creeaza cel putin o locatie din `Locations`.
2. La `Add Device`, locatia este obligatorie.
3. Poti selecta pana la 10 imagini in formularul de adaugare.
4. In `Inventory`, apasa butonul cu ochiul de pe un obiect (sau dublu click pe rand).
5. In pagina obiectului poti:
   - vedea locatia curenta;
   - muta obiectul in alta locatie;
   - vedea istoricul complet al mutarilor;
   - adauga/sterge fotografii.

Imaginile sunt salvate local in:

```text
backend/uploads/devices/<device_id>/
```

Folderul `backend/uploads/` este ignorat de Git intentionat. Imaginile raman pe calculator/server dupa restart, dar nu sunt urcate in repository.

Limite upload:
- maximum 10 imagini per request;
- maximum 8 MB per imagine;
- PNG, JPEG, WEBP.

## Verificare

```bash
cd ~/inventariere/frontend
npm run build
```

Apoi:

```bash
cd ~/inventariere
git status
git add .
git commit -m "Add device tracking locations and image uploads"
git push -u origin feature/device-tracking
```
