# Catalog public și proiect actualizat

Revizuirea completă din 30 septembrie 2026 este descrisă în [REVIZUIRE.md](REVIZUIRE.md).

## Pornire rapidă pe Windows

Necesită Python 3.10+ și Node.js 22.12+ (sau 20.19+).

1. Dezarhivează întregul folder `inventariere`.
2. Copiază `backend/.env.example` în `backend/.env` și completează `ADMIN_PASSWORD`. Opțional, setează separat `ADMIN_CLEAR_CODE` pentru resetarea datelor.
3. Rulează `start_backend.bat`, apoi `start_frontend.bat`. Lasă ambele ferestre deschise.
4. Administrare: `http://localhost:5173/admin`. Catalog public: `http://localhost:5173/catalog`.

Scripturile instalează dependențele. Adresa principală `/` deschide catalogul public. Administrarea se accesează explicit la `/admin` și necesită parola configurată. Catalogul și fișele QR nu afișează linkuri, tabele sau acțiuni administrative, inclusiv când browserul are o sesiune de administrator salvată.

## Datele deja înregistrate

Catalogul citește direct tabela de obiecte din baza configurată, fără export, import sau generarea obligatorie a unui QR. Afișează toate obiectele care mai există în inventar, inclusiv stările Retras/Pierdut/Defect. Înregistrările șterse nu pot fi recuperate din catalog.

Arhiva conține proiectul și build-ul frontend, dar nu include o bază de date de producție, fotografii private sau parole: acestea nu sunt disponibile în repository-ul public. Nici datele fictive folosite la teste nu sunt incluse.

Pentru actualizarea unei instalări existente:

- Fă un backup al bazei și al folderului `backend/uploads` înainte de actualizare.
- Păstrează `backend/.env`, baza `backend/inventory.db` (sau baza indicată de `DATABASE_URL`) și folderul `backend/uploads` din instalarea ta.
- Folosește sursele noi cu aceleași date/configurări. Oprește backend-ul înainte de copierea fișierelor bazei SQLite; folosește preferabil funcția de backup a aplicației.
- Nu porni două backend-uri simultan pe același port.

## Catalog și QR

- `/` și `/catalog`: listă cu fotografii, coduri, categorii, stări și locații; căutare după nume, cod și serie; filtre combinate; sortare și paginare cu 24 de obiecte/pagină.
- `/catalog/DEV-00001`: fișa publică a obiectului, disponibilă chiar dacă obiectul nu are QR.
- `/asset/<token>`: codurile QR existente continuă să deschidă fișa obiectului. Fișa are acum navigare către catalog.
- `/admin`: autentificare și spațiu administrativ separat. Paginile administrative sunt încărcate într-un modul separat doar pe această rută.
- Adresele necunoscute deschid o pagină publică „Pagina nu a fost găsită”, cu revenire la catalog.
- Catalogul poate fi deschis din ecranul de autentificare și din meniul administrativ; zona publică nu are link către administrare.
- Se actualizează la deschiderea paginii, schimbarea filtrelor, revenirea în fereastră sau apăsarea butonului Actualizează. Nu este un flux push în timp real.
- Căutarea tratează `%` și `_` literal. Nu elimină diacriticele.

Datele publice sunt aceleași ca în fișa QR: identificare, descriere, fotografie, stare și locație. Persoanele, contactele, împrumuturile și istoricul administrativ nu sunt returnate de API-ul catalogului.

**Revocarea unui QR invalidează acel link; nu ascunde obiectul din catalog.** Catalogul include intenționat toate obiectele. Descrierile și locațiile introduse în inventar sunt, prin urmare, vizibile public.

## Acces de pe telefon

Telefonul și calculatorul trebuie să se poată accesa în rețea. Scripturile pornesc frontend-ul și backend-ul pe interfețele de rețea. Folosește `http://IP-CALCULATOR:5173/catalog`, iar pentru etichete setează aceeași adresă de bază în administrare. `localhost` pe telefon indică telefonul, nu calculatorul. Porturile 5173 și 8000 trebuie să fie accesibile în firewall.

Frontend-ul folosește implicit protocolul și gazda paginii, cu portul 8000 pentru API. Pentru altă adresă, copiază `frontend/.env.example` în `frontend/.env`, setează `VITE_API_URL` fără slash final și reconstruiește frontend-ul.

## Comenzi manuale

Backend, din folderul `backend`:

```text
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend, din `frontend` sau din rădăcina proiectului:

```text
npm ci
npm run dev
npm run build
```

Ambele variante folosesc acum aceeași aplicație din `frontend`, iar build-ul este scris în `frontend/dist`. Arhiva include acest build, realizat cu setările implicite de API. Poți verifica build-ul cu `npm run preview`; acesta este un server de verificare, nu o configurație completă de producție.

Pentru hosting, configurează serverul web să servească `frontend/dist` și să trimită rutele `/admin`, `/catalog`, `/catalog/*` și `/asset/*` către `index.html` (fallback SPA). Configurează adresa publică a API-ului prin `VITE_API_URL`, originile CORS prin `CORS_ALLOWED_ORIGINS` din `backend/.env` și HTTPS. În producție setează `CORS_ALLOW_LAN=false` și păstrează `ENABLE_API_DOCS=false`. Există un exemplu în `deploy/Caddyfile.example`, cu API sub `/api`, limită pentru cereri și antete de securitate. Ajustează domeniul și căile înainte de utilizare; exemplul nu a fost instalat pe un server public.

Backend-ul trebuie pornit cu **un singur worker**. Sesiunile sunt păstrate în memoria procesului, iar operațiile administrative care modifică baza și fotografiile sunt serializate în acel proces. Repornirea backend-ului sau schimbarea parolei invalidează sesiunile. Nu folosi `--reload` în producție și nu expune direct portul backend-ului când folosești un reverse proxy. Separarea paginilor nu face ruta `/admin` inaccesibilă din internet: autentificarea protejează operațiile. Pentru administrare exclusiv locală, restricționează atât `/admin`, cât și endpoint-urile API administrative prin proxy/VPN.

## Backup și recuperare

Butonul de backup creează pe server o arhivă ZIP verificată, cu `inventory.db`, `uploads/` și `manifest.json`, în `BACKUP_DIR` sau în `backups` lângă baza SQLite. Nu descarcă automat arhiva în browser. Resetarea refuză ștergerea dacă această copie completă nu poate fi creată. Fotografiile sunt retrase temporar și restaurate dacă tranzacția bazei eșuează; o curățare incompletă după succes este raportată în interfață. ID-urile și codurile obiectelor rămân crescătoare după resetare.

Pentru recuperare: oprește backend-ul, păstrează separat starea curentă și extrage backup-ul într-un folder separat. Înlocuiește baza configurată cu `inventory.db` din copie și întregul folder configurat prin `UPLOAD_DIR` cu `uploads/` din aceeași copie. Păstrează `.env`. După oprirea tuturor proceselor care folosesc baza, elimină eventualele fișiere `-wal` și `-shm` rămase lângă baza înlocuită; acestea nu trebuie amestecate cu snapshot-ul restaurat. Repornește un singur backend și verifică obiectele și fotografiile. Backup/reset sunt suportate pentru SQLite; pentru alte baze, aceste operații refuză execuția. Copiile trebuie păstrate într-un loc privat și copiate periodic pe alt suport.

## Separarea și finisarea interfeței

- Catalog implicit la `/`, administrare explicită la `/admin`, cu verificarea sesiunii înainte de afișarea datelor.
- Catalogul păstrează cardurile și paginarea montate în timpul actualizării; erorile afișează un mesaj și Reîncearcă fără să elimine ultimele rezultate încărcate.
- Colțuri și butoane publice consecvente, zone de apăsare de minimum 44 px, focus vizibil și fotografii afișate integral.
- Tranziții discrete pentru imagini și stări; hover pe dispozitive cu pointer precis. Preferința de mișcare redusă oprește animațiile și deplasările animate în ambele zone.
- Navigare rapidă cu săgeți și Enter; dialogurile și meniul mobil rețin focusul și se închid cu Escape, apoi restabilesc focusul.
- Meniul mobil închis nu primește focus. Notificările au buton de închidere și sunt accesibile pe telefon.
- Operațiile pentru persoane, locații, împrumuturi, ștergerea obiectelor și resetare au protecție împotriva trimiterilor repetate în timpul cererii.
- Anularea resetării elimină codul și confirmarea introduse; redeschiderea cere o nouă confirmare.

## Corecții incluse

- Pornirea/build-ul din rădăcină folosește folderul frontend corect; lockfile-ul rădăcinii este sincronizat.
- Ștergerea obiectelor fără istoric de împrumut nu mai eșuează din cauza cheilor străine din loguri; logurile sunt păstrate, iar legăturile QR sunt curățate. Protecția obiectelor cu istoric de împrumut rămâne activă.
- Paginile publice nu mai verifică sesiunea și nu mai cer inventarul administrativ când există o sesiune salvată.
- Fișele nu păstrează date vechi după o eroare de încărcare; există Reîncearcă și acces înapoi la catalog.
- Imaginile lipsă sau eșuate au înlocuitor vizual, iar fotografiile se afișează integral.
- Texte mai lizibile, controale accesibile, focus vizibil, împărțirea textelor lungi și layout pentru telefon, în ambele teme.
- Linkurile malformate nu mai provoacă o excepție de decodare; tema funcționează și când browserul blochează localStorage.
- Testele eliberează conexiunile SQLite înainte de curățare pe Windows.
- Fișierele auxiliare `Zone.Identifier`, cache-urile și fragmentele SQLite WAL/SHM nu sunt incluse în distribuție.

## Verificări efectuate

- 44 teste backend trecute: roluri, împrumuturi, migrare, catalog, autorizare, concurență, imagini, Unicode, limitarea cererilor, backup și recuperare. Testele folosesc baze, fotografii și copii temporare, separate de instalare.
- 8 teste frontend pentru sesiuni, răspunsuri întârziate, anularea cererilor, storage blocat, adrese API, erori și timeout fără repetarea automată a operațiilor.
- Build frontend reușit. În mediul izolat folosit pentru verificare s-a utilizat `npm run build -- --configLoader native` pentru a evita restricția de citire a directoarelor părinte a procesului esbuild.
- Browser Microsoft Edge: 29 obiecte fictive pe două pagini, căutare, filtre, resetare, fișă și revenire, teme, lățimi 320/390 px, QR valid/invalid, eroare API și reîncercare; fără erori JavaScript. Au fost verificate și izolarea modulului administrativ, sesiunile salvate/expirate, logout, focusul dialogurilor, trimiterile repetate, notificările mobile, imagini reușite/eșuate și mișcarea redusă.
- Nu s-a modificat o instalare de producție și nu s-a făcut deploy.

Pentru teste, din `backend`:

```text
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Testele frontend se rulează cu `npm test`, din `frontend` sau din rădăcina proiectului.
