# Play Store Scraper Service (Puppeteer)

Servicio Node.js con Puppeteer para hacer scraping de Google Play Store.

## Instalación en Coolify

1. **Crear nuevo recurso en Coolify:**
   - Ve a tu proyecto en Coolify
   - Click en "New Resource"
   - Selecciona "Dockerfile" bajo "Docker Based"

2. **Configurar el servicio:**
   - Nombre: `play-store-scraper` (o el que prefieras)
   - Source: Sube los archivos de esta carpeta o conecta un repositorio Git
   - Puerto: `3000`
   - Variables de entorno (opcional):
     - `PORT=3000`

3. **Desplegar:**
   - Coolify construirá la imagen Docker automáticamente
   - El servicio estará disponible en: `http://play-store-scraper:3000` (dentro de la red Docker)
   - O en la URL pública que Coolify asigne

## Uso desde PHP

El servicio expone un endpoint POST `/scrape` que acepta:

```json
{
  "url": "https://play.google.com/store/apps/details?id=com.tiktok.lite.go&hl=es_MX"
}
```

Y devuelve:

```json
{
  "success": true,
  "data": {
    "name": "TikTok Lite",
    "description": "...",
    "icon_url": "...",
    "screenshot_urls": [...],
    "rating": 4.3,
    "price": 0
  }
}
```

## Endpoints

- `POST /scrape` - Scrape una app de Play Store
- `GET /health` - Health check del servicio

