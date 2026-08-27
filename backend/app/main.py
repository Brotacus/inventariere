from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routes import devices, locations, loans, logs, people

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Inventory API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices.router)
app.include_router(people.router)
app.include_router(locations.router)
app.include_router(loans.router)
app.include_router(logs.router)


@app.get("/")
def home():
    return {
        "message": "Inventory API works",
        "docs": "/docs"
    }
