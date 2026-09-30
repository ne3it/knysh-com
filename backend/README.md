# WB Unit Economics Calculator Backend

FastAPI service for calculating Wildberries unit economics for Belarusian sellers shipping to Russia.

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
source .venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## API

### POST /api/v1/calculate-wb-unit

Calculates recommended retail price (РРЦ) for Wildberries with:
- Logistics costs (Russia-Belarus transit)
- Currency conversion (BYN ↔ RUB via NBRB API)
- Commission and tax (6% НДС)
- Buyout rate adjustment
- ROI calculation

See `schemas.py` for full request/response schema.
