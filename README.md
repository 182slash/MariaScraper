# Web Scraping API

Production-oriented FastAPI service for scraping clinic websites and returning a normalized JSON payload with scraped and predicted fields.

## Stack

- FastAPI
- Playwright (headless Chromium) for JavaScript-rendered sites
- BeautifulSoup + lxml fallback for static HTML
- SQLite for history and domain rate limiting

## Endpoints

- `POST /api/scrape`
- `GET /api/health`
- `GET /api/history`

## Request

```json
{
  "url": "https://example.com"
}
```

## Response shape

The API returns:

- `success`
- `url`
- `clinic_type`
- `scraped_at`
- `data`
- `predictions_log`
- `scrape_summary`

Each leaf field in `data` uses:

```json
{
  "value": 123,
  "source": "scraped",
  "confidence": 0.91,
  "unit": "IDR"
}
```

When a field cannot be scraped, the service fills it using a deterministic baseline or formula and marks it as `source: predicted`.

## Local setup

```bash
cd web_scrape_api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
uvicorn main:app --reload --port 8080
```

## DigitalOcean App Platform

### Recommended deploy settings

- **Type:** Web Service
- **Runtime:** Python
- **Build command:**
  ```bash
  pip install -r requirements.txt && python -m playwright install chromium
  ```
- **Run command:**
  ```bash
  uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
  ```

### Notes

- `main.py` exists at repo root so DO can detect the entrypoint.
- `Procfile` is included as a fallback.
- SQLite history is stored in `scraper_history.sqlite3` in the app filesystem.
  For persistent history on production, attach a volume or external database.
- Rate limiting is enforced per domain at 1 request per 10 seconds.

## Example cURL

```bash
curl -X POST http://localhost:8080/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```
