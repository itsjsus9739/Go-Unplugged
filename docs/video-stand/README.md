# Video para el stand (50 s, 1920×1080)

`go-unplugged-stand.mp4`: video en bucle para la pantalla del stand. Todo el mensaje está en texto, así que funciona sin sonido.

| Tiempo | Escena |
|---|---|
| 0–5 s | Contador 15:00 → 00:00: «Te pones un límite. Y te lo saltas tú mismo.» |
| 5–9 s | «La fuerza de voluntad no basta.» |
| 9–22 s | Cómo funciona: pides tiempo y tu socio lo aprueba (capturas reales de la app) |
| 22–36 s | Planes: Gratis, Individual 4,99, Pareja 7,99 (destacado), Familiar 12,99 USD/mes |
| 36–43 s | Pago: 7 días gratis, suscripción mensual con Google Play, cancela cuando quieras |
| 43–50 s | Cierre: logo, «Recupera tu tiempo, juntos.», «Pruébalo aquí en el stand» |

⚠️ Los precios son **ilustrativos** y el **pago con Google Play aún no está integrado** (hoy solo existe la prueba gratis de 7 días). Ajustar el texto de la escena 5 si se presenta antes de integrarlo.

## Regenerarlo

Fuente en `fuente/`: `index.html` (animación determinista, función `render(t)`), `render-stand.js` (Playwright, cuadro por cuadro a 25 fps) y `music.py` (música sintetizada con NumPy, sin pistas de terceros).

```bash
cd docs/video-stand/fuente
mkdir -p frames && node render-stand.js "$PWD" "$PWD/frames" full
python3 music.py musica.wav
ffmpeg -framerate 25 -i frames/f%05d.jpg -i musica.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest ../go-unplugged-stand.mp4
```

Fuentes tipográficas: Poppins e Inter (SIL Open Font License 1.1).
