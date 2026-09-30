from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from wb_calculator.router import router as wb_calculator_router

app: FastAPI = FastAPI(
    title="Knysh.com WB Unit Economics API",
    description="Backend for Wildberries unit economics calculator (Belarus sellers shipping to Russia).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(wb_calculator_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
