# EXPLICACION.md: guía del proyecto para el Claude de cada compañero

> **Para el Claude que lea esto:** eres el asistente de un miembro del equipo APIñados (Dani, Javi, Nico). Tu trabajo
> es ayudarle a **entender este código y defenderlo en el pitch** del hackathon (jueves 19/11, 2 minutos). Responde en
> español, con claridad, y señala siempre el fichero y la función concretos. **No modifiques código** salvo que tu
> usuario lo pida explícitamente: este zip es una copia para estudiar, no la versión buena (esa está en GitHub, rama
> `main`: https://github.com/daniv14-hub/API-ados-Sherpas-Hackathon). Si algo no está en el código o en `docs/`, dilo:
> no lo inventes.

## 1. Qué hemos construido (en una frase y en cuatro piezas)

**Sherpy**: llevar a una familia desde su plan financiero de Sherpas (que nadie lee) a entenderlo y querer actuar.

1. **Conversación por voz** con Sherpy, la mascota de Sherpas (un yak con traje). No es un formulario: Sherpy rompe el
   hielo, pregunta lo que el plan no sabe (quién está, objetivo principal, preocupación, riesgo de cada uno, si
   prefieren números o lo que significan, cuánto detalle) y **media cuando la pareja no está de acuerdo**.
2. **Vídeo personal** (~2 min) que se **genera en unos 6 segundos** al acabar la conversación: su plan contado como una
   historia (sueño → realidad → huecos → fragilidad → giro → acción → misión), adaptado a su estilo.
3. **Camino de misiones**: cada recomendación del plan se convierte en una misión con pasos pequeños e interactivos
   (barras con sus cifras, apuntar lo que tienen, ordenar prioridades juntos, email ya escrito a RR. HH., marcar lo
   hecho). Cada misión completada es un checkpoint donde la puntuación Sherpas sube **solo con las cifras del plan**.
   Sherpy está siempre a un toque (burbuja de voz) y sabe en qué misión está la familia.
4. **Marca Sherpas**: colores, tipografías y logo oficiales (`assets/brand/`), móvil primero.

## 2. La regla de oro (la pregunta que más nos harán)

**Nunca inventamos cifras.** Todo número que se ve o se oye sale del plan de la familia (`cases/<id>/*.json`).
Cómo lo garantizamos:
- **Sherpy (voz):** sus instrucciones solo contienen cifras del plan y tiene prohibido calcular (`agent/src/instructions.mjs`,
  `SHERPY_RULES`). Si el plan no lo sabe, dice que no lo sabe.
- **Vídeo:** el modelo (gpt-5-mini) solo escribe *palabras*; las cifras entran por `{placeholders}` rellenados desde
  los datos, y cada línea se comprueba (`agent/src/video/narrate.mjs` + `agent/src/numbers.mjs`). Si una línea falla,
  se usa la plantilla segura.
- **Misiones:** cada cifra lleva su ruta en el JSON (`src`) y los tests comprueban que coincide con el fichero del caso.
- **Puntuación:** solo las combinaciones que el propio plan calcula (`agent/src/game/score.mjs`, decisión D6: las mejoras
  no se suman).

## 3. Cómo se ejecuta (detalle en `README.md`)

Node 22+, Chrome/Edge y un `.env` en la raíz con `TEAM_KEY=...` (la clave del proxy de IA del hackathon). Luego
`cd agent`, `npm install`, `npm start` y abrir http://localhost:5173. Demo sin hablar:
http://localhost:5173/reset.html → "Start the demo (recorded family)". Tests: `npm test` (237).

## 4. Mapa del código: dónde está cada cosa

Todo el producto vive en `agent/`. Cada fichero empieza con un comentario que explica qué hace.

```
agent/
  server.mjs                 Servidor: rutas HTTP, relay de voz (WebSocket /voice), seguridad, límites, retención.
  src/                       LÓGICA DEL SERVIDOR
    case-source.mjs          De dónde salen los datos: MCP oficial o la carpeta cases/ (mismos datos).
    session.mjs              Una llamada de voz: navegador <-> nuestro servidor <-> proxy de IA (Gemini realtime).
    instructions.mjs         Las instrucciones de Sherpy (reglas, guion de la conversación, modo asesor).
    tools.mjs                Herramientas que Sherpy llama: save_answer, finish_conversation, get_plan_section.
    profile.mjs / options.mjs Perfil de la familia (respuestas) y respuestas permitidas por pregunta.
    brief.mjs                Resumen de cifras del plan que recibe Sherpy.
    chat-memory.mjs          Memoria de la burbuja "Ask Sherpy" (2 h, en RAM).
    missions-brief.mjs       Lo que Sherpy sabe de las misiones y de la pantalla actual.
    security.mjs / origin.mjs Cabeceras de seguridad, límites de uso, solo localhost.
    privacy.mjs              Borrado automático de ficheros caducados.
    video/                   VÍDEO: facts.mjs (cifras) -> scenes.mjs (7 escenas) -> narrate.mjs (texto con IA)
                             -> voice.mjs (voz ElevenLabs) -> build.mjs (orquesta y cachea).
    game/                    MISIONES: advice.mjs (lee las 3 fuentes de consejos), generate.mjs (genera misiones
                             para cualquier caso), missions.mjs (carga: a mano o generadas), score.mjs (puntuación).
  public/                    LO QUE CORRE EN EL NAVEGADOR
    index.html + conversation.mjs   Pantalla 1, conversación. voice-client.mjs = audio del micro y de Sherpy.
    video.html + video-player.mjs   Pantalla 2, vídeo. video-stage.mjs dibuja cada escena.
    missions.html + missions.mjs    Pantalla 3, misiones. step-ui.mjs = bloques interactivos de cada paso.
    sherpy-chat.mjs          Burbuja de voz "Ask Sherpy" en las misiones.
    journey-nav.mjs / handoff.mjs   Flechas ‹ › entre pantallas y paso suave conversación -> vídeo -> misiones.
    phone.html + frame-guard.js     Marco de móvil dibujado en pantallas anchas.
    demo-family*.mjs         Modo demo: Daniel y Emily son voces grabadas (ElevenLabs) que responden solas.
    *-logic.mjs              Lógica pura (sin DOM), con tests.
  data/missions/daniel-emily-johnson.json   Misiones de los Johnson escritas a mano (las de la demo).
  data/demo-family/          Audios de la familia demo.
  scripts/                   Utilidades: demo-reset, delete-family-data, demo-family-audio, build-video...
  test/                      237 tests (node --test).
cases/                       Los 4 casos de Sherpas (datos ficticios): Johnson, Samantha Lewis, Carter, Weah.
assets/                      Marca Sherpas (tokens.css, logos) y la mascota Sherpy (SVG).
docs/                        Decisiones (decisions.md), estado (STATUS.md), diario (devlog.md), diseños (superpowers/).
```

## 5. El recorrido por dentro (para explicarlo en 30 segundos)

1. La familia pulsa Start. El navegador abre `/voice` y envía audio del micro. Nuestro servidor (`session.mjs`) lo
   reenvía al modelo de voz con las instrucciones de Sherpy y las cifras de su plan. Las claves nunca llegan al navegador.
2. Cuando la familia confirma algo, Sherpy llama a `save_answer` y se guarda en `data/profiles/<caso>.json`.
3. Con todo respondido, Sherpy llama a `finish_conversation`. El servidor **empieza a construir el vídeo mientras
   Sherpy se despide**, por eso tarda solo unos segundos.
4. La página pasa sola al vídeo y, al acabar, a las misiones.
5. En las misiones, el progreso y lo que escriben se guarda **solo en su navegador**.

## 6. Por qué así (argumentos para el pitch y la rúbrica)

| Criterio | Argumento |
|---|---|
| Engancha | Hablar en vez de leer; un vídeo sobre *ellos* listo en segundos; un camino tipo juego. |
| Se entiende | Su plan medido en sus objetivos (la universidad de Oliver en 2033), no en tablas. Un paso cada vez. |
| Mueve a actuar | Cada paso reduce la acción a minutos: email ya escrito, su rango de cobertura listo para copiar, checklist. |
| Personal | Nombres, objetivos y discrepancias de la pareja; estilo números vs significado; nivel de detalle. |
| Creatividad | Mediación de pareja por voz; vídeo generado en vivo; familia demo con voces sintéticas. |

Descartado y por qué: formulario (abandono), menú de estilos (parálisis), dashboard (hay que leerlo; Sherpas ya lo tiene),
vídeo genérico (no engancha), un vídeo por paso (lento y caro), ranking entre familias (privacidad).

## 7. Preguntas probables del jurado (y respuesta corta)

- **¿Puede la IA inventarse un número?** No en el vídeo ni en las misiones (ver punto 2). En la voz en directo, Sherpy
  solo tiene las cifras del plan y tiene prohibido calcular; es un modelo, así que es la parte con más riesgo, por eso
  dice "eso no está en tu plan" en vez de adivinar.
- **¿Funciona con cualquier familia?** Sí: las misiones de cualquier caso se generan desde las 3 fuentes de consejos del
  plan (`src/game/generate.mjs`), con tests que obligan al estándar en los 4 casos. Los Johnson tienen una versión
  escrita a mano, más pulida, para la demo.
- **¿Y la privacidad?** No se graba audio; transcripciones desactivadas por defecto; borrado automático y comando de
  borrado; página `/privacy.html`. Para un lanzamiento real harían falta pasos legales (consentimiento, contratos con
  proveedores, evaluación de impacto): está dicho en esa página.
- **¿Cuánto cuesta?** Una conversación + vídeo cuesta céntimos (presupuesto total del equipo: $50).
- **¿Cómo se integra en Sherpas?** Mismos datos (su MCP), su marca y diseño móvil; las tres pantallas podrían ir dentro
  de su app.

## 8. Limitaciones honestas (mejor decirlas nosotros)

- La voz en directo depende del modelo: a veces se sale del guion (por eso la demo usa la familia grabada).
- Las misiones generadas automáticamente son más genéricas que las escritas a mano de los Johnson.
- El progreso de las misiones se guarda en el navegador (no hay cuentas ni servidor de usuarios).
- El proxy de IA del hackathon acaba el 21/11.

## 9. Para profundizar

`docs/STATUS.md` (estado), `docs/decisions.md` (decisiones con su estado), `docs/devlog.md` (diario con números reales),
`docs/superpowers/specs/` (diseños aprobados), `docs/delivery-writeup.md` (texto de la entrega en inglés).
