# Hackathon Sigma Data Club x Sherpas Wealth — Contexto completo

> Fuente: servidor de Discord del evento, leído el 12/11/2026 a las 13:10 (antes del kick-off).
> Equipo: **APIñados** (Dani, Javi, Nico). Canal privado del equipo: `#apiñados` (vacío por ahora).
> Ampliado el 12/11 a las 18:20 con el README del repo de partida (sección 7). Donde el README y Discord no coinciden, se indica.

---

## 1. Fechas y entregas

| Cuándo | Qué |
|---|---|
| Jue 12/11, 15:00 | Kick-off presencial (edificio 1E, aula 2.3): presentación del evento, de Sherpas y del reto, y clase de introducción al MCP. No es obligatorio, pero sí muy recomendable. |
| **Vie 13/11, 22:00** | **Nota de idea** con `/idea` desde el canal del equipo. |
| 13–18/11 | Desarrollo libre, sin sesiones obligatorias. Mentores de Sherpas disponibles en Discord. |
| **Mié 18/11, 23:59** | **Entrega final** con `/entregar` desde el canal del equipo. |
| Jue 19/11 | Pitches y premios (1E, aula 2.3). Llegada 12:45, pitches 13:00–14:15 (2 min por equipo), deliberación 14:15–14:45. Horario provisional. **Asistencia obligatoria.** |

Reglas de las entregas:
- Se pueden enviar varias veces; cuenta la última.
- Lo que llegue tarde se acepta, pero queda marcado como fuera de plazo con la hora de envío.

### Nota de idea (`/idea`)
- Una página como máximo, en puntos. Es privada: solo la ven los mentores.
- Qué vais a construir y por qué.
- Qué otras ideas valorasteis y descartasteis, y por qué.
- Podéis cambiar de idea después. **Puntúa 10 de 100.**

### Entrega final (`/entregar`)
- Repositorio de GitHub.
- Enlace al MVP funcionando, o instrucciones para ejecutarlo.
- Vídeo demo de 2 minutos (no puntúa).
- Explicación breve de qué habéis construido y por qué, **en inglés**.
- Ya **no** hay que entregar slides (cambio anunciado el 11/11).

---

## 2. El reto: "Bring the plan to life"

### Contexto
Sherpas es una plataforma de IA para asesores financieros en EE. UU. Con cada cliente nuevo, el asesor hace tres trabajos:
1. Recoger los datos.
2. Hacer los números, es decir, convertirlos en un plan.
3. Explicar el plan.

Sherpas ya automatiza los dos primeros: pasa de un cuestionario y unos documentos a un plan completo en minutos. El tercero sigue haciéndose a mano, reunión a reunión.

Un plan que se envía sin más, aunque sea bueno, tiene varios problemas:
- Es demasiada información de golpe.
- Usa un lenguaje nuevo para la familia.
- Solo tiene unos diez segundos para captar la atención.
- No hay nadie al lado para volver a explicarlo.

### El reto
Hacer que el plan cobre vida: llevar a una familia desde su plan hasta entenderlo y querer actuar, como si tuviera un asesor en la sala, o mejor.

Hay dos públicos posibles:
- **Familias que verán a un asesor más adelante**: llegan a la reunión entendiendo ya su plan.
- **Familias que nunca lo verán**: el plan tiene que funcionar solo.

### Cómo es una buena solución
- **Engancha**: capta la atención en segundos y la mantiene.
- **Se entiende**: funciona tanto para alguien que no sabe de finanzas como para un experto.
- **Es para ellos**: es personal para esta familia y para cada persona de ella.
- **Mueve a actuar**: quieren dar el primer paso y vuelven hasta darlo.
- **Extra**: acompaña los días de después, cuando llegan las dudas el día 3 o el día 30.

Restricciones y avisos explícitos:
- Vale cualquier formato, canal o dispositivo.
- ⚠️ **Sherpas ya tiene tours guiados y un chat sobre el plan.** Una idea que sea solo eso puntúa bajo en creatividad.
- ⚠️ **Clavar cada cifra no puntúa.** Hay que usar los datos del caso, no inventar números y dedicar el tiempo a la experiencia.

### Rúbrica (100 puntos)
| Criterio | Puntos |
|---|---|
| Engancha | 20 |
| Se entiende | 20 |
| Mueve a actuar | 20 |
| Personal | 15 |
| Creatividad | 15 |
| Nota de idea del viernes | 10 |

Evalúan los mentores de Sherpas.

### Premios
- 1.º: 600 €
- 2.º: 250 €
- 3.º: 150 €
- Prácticas en Sherpas para los equipos que destaquen.

### Idioma
- **Producto, demo y explicación: en inglés**, porque Sherpas trabaja con clientes en EE. UU.
- La comunicación del evento es en español.

---

## 3. Los cuatro casos

Son familias ficticias pero fieles a la realidad. Todos los equipos tienen las cuatro.

| Familia | Nota | Pregunta central |
|---|---|---|
| Timothy y Melanie Weah | 60 | Tienen mucho efectivo y, a la vez, una tarjeta de crédito cara. ¿A dónde debe ir cada dólar? |
| Michael Carter | 26 | Quiere una casa de $550.000 en 2027 y jubilarse a los 58. ¿Puede con las dos cosas? |
| Daniel y Emily Johnson | 52 | La universidad de sus dos hijos y jubilarse a los 62. ¿Qué va primero? |
| Samantha Lewis | 82 | Sin deudas y bien asegurada; empiezan las facturas de la universidad y quiere una segunda casa en 2030. ¿Y ahora qué? |

---

## 4. Recursos técnicos

### Acceso personal
En https://mcp-hackathon.sherpaswealth.com/personal-token se entra con el correo de inscripción. Llega un código de 6 dígitos desde hackathon@sherpaswealth.com (si no aparece, mirar en spam).

La página muestra:
- El equipo.
- **La clave de IA del equipo.** Es la misma para todos y tiene $50 para todo el equipo, compartidos entre todos los modelos.
- **El token del MCP.** Es personal y dura **72 h**. Si pides otro, el anterior deja de funcionar.
- Un bloque `.env` listo para copiar en el backend.

### MCP de casos
- URL: `https://mcp-hackathon.sherpaswealth.com/mcp`
- Es de solo lectura, requiere login y contiene los cuatro casos con sus planes.
- Qué es un MCP: https://modelcontextprotocol.io/

### Modelos de IA
API compatible con OpenAI en `https://llm-hackathon.sherpaswealth.com/v1`, con la clave del equipo.

| Tipo | Modelos |
|---|---|
| Voz en tiempo real | `gpt-live-1`, `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`, `gemini-3.8-live` |
| Texto | `deepseek-flash`, `gemini-3.5-flash-lite`, `gpt-5-mini` |
| TTS / STT (ElevenLabs) | `eleven-flash-v2.5`, `eleven-multilingual-v2`, `eleven-v3`, `scribe-v2` (como máximo $1,40 de los $50) |

Límites:
- 60 peticiones por minuto y 4 simultáneas.
- Cuando se acaba el saldo, se acaba. Hay que **desarrollar con modelos baratos y guardar los caros para la demo.**

### Repo de partida
https://github.com/SherpasEngineering/hackathon-upv-2026 — contiene los casos y un pequeño ejemplo de voz.

### Extras opcionales
- ElevenLabs: 3 meses gratis de sus planes de pago para universitarios de la UE → https://elevenlabs.io/students
- GitHub Student Developer Pack con el correo de la UPV, que incluye Azure for Students (unos $100 sin tarjeta) → https://education.github.com/pack

Se puede usar **cualquier** stack, API, librería, modelo o dispositivo.

---

## 5. Normas que afectan al desarrollo

- **Confidencialidad**: el MCP, la API y los diagnósticos son solo para el hackathon.
  - No compartir la clave del equipo, el token ni los datos fuera del equipo.
  - **Nunca en repos públicos**: usar `.env` y `.gitignore`.
  - Las claves van **solo en el backend**, nunca en código que se ejecute en el navegador.
- **Créditos**: si la clave se usa para otra cosa o se comparte, el equipo pierde el acceso.
- **Juego limpio**: el trabajo debe hacerse durante el hackathon y por los miembros del equipo.
- ⚠️ **Propiedad del código: el código que desarrolléis durante el hackathon será propiedad de Sherpas Wealth.**
- No cambiarse el nombre en el servidor, porque lo asigna el bot.

---

## 6. Canales de soporte

- `#dudas-reto-mcp` (foro): dudas sobre el reto, el MCP y los créditos. Responden los mentores de Sherpas. Etiquetas: MCP, API, Entregable, Modelos / créditos.
- `#dudas-evento` (foro): dudas sobre el evento. Responde la organización de Sigma. Etiquetas: Equipos, Fechas, Entregas, Otros.
- `#presentate`: el equipo de Sherpas lo revisa **buscando perfiles para prácticas**. Se permite un solo mensaje por persona, con esta plantilla:
  - Nombre
  - Estudios y curso
  - Qué se me da bien
  - LinkedIn / GitHub
  - ¿Busco equipo?

Estado a las 13:10: los foros, `#general`, `#showcase`, `#off-topic` y `#apiñados` están vacíos.

---

## 7. Ampliación desde el README del repo (https://github.com/SherpasEngineering/hackathon-upv-2026)

### Discrepancias con Discord (confirmar)
| Tema | Discord | README | Qué hacer |
|---|---|---|---|
| Comando de entrega | `/idea` y `/entregar` (anuncio del 11/11) | `/entrega` | Seguir Discord, que es más reciente, y comprobar en `#apiñados` qué comandos aparecen. |
| Repo | No subir claves ni datos a repos públicos | El repo **debe ser público** | Público, pero sin claves (`.env` en `.gitignore`). Los datos de los casos ya son públicos en el repo de Sherpas. |
| Explicación final | Un párrafo | De media página a una página | Hacer media página o una, que cumple las dos. |

### Montaje del repo
- Una persona del equipo pulsa **Use this template → Create a new repository**, en su propia cuenta y como **Public**.
- Después, en Settings → Collaborators, añade a los demás.
- Se puede usar cualquier lenguaje, framework o estructura, pero hay que mantener un README con qué habéis construido y cómo ejecutarlo.
- Contenido del template:
  - `cases/`
  - `examples/voice/`
  - `assets/`
  - un `.gitignore` que ya excluye `.env`

### Cómo reciben hoy el plan
1. Sherpas genera un plan online con resumen, recomendaciones y proyecciones.
2. Días o semanas después, el asesor lo explica en una reunión compartiendo pantalla.

Los asesores preferirían dedicar ese tiempo a las preguntas, miedos y decisiones de la familia. La experiencia que construyáis puede ayudar **antes, durante o después** de esa conversación.

### Dónde se atascan las familias (puntos de partida, no soluciones; se pueden combinar)
- **Entender**
  - No ven cómo una decisión de hoy cambia su vida años después. Ejemplo: Michael no sabe si comprar casa en 2027 le deja jubilarse a los 58.
  - Las cifras grandes no dicen si algo está bien o mal. Ejemplo: a los Weah les dicen "$2.37M al final del plan, en dólares de hoy" y no saben qué significa.
  - Una buena nota puede esconder un problema grave. Ejemplo: Samantha tiene 82 ("strong"), pero sus ahorros se agotan a los **73**.
  - El plan responde a lo que puede calcular, no a la preocupación que les quita el sueño, que nadie les ha preguntado.
- **Atención**: los Weah, con dos trabajos y niños de 6 y 3 años, solo pueden mirarlo a ratos y casi siempre en el **móvil**.
- **Emoción**
  - Las malas noticias hacen apartar la vista: el plan de Michael abre con un 26 "critical".
  - La muerte y la vejez se aparcan: Daniel Johnson tiene $250K de seguro de vida frente a los $1.6M+ recomendados, con dos hijos.
- **Pareja**: es un plan para dos personas. Timothy acepta más riesgo que Melanie, y no pasa nada hasta que los dos están de acuerdo.
- **Momento y seguimiento**
  - Las dudas llegan cuando no hay nadie para responder, y a la semana de la reunión ya se ha olvidado casi todo.
  - El plan llega en su fecha, no en los momentos en que actuarían. Ejemplo: Samantha paga la universidad cada agosto y compra casa en 2030.
- **Acción**: demasiadas opciones buenas y ningún primer paso.
  - Los Weah tienen efectivo de sobra, una tarjeta al 18 %, les falta seguro de vida y no ahorran para la universidad, y el plan les deja a ellos decidir el orden.
  - Aunque elijan, no saben cómo hacerlo, y nada les recuerda ni les muestra que ha funcionado.

### Detalle de los casos
| Familia | Datos |
|---|---|
| Weah (60) | 40 y 38 años, Liam (6) y Josh (3). Tarjeta de $18K al 18 % y préstamo de estudios de $15K. $150K en efectivo, 401(k), Roth, cuenta de brokerage, casa de $350K. San Francisco. |
| Carter (26) | 37 años, salario de $180K, vive de alquiler. Austin. |
| Johnson (52) | 44 y 42 años, hijos Oliver y Sophia. Hipoteca de $560K, tarjeta de $18K al 24,9 %. Quieren jubilarse a los 62 y 60. Denver. |
| Lewis (82) | 47 años, dos adolescentes, salario de $250K, life + umbrella cover. Miami. |

Cada caso tiene un enlace **"Open the plan"** que muestra el plan en la app de Sherpas tal como lo ve el cliente: el consejo, el *living map* y el análisis de inversión. Es de solo lectura y no pide login. Sirve como referencia de lo que ya existe.

### Archivos por familia (`cases/<id>/`)
- `financial-health.json`: quiénes son, la nota y su porqué, el perfil, cifras y métricas, el análisis escrito y la **proyección anual**.
- `investment-analysis.json`: cuentas, posiciones, métricas y el análisis de inversión.
- `persona.md`: secciones D0–D6 (nivel de patrimonio, etapa vital, complejidad, gravedad de los gaps, **riesgo**, **estilo de decisión**, **motivaciones**), alertas de transición, preocupaciones subjetivas y objetivas (O1, O2…) y **tensiones (T1, T2…)**. Es la clave para el criterio "Personal".
- `report.pdf`: lo tienen los Weah, Carter y los Johnson. **Samantha no tiene PDF.**
- Todos los importes están en USD.

### MCP
- Expone dos herramientas: `list_cases` y `get_case`.
- `get_case` recibe `caseId`, `part` (`financial-health` | `investment-analysis` | `persona`) y opcionalmente `section` (p. ej. `narrative`, `score`, `D4`, `Tensions`).
- Las partes pueden tener decenas de miles de tokens, así que hay que **pedir solo las secciones necesarias**.
- Desde código, el token va en la cabecera `Authorization: Bearer <MCP_TOKEN>`.
- **Todos los datos están también en `cases/`, así que se puede construir sin MCP.**
- Para conectarlo a Claude Code: `claude mcp add --transport http sherpas-cases https://mcp-hackathon.sherpaswealth.com/mcp`, y después `/mcp` para autenticarse con el email.

### `.env`
- Variables: `MCP_URL`, `MCP_TOKEN`, `LLM_PROXY_URL=https://llm-hackathon.sherpaswealth.com`, `TEAM_KEY`.
- En los SDK de OpenAI, `base_url` lleva `/v1` al final.
- Los valores nunca van en el código del navegador, ni en capturas, ni en vídeos. Si se filtra uno, hay que avisar a un mentor y lo sustituyen.
- Requisitos: Python 3.10+ con `python-dotenv`, o Node 22+ con `node --env-file=.env`.
- El acceso y los créditos **terminan el 21/11**.
- Cada login genera un MCP token nuevo; la `TEAM_KEY` no cambia.

### Precios (USD por 1M tokens de entrada / salida)
| Modelo | Precio |
|---|---|
| `gpt-5-mini` | $0.25 / $2.00 |
| `deepseek-flash` | $0.30 / $1.20 |
| `gemini-3.5-flash-lite` | $0.30 / $2.50 |
| `gpt-realtime-2.1-mini` | audio $10 / $20 |
| `gpt-realtime-2.1` | audio $32 / $64 |
| `gemini-3.8-live` | audio $3 / $12 |
| **`gpt-live-1`** | **$0.05 por minuto de sesión** (el más barato para voz; usa otro protocolo, WS `/v1/live/sessions`) |
| ElevenLabs | Hasta $1.40 en total. `eleven-flash-v2.5` cuesta $0.04 por 1K caracteres (unos 40 min) y es el recomendado. `scribe-v2` cuesta $0.22 por hora. |

Notas sobre los modelos:
- Endpoints de voz: Realtime y Gemini Live usan WS `/v1/realtime?model=…`; para TTS y STT, `/v1/audio/speech` y `/v1/audio/transcriptions`.
- La voz tiene que pasar por **backend → proxy**. Conectar directamente al proveedor no gasta créditos del hackathon.
- **El gasto de voz se registra al cerrar la sesión**: una sesión larga puede pasarse del saldo. Hay que cerrar siempre las sesiones.
- Una sesión de voz abierta ocupa 1 de las 4 peticiones simultáneas.
- `gpt-5-mini` devuelve vacío si `max_tokens` es menor de 1000, porque el razonamiento se lo come. Mejor omitirlo.
- Gasto del equipo: `curl https://llm-hackathon.sherpaswealth.com/key/info -H "Authorization: Bearer $TEAM_KEY"`, campos `info.spend` e `info.max_budget`.

### Entregas según el README
- **Idea**: de 2 a 3 líneas con qué vais a construir y por qué, más lo que descartasteis y por qué. Conviene enviarla en cuanto la tengáis.
- **Final**:
  1. Repo público.
  2. MVP con enlace o pasos de ejecución en el README.
  3. Vídeo de 2 min como enlace de YouTube oculto o Google Drive (Discord rechaza archivos grandes).
  4. De media página a una página sobre qué habéis construido y por qué.

### Rúbrica: pregunta exacta de cada criterio
| Criterio | Pregunta |
|---|---|
| Captivating | Does it grab their attention, and hold it? |
| Understanding | Would it work for someone new to finance, and for an expert? |
| Motivation to act | Would they want to act, and keep coming back until they do? |
| Personal | Does it feel made for them, and for each of them? |
| **Creativity** | **What did it add that we did not ask for?** |
| Friday plan | A clear choice, and honest about what you ruled out and why? |

- Lo que ya existe (tours guiados y chat sobre el plan) sirve como **punto de partida**, pero hay que ir más allá.
- Premio principal según Sherpas: **prácticas** ("Sherpas is looking for talent").

### No leído
Varios bloques de código del README salieron bloqueados al extraerlos: el ejemplo de leer el MCP desde código y el protocolo de voz. Están en el repo y en `examples/voice/`.
