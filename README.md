> **Versiune cu catalog public:** vezi [CATALOG_SI_INSTALARE.md](CATALOG_SI_INSTALARE.md) pentru pornire, păstrarea datelor existente și schimbările incluse. Catalogul public se deschide la `/` sau `/catalog`, iar administrarea este separată la `/admin`. Fișele QR au navigare doar către catalog.

# Inventory Management System

A full-stack inventory management application designed to keep track of devices, equipment, components, locations, responsible persons, loans and activity history.

The project provides an administrative interface for managing the inventory and public read-only pages that can be accessed through QR codes attached to physical assets.

---

## Features

### Inventory Management

Administrators can:

* Add new inventory items
* Edit existing items
* Delete items
* View detailed information about each item
* Assign categories
* Store serial numbers
* Track item status
* Assign locations
* Assign responsible persons
* Add descriptions and additional information

Each item receives a unique automatically generated code:

```text
DEV-00001
DEV-00002
DEV-00003
...
```

---

### Admin Authentication

The administration interface is protected by an authentication screen.

Admin authentication is required when accessing the administrative part of the application.

Administrative credentials should not be stored in this README or committed publicly to the repository.

---

### Locations

Inventory items can be associated with physical locations.

Examples:

```text
Laboratory
Office
Storage Room
Workshop
Classroom
```

Locations can be created and managed separately from devices.

---

### People

The application can store people responsible for inventory items.

Information can include:

* Name
* Email
* Phone number
* Active status

Devices can then be associated with a responsible person.

---

### Activity Logs

Important inventory operations are recorded in the application.

Logs can be used to track actions such as:

```text
DEVICE_CREATED
DEVICE_UPDATED
DEVICE_DELETED
```

This provides a history of changes made to the inventory.

---

### QR Codes and Labels

Each inventory object can generate a QR code or printable label.

Scanning the QR code opens a dedicated public page for that asset.

The public page is designed for normal users and does not provide administrative controls.

Example:

```text
QR Code
   |
   v
/asset/<public-token>
   |
   v
Public asset information
```

This makes it possible to attach a physical label to equipment and instantly access its information using a phone.

---

### Public Asset Pages

Assets can be viewed through a dedicated read-only page without entering the administration interface.

This is useful for:

* QR labels
* Equipment identification
* Asset verification
* Quick access to technical information

User accounts and additional permission levels can be added in future versions.

---

### Protected Database Reset

During development and testing, administrators can clear the application's stored data.

Because this operation is destructive, it requires a separate security code.

This functionality is intended mainly for development and testing and should be carefully restricted in production.

---

### Persistent Storage

Application data is stored in a database and remains available after the backend or frontend is restarted.

The default development database is SQLite.

```text
inventory.db
```

The backend database layer can also be configured through a `DATABASE_URL`.

---

## Tech Stack

### Backend

* Python
* FastAPI
* SQLAlchemy
* Pydantic
* Uvicorn
* SQLite
* python-dotenv

### Frontend

* React
* Vite
* JavaScript
* HTML
* CSS

### Development Environment

The project can be developed using:

* Ubuntu / WSL
* Windows
* Git
* GitHub
* VS Code

---

## Project Structure

A simplified structure of the project:

```text
inventariere/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   │
│   │   ├── routes/
│   │   │   ├── devices.py
│   │   │   ├── people.py
│   │   │   ├── locations.py
│   │   │   ├── loans.py
│   │   │   └── logs.py
│   │   │
│   │   └── services/
│   │       └── code_generator.py
│   │
│   ├── requirements.txt
│   └── inventory.db
│
├── frontend/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# Installation

## 1. Clone the repository

```bash
git clone git@github.com:Brotacus/inventariere.git
cd inventariere
```

If SSH is not configured, HTTPS can also be used:

```bash
git clone https://github.com/Brotacus/inventariere.git
cd inventariere
```

---

# Backend Setup

Move to the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the API:

```bash
python -m uvicorn app.main:app --reload
```

The backend will normally be available at:

```text
http://127.0.0.1:8000
```

---

## API Documentation

API documentation is disabled by default. For local development only, set
`ENABLE_API_DOCS=true` in `backend/.env` and restart the backend to enable the following URLs.

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

OpenAPI schema:

```text
http://127.0.0.1:8000/openapi.json
```

---

# Frontend Setup

Open another terminal:

```bash
cd ~/inventariere/frontend
```

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Vite will normally start the application at:

```text
http://localhost:5173
```

Use the URL displayed in the terminal if Vite selects another address or port.

---

# Starting the Entire Application

You normally need two terminals.

### Terminal 1 — Backend

```bash
cd ~/inventariere/backend
source .venv/bin/activate
python -m uvicorn app.main:app --reload
```

### Terminal 2 — Frontend

```bash
cd ~/inventariere/frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# Database

The default development configuration uses SQLite:

```text
sqlite:///./inventory.db
```

The database contains information related to:

```text
Devices
People
Locations
Loans
Logs
```

The database connection can be changed using the `DATABASE_URL` environment variable.

Example:

```env
DATABASE_URL=sqlite:///./inventory.db
```

---

# API Overview

The backend is organized into multiple FastAPI routers.

Main resource groups include:

```text
/devices
/people
/locations
/loans
/logs
```

Examples:

```http
GET /devices/
POST /devices/
GET /devices/{id}
PUT /devices/{id}
DELETE /devices/{id}
```

---

# Security

Sensitive information should never be committed directly to the repository.

This includes:

```text
Admin passwords
Reset codes
Secret keys
Database credentials
Authentication tokens
```

These values should preferably be stored using environment variables.

Example:

```env
ADMIN_PASSWORD=your-secret-password
ADMIN_CLEAR_CODE=your-secret-reset-code
```

The real `.env` file should be excluded using `.gitignore`.

A template can instead be committed as:

```text
.env.example
```

---

# QR Inventory Workflow

The intended workflow is:

```text
Create asset
     |
     v
Asset receives unique ID/code
     |
     v
Generate QR code / label
     |
     v
Attach label to physical equipment
     |
     v
Scan QR code
     |
     v
Open public asset page
```

This allows physical inventory and the digital database to remain directly connected.

---

# Planned Improvements

Possible future additions include:

* User accounts
* Multiple permission levels
* Admin/User roles
* Improved loan management
* Automatic return tracking
* More advanced audit history
* Search and filtering
* Inventory statistics
* Dashboard analytics
* CSV / Excel export
* Bulk import
* Barcode support
* Printable label templates
* Equipment maintenance history
* Notifications
* PostgreSQL support
* Deployment to a production server

---

# Project Goal

The goal of the project is to provide a simple and expandable inventory platform capable of managing equipment from a central interface while also allowing fast physical identification through QR codes.

The architecture separates the frontend, backend and database layers so that new modules and functionality can be added as the project grows.

---

## Development

Project developed as an inventory management platform using:

```text
React + FastAPI + SQLAlchemy + SQLite
```

Repository:

```text
github.com/Brotacus/inventariere
```

---

## License

This project is currently intended for educational and internal development purposes.

## Roluri pentru persoane responsabile

Actualizarea separă responsabilitatea obiectelor de împrumuturi. Ghidul complet de instalare, migrare și utilizare este în [INSTALARE_ROLURI.md](INSTALARE_ROLURI.md).
