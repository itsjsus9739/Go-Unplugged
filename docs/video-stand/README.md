# Video para el stand (47 s, 1920×1080, 30 fps)

`go-unplugged-stand.mp4`: video en bucle para la pantalla del stand. Todo el mensaje está en texto, así que funciona sin sonido.

| Tiempo | Escena |
|---|---|
| 0–5 s | Contador con anillo 15:00 → 00:00 (golpe y sacudida), toques en «Ignorar límite»: «Te pones un límite. Y te lo saltas tú mismo.» |
| 5–9 s | Barrido índigo: «La fuerza de voluntad no basta.» |
| 9–21 s | Cómo funciona: la petición viaja al teléfono del socio y la aprobación vuelve (capturas reales de la app) |
| 21–33 s | Planes con precios que suben contando: Gratis, Individual 4,99, Pareja 7,99 (destacado), Familiar 12,99 USD/mes |
| 33–40 s | Pago: 7 días gratis, suscripción mensual con Google Play, cancela cuando quieras |
| 40–47 s | Cierre: logo, «Recupera tu tiempo, juntos.», «Pruébalo aquí en el stand» |

Música: 124 BPM, sincronizada con la animación (tic-tac del contador, golpe en el 00:00, sonidos de notificación y aprobación, transiciones).

⚠️ Los precios son **ilustrativos** y el **pago con Google Play aún no está integrado** (hoy solo existe la prueba gratis de 7 días). Ajustar el texto de la escena 5 si se presenta antes de integrarlo.

## Regenerarlo

Fuente en `fuente/`: `index.html` (animación determinista, función `render(t)`), `render-stand.js` (Playwright, cuadro por cuadro a 25 fps) y `music.py` (música sintetizada con NumPy, sin pistas de terceros).

```bash
cd docs/video-stand/fuente
mkdir -p frames && node render-stand.js "$PWD" "$PWD/frames" full
python3 music.py musica.wav
ffmpeg -framerate 30 -i frames/f%05d.jpg -i musica.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -shortest ../go-unplugged-stand.mp4
```

Fuentes tipográficas: Poppins e Inter (SIL Open Font License 1.1).
