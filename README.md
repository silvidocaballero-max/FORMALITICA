# Formalítica · compratuformacion.com

Web estática que analiza cursos, mentorías y herramientas online con una lista de 20 puntos. Cada análisis termina con una opinión personal.

La publica GitHub Pages desde la rama `main`, carpeta raíz. Cada cambio que se sube aquí aparece en la web al cabo de uno o dos minutos.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `index.html` | Portada |
| `articulos/` | Artículos (no indexable hasta publicar el primero) |
| `formaciones/<nombre>-opiniones/` | Una ficha por formación |
| `herramientas/tradesize-pro/` | Calculadora TradeSize Pro |
| `legal/` | Información legal |
| `img/` | Imágenes de las fichas |
| `og/` | Imágenes para compartir en redes (1200×630) |
| `robots.txt`, `sitemap.xml`, `llms.txt` | Archivos para buscadores y buscadores de IA |

## Añadir una formación

1. Copia la carpeta de una ficha existente y renómbrala a `formaciones/<nombre>-opiniones/`.
2. Cambia en la ficha nueva:
   - el título, la meta descripción, la URL canónica y Open Graph;
   - el H1;
   - los 20 puntos, la opinión y las preguntas frecuentes;
   - los enlaces de afiliado;
   - el JSON-LD.
3. Añade la imagen de la ficha en `img/` y la imagen para redes en `og/`.
4. Añade la tarjeta en la portada:
   - en el muro animado, dos veces (la segunda con `aria-hidden`);
   - en la cuadrícula de formaciones.
5. Añade la URL en `sitemap.xml` y una línea en `llms.txt`.
