# Responsabili pentru obiecte

Arhivă completă de surse, bazată pe Brotacus/inventariere, commit 6103514.
Include backend, frontend, resursele proiectului și testele. Nu este un script de patch.
Dependențele se instalează local; node_modules, .venv, parolele, bazele de date și încărcările personale nu sunt incluse.

## Actualizarea instalării existente în WSL

1. Oprește backend-ul și frontend-ul cu Ctrl+C în ambele terminale.
2. Fă o copie a întregului proiect (inclusiv .env, baza de date și uploads):

```bash
cd ~
cp -a inventariere "inventariere-backup-$(date +%Y%m%d-%H%M%S)"
```

3. Extrage arhiva într-un director separat. Copiază conținutul folderului `inventariere` din arhivă peste `~/inventariere`, acceptând înlocuirea fișierelor de cod. Nu șterge folderul existent. Arhiva nu conține `.env`, `inventory.db` sau fotografii personale, deci nu le înlocuiește. Păstrează valoarea DATABASE_URL și configurația SMTP existente.
4. În terminalul backend:

```bash
cd ~/inventariere/backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

5. În alt terminal Ubuntu/WSL:

```bash
cd ~/inventariere/frontend
npm ci
npm run dev
```

Folosește Node/npm instalate în Ubuntu, nu executabilele Windows. Node trebuie să fie compatibil cu Vite 7 (20.19+ sau 22.12+). Deschide http://localhost:5173 și reautentifică-te. Dacă browserul păstrează interfața veche, folosește Ctrl+F5.

Pentru o instalare nouă, creează `backend/.env` din `.env.example` și setează ADMIN_PASSWORD înainte de autentificare. Pentru o instalare existentă păstrează fișierul `.env` actual, inclusiv emailul și parola de aplicație SMTP.

## Utilizare

- Persoane: bifează „Responsabil pentru obiecte”, „Poate împrumuta obiecte” sau ambele. Este obligatoriu cel puțin un rol.
- Rolurile sunt atribuții de inventar, nu conturi de autentificare sau permisiuni de administrator.
- Adaugă obiect: selectează un responsabil activ sau lasă „Fără responsabil”.
- Inventar → Urmărește obiectul: vezi separat responsabilul și împrumutătorul curent; poți schimba sau elimina responsabilul inclusiv în timpul unui împrumut.
- Împrumuturi: apar numai persoanele active care pot împrumuta. Împrumutul și returnarea nu modifică responsabilul.
- Persoane: filtrare după rol și listă extensibilă cu obiectele asociate fiecărui responsabil.
- Un responsabil cu obiecte asociate nu poate fi dezactivat și nu poate pierde acel rol înainte de reasocierea/eliminarea responsabilităților.
- O persoană cu împrumut activ nu poate fi dezactivată și nu poate pierde rolul de împrumutător până la returnare.
- Schimbarea responsabilului apare în jurnal și notificări; modificările persoanelor apar în logurile tehnice.

## Migrarea datelor existente

La prima pornire se adaugă automat coloanele de rol în SQLite. Migrarea poate rula repetat fără să reseteze rolurile.
Persoanele existente primesc rolul de împrumutător pentru a păstra compatibilitatea. Persoanele deja asociate câmpului responsible_person_id primesc și rolul de responsabil. Nicio asociere existentă nu este ștearsă.

ATENȚIE LA SEMNIFICAȚIA DATELOR VECHI: versiunea anterioară punea automat împrumutătorul în câmpul responsabil și îl ștergea la returnare. Nu se poate deduce sigur responsabilul real din acest câmp. Verifică o singură dată asocierile migrate și corectează-le din fișa obiectelor. Responsabilii șterși de returnările anterioare nu pot fi recuperați automat prin această migrare.

Migrarea automată este pentru SQLite, baza implicită a proiectului. Pentru o bază externă PostgreSQL/MySQL este necesară o migrare separată înainte de pornire.

## Verificări incluse

```bash
cd ~/inventariere/backend
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m pytest -q

cd ~/inventariere/frontend
npm run build
```

Testele folosesc baze temporare și nu modifică inventarul personal. Acoperă separarea rolurilor, ciclul împrumut/returnare, schimbarea responsabilului în timpul împrumutului, validările, dezactivarea, protecția autentificării și migrarea repetată a unei baze vechi.
