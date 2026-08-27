# Aplicație Inventariere

Proiect pentru gestionarea și urmărirea obiectelor: plăcuțe, componente, dispozitive și alte echipamente.

## Stack

### Frontend
- React
- Vite

### Backend
- Python
- FastAPI
- SQLAlchemy

### Database
- SQLite pentru dezvoltare
- PostgreSQL poate fi adăugat ulterior

## Funcționalități planificate

- adăugare / editare / ștergere obiecte
- cod unic pentru fiecare obiect
- locație curentă
- persoană responsabilă
- împrumuturi și retururi
- status obiect
- istoric și log-uri
- fotografii
- QR / barcode

## Pornire backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API: http://localhost:8000

Documentație automată FastAPI: http://localhost:8000/docs

## Pornire frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173
