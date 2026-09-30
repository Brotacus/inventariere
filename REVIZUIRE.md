# Revizuire și finisare — 30 septembrie 2026

Sursele din această distribuție continuă versiunea cu catalog public și administrare separată. Arhiva include build-ul frontend și instrucțiunile, fără date, fotografii, parole sau sesiuni de test.

## Corecții de funcționalitate și securitate

- Validări pentru câmpuri, stări și valori nule; erorile nu mai expun corpul cererii sau parolele. Parolele și codurile cu diacritice funcționează, iar Unicode invalid primește un răspuns controlat.
- `ADMIN_PASSWORD` este obligatorie pentru autentificare. Codul de resetare nu mai poate fi folosit ca parolă. Sesiunile și evidența încercărilor de login au expirare și limite de memorie; logout-ul și schimbarea parolei invalidează accesul. Operațiile aflate în așteptare reverifică sesiunea înainte de execuție.
- Cererile sunt limitate înainte de parsarea JSON/multipart: 64 KiB în general, 82 MiB pentru încărcarea a până la 10 fotografii. Login-ul public incomplet nu mai poate bloca operațiile administrative prin blocarea globală.
- Fotografiile sunt decodate și recodate ca PNG/JPEG/WebP, cu limite de dimensiune și pixeli. Sunt eliminate metadatele EXIF și datele adăugate după imagine; fișierele corupte și animate sunt respinse. Accesul public servește doar fotografii raster înregistrate, din căi controlate. Încărcările eșuate își curăță fișierele.
- Codurile și ID-urile nu se reutilizează după ștergere/resetare. Tranzacțiile SQLite și verificările atomice împiedică împrumuturile duble și modificările care încalcă relațiile dintre persoane, obiecte și locații.
- Backup verificat pentru baza SQLite și fotografii; resetarea refuză execuția fără copie și restaurează fotografiile dacă tranzacția eșuează.
- QR-ul este afișat ca imagine, iar eticheta tipărită folosește valori HTML escapate și fereastră fără acces la opener. Adresele QR nu acceptă credențiale, căi sau fragmente.
- Emailurile escapează datele introduse, iar autentificarea SMTP cu parolă este refuzată fără TLS/SSL.
- CORS configurabil cu origini exacte; documentația API dezactivată implicit; antete de securitate și interzicerea cache-ului pentru API. Configurația exemplu pentru hosting adaugă antete și pe paginile frontend.

## Interfață și animații

- Previzualizarea fotografiilor funcționează inclusiv în React StrictMode, fără URL-uri revocate prematur. Selectarea fișierelor validează imediat dimensiunea și tipul.
- Formularul și fișa obiectului protejează operațiile în curs împotriva apăsărilor repetate; datele întârziate nu suprascriu selecția curentă. Paginile administrative au stări explicite de încărcare, eroare și reîncercare.
- Erorile temporare de rețea nu șterg sesiunea salvată; verificarea accesului poate fi reluată. Storage-ul blocat permite o sesiune temporară în memorie. Un răspuns 401 întârziat al unei sesiuni vechi nu deconectează sesiunea nouă.
- Catalogul restaurează filtrele la Back/Forward, corectează paginile care depășesc rezultatele și mută focusul spre rezultate după paginare. Cererile anulate nu afișează erori false de conexiune.
- Dialogul de resetare rămâne fixat față de fereastră: animația paginii nu mai păstrează un transform care deplasa dialogul. Tranzițiile sunt discrete; mișcarea redusă dezactivează animațiile și deplasările animate.
- Controale mai lizibile, zone de apăsare de 44 px, focus vizibil, hover limitat la pointer precis și notificări încadrate pe ecrane de 320/390 px. Datele fără offset sunt interpretate corect ca UTC.
- Indicatorul conexiunii reflectă cererile reale. Un modul administrativ care nu poate fi încărcat afișează un ecran de recuperare.

## Verificare

- 44 teste backend și 8 teste frontend trecute; build de producție reușit.
- Audit `npm audit`: zero vulnerabilități raportate. Audit `pip-audit` pe cerințele backend: fără vulnerabilități cunoscute raportate la data verificării. Versiunile directe Python sunt fixate, iar dependențele frontend folosesc lockfile-uri. Un audit al dependențelor nu garantează absența tuturor vulnerabilităților.
- Browser Edge: catalog/QR, izolare public/admin, login/logout, sesiuni, erori/reîncercare, filtre și paginare, tastatură/dialoguri, notificări, teme și lățimi mobile. Au fost verificate și fotografiile, operațiile pentru persoane/locații/obiecte și împrumut/retur.
- Backup-ul a fost deschis, verificat CRC și restaurat în teste: înregistrările și octeții fotografiilor corespund. Testele simulează refuzul backup-ului și eșecul tranzacției de resetare.

Pornire, actualizare și recuperare: [CATALOG_SI_INSTALARE.md](CATALOG_SI_INSTALARE.md). Producția necesită HTTPS, configurarea originilor și un singur worker backend. Nu a fost efectuat deploy.

Exemplul de hosting urmează [modelele SPA Caddy](https://caddyserver.com/docs/caddyfile/patterns#single-page-apps-spas) și [limita request_body](https://caddyserver.com/docs/caddyfile/directives/request_body). Domeniul și căile trebuie adaptate și configurația validată în mediul de hosting.
