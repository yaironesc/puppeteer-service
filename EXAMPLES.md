# Ejemplos de Uso del Servicio Puppeteer

Este servicio Puppeteer puede usarse para hacer scraping de **cualquier sitio web**, no solo Play Store.

## Endpoints Disponibles

### 1. `/scrape` - Scraping de Play Store (específico)
Ya implementado para Play Store.

### 2. `/scrape-generic` - Scraping genérico de cualquier sitio

**Ejemplo: Scraping de Amazon**

```bash
curl -X POST https://puppeteer.yersofts.uno/scrape-generic \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.amazon.com/dp/B08N5WRWNW",
    "selectors": {
      "title": "#productTitle",
      "price": ".a-price-whole",
      "rating": ".a-icon-alt",
      "description": "#feature-bullets ul"
    },
    "waitForSelector": "#productTitle"
  }'
```

**Ejemplo: Scraping de una página de noticias**

```bash
curl -X POST https://puppeteer.yersofts.uno/scrape-generic \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "selectors": {
      "title": "h1",
      "author": [".author", "[itemprop=author]"],
      "date": ".date",
      "content": ".article-content"
    },
    "extractImages": true,
    "extractLinks": true
  }'
```

**Ejemplo: Scraping de un producto de tienda**

```bash
curl -X POST https://puppeteer.yersofts.uno/scrape-generic \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tienda.com/producto/123",
    "selectors": {
      "name": "h1.product-title",
      "price": {
        "selector": ".price",
        "attribute": "data-price"
      },
      "description": {
        "selector": ".product-description",
        "html": true
      },
      "images": ".product-gallery img"
    }
  }'
```

### 3. `/screenshot` - Capturar screenshot de cualquier página

```bash
curl -X POST https://puppeteer.yersofts.uno/screenshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fullPage": true,
    "width": 1920,
    "height": 1080
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "screenshot": "data:image/png;base64,iVBORw0KG...",
  "url": "https://example.com"
}
```

### 4. `/pdf` - Generar PDF de cualquier página

```bash
curl -X POST https://puppeteer.yersofts.uno/pdf \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/article",
    "format": "A4"
  }' \
  --output article.pdf
```

## Casos de Uso Comunes

### 1. Scraping de E-commerce
- Amazon, MercadoLibre, eBay
- Precios, descripciones, imágenes
- Stock y disponibilidad

### 2. Scraping de Noticias
- Artículos completos
- Metadatos (autor, fecha, categoría)
- Imágenes y enlaces

### 3. Scraping de Redes Sociales
- Perfiles públicos
- Posts y comentarios
- Estadísticas públicas

### 4. Scraping de Portales de Trabajo
- Ofertas de empleo
- Requisitos y salarios
- Empresas

### 5. Monitoreo de Precios
- Comparar precios entre sitios
- Alertas de cambios
- Historial de precios

### 6. Generación de Screenshots
- Previews de sitios web
- Documentación visual
- Reportes con imágenes

### 7. Generación de PDFs
- Convertir artículos a PDF
- Generar reportes
- Archivar contenido web

## Uso desde PHP

```php
// Scraping genérico
function scrape_website($url, $selectors) {
    $puppeteer_url = 'https://puppeteer.yersofts.uno';
    
    $ch = curl_init($puppeteer_url . '/scrape-generic');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'url' => $url,
        'selectors' => $selectors,
        'extractImages' => true
    ]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Ejemplo de uso
$data = scrape_website('https://example.com/product', [
    'title' => 'h1',
    'price' => '.price',
    'description' => '.description'
]);
```

## Selectores Avanzados

### Selector simple:
```json
"title": "h1"
```

### Múltiples selectores (intenta cada uno):
```json
"title": ["h1", ".title", "[itemprop=name]"]
```

### Selector con opciones:
```json
"image": {
  "selector": "img.product-image",
  "attribute": "src"
}
```

### Obtener HTML completo:
```json
"content": {
  "selector": ".article-body",
  "html": true
}
```

## Notas Importantes

1. **Rate Limiting**: No hagas demasiadas solicitudes seguidas
2. **Legalidad**: Respeta los términos de servicio de cada sitio
3. **Robots.txt**: Verifica si el sitio permite scraping
4. **Timeouts**: Algunos sitios pueden tardar en cargar
5. **CAPTCHAs**: Algunos sitios pueden mostrar CAPTCHAs

## Mejores Prácticas

- Usa selectores específicos para mejor precisión
- Espera a que el contenido se cargue (`waitForSelector`)
- Extrae solo los datos que necesitas
- Maneja errores apropiadamente
- Respeta los límites de rate

