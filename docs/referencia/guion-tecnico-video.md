# Guion técnico: video de 20 segundos para YouTube

Go Unplugged · Equipo: Sara Duarte, Jesus Tello y Marco Moreno · UNAB, Taller #3 — Parte II-B

## 1. Ficha del video

| Campo | Detalle |
|---|---|
| Producto | Go Unplugged: control de pantalla con aprobación de un socio de confianza |
| Duración | 20,00 s (tolerancia ±1 s) |
| Formato | 16:9 · 1920×1080 · 30 fps |
| Códec | MP4: H.264 (video) y AAC estéreo (audio) |
| Idioma | Español |
| Plataforma | YouTube |
| Versiones | `promo-20s-editorial.mp4` (versión final, identidad marcada) y `promo-20s-minimalista.mp4` (versión anterior, más simple) |

## 2. Estrategia: una idea y un llamado a la acción

- **Idea principal:** controlar tu tiempo de pantalla solo no funciona; decidirlo con alguien de confianza sí.
- **Público:** personas que quieren reducir su tiempo de pantalla y no lo logran solas.
- **Tono:** directo, cercano y moderno; nunca de vigilancia.
- **Llamado a la acción:** «Empieza gratis» y gounplugged.com.

## 3. Guion por escena (versión editorial — archivo final)

| # | Tiempo | Qué se ve | Texto en pantalla | Audio |
|---|---|---|---|---|
| 1 | 0:00 – 0:04,5 (fondo negro) | Reloj gigante baja de 15:00 a 00:00 y se vuelve magenta. Se pulsa «Ignorar límite» tres veces. | «LÍMITE DIARIO · REDES SOCIALES» / «TIEMPO AGOTADO» / «Te pones un límite.» → «Y te lo saltas tú mismo.» | Pad suave; golpe grave en 00:00 (2,3 s); avisos en cada toque (2,95 / 3,4 / 3,85 s). |
| 2 | 0:04,5 – 0:08,5 (fondo índigo) | Titular en tres líneas; «no basta.» con efecto glitch cian/magenta. | «La fuerza de voluntad no basta.» / «El problema no es saber qué distrae. Es intentar controlarlo solo.» | Entra bombo y bajo; notas suaves por línea. |
| 3 | 0:08,5 – 0:14,5 (fondo negro) | Dos teléfonos: «Tú» pide +15 min, la notificación viaja al socio (9,6–10,9 s), el socio deniega (12,2 s), vuelve «Límite mantenido». | «La decisión sale del teléfono.» → «Alguien de confianza aprueba cada extensión.» | Ritmo completo; golpe al denegar; campanas suaves de confirmación (13,4 s). |
| 4 | 0:14,5 – 0:17,5 (fondo índigo) | Frase de marca en dos líneas; tres pilares abajo. | «Recupera tu tiempo, juntos.» / «UN LÍMITE — UN ACUERDO — MÁS TIEMPO» | Punto de mayor energía. |
| 5 | 0:17,5 – 0:20,0 (fondo negro) | Logo con glitch, botón «Empieza gratis», candado grande. | «Empieza gratis →» / «GOUNPLUGGED.COM» / «Recupera tu tiempo, juntos.» | Acorde final y campanas graves. |

## 4. Diseño y accesibilidad

- **Color:** fondo #08090B; índigo #3B34D0 / #6C64FF; magenta #DA6997 y cian #47CFCB como acentos de *glitch*.
- **Tipografía:** Poppins Bold para titulares, fuente monoespaciada para etiquetas (`01 / 05`, `TIEMPO AGOTADO`, etc.).
- **Sin audio:** todo el mensaje está en texto en pantalla.
- **Sonido:** música original sintetizada por código (sin pistas de terceros), sin frecuencias agudas molestas, con graves y medios predominantes.

## 5. Producción

1. Guion y storyboard (este documento).
2. Animación programática en Python con Skia (gráficos vectoriales 2D) — 600 fotogramas a 1920×1080.
3. Codificación con FFmpeg; audio sintetizado con NumPy (pista de 120 BPM: bombo, palmas, bajo, arpegio).
4. Nota: los scripts de generación (`render2.py`, `music.py`) se usaron durante la sesión de trabajo pero no se conservaron como archivo — si se necesita regenerar o editar el video, hay que recrear el pipeline (Python + skia-python + numpy + ffmpeg) o trabajar directamente sobre el .mp4 con un editor de video convencional.

## 6. Registro de uso de IA y fuentes

| Recurso | Origen | Licencia o nota |
|---|---|---|
| Guion, animación y música | Asistido por IA (Claude, Anthropic) | Declarar en el registro de IA del curso |
| Logo e ícono | Propios del equipo (Go Unplugged) | Sin restricciones externas |
| Tipografía Poppins | Google Fonts | SIL Open Font License 1.1 |
| Audio | Sintetizado por código (NumPy) | No se usó música de terceros |
| Imágenes externas | No se usaron | — |

## 7. Pendientes

- Confirmar que gounplugged.com es la dirección real y activa.
- Si se necesita volver a editar el video, recrear el pipeline de Python descrito arriba o migrar a un editor de video tradicional usando el .mp4 final como referencia.
