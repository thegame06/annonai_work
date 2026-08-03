# Roadmap de validación

No hay funcionalidades en este documento. Cada milestone responde una pregunta y
termina cuando la pregunta tiene respuesta, no cuando el código está escrito.

---

## 1. Clasificación de las hipótesis

| # | Hipótesis | Riesgo | ¿Bloquea seguir construyendo? | ¿Necesita capacidades nuevas? | Esfuerzo |
|---|---|---|---|---|---|
| H1 | El agente rinde mejor con contexto compilado | **Crítica** | **Sí** | No — el harness existe, falta clave y `--runner` | 5 días |
| H2 | Otra persona puede escribir conocimiento | **Crítica** | No, bloquea adopción | No | 2 días |
| H3 | El veredicto es fiable | Alta | No, bloquea afirmarlo públicamente | No | 0,5 días |
| H5 | Funciona con conocimiento parcial | Alta | No, bloquea el mercado real | No | 1 día |
| H7 | El baseline de comparación es justo | Media | No | No, pero necesita un agente real | 1 día |
| H8 | El estimador de tokens no distorsiona | Media | No, bloquea publicar cifras | No | 0,5 días |
| H4 | Ocho tipos y ocho relaciones bastan | Media | No | No | 2 días |
| H6 | El mantenimiento no crece con el tiempo | Media | No | No — la telemetría ya lo registra | 0 días, 4 milestones de calendario |
| H9 | El determinismo sirve para depurar | Baja | No | No, pero depende de H1 | 1 día tras H1 |

**Total de esfuerzo real: 13 días de trabajo.** Ninguna hipótesis requiere desarrollar
capacidades nuevas. Todas se responden con lo que ya existe.

---

## 2. Criterios objetivos

### H1 — El agente rinde mejor

- **Éxito:** con contexto de Annona, la tasa de éxito es igual o mejor (no más de 1
  tarea de 10 por debajo del baseline) **y** los tokens totales consumidos —entrada más
  salida, sumando iteraciones— son al menos un 25% menores.
- **Fracaso:** la tasa de éxito cae más de 1 tarea de 10, **o** los tokens totales no
  bajan del baseline.
- **Si es falsa:** se detiene la construcción de M2. Dos salidas posibles, y hay que
  elegir una antes de escribir más código: corregir la sobre-recuperación ya medida y
  repetir, o reposicionar Annona como herramienta de gobernanza y trazabilidad, dejando
  de vender reducción de tokens. La segunda opción cambia el producto entero.

### H2 — Otra persona puede escribir conocimiento

- **Éxito:** 2 de 3 ingenieros llegan a un contexto `COMPLETE` en menos de 60 minutos,
  sin errores de `check` y sin ayuda del diseñador.
- **Fracaso:** 1 o ninguno lo consigue, o la mediana supera los 90 minutos.
- **Si es falsa:** la prioridad del roadmap deja de ser el producto y pasa a ser la
  autoría — el plugin de descubrimiento sube al primer puesto. Y la estrategia comercial
  cambia: Annona sería una herramienta para equipos con arquitecto dedicado, no para
  cualquier equipo.

### H3 — El veredicto es fiable

- **Éxito:** eliminar cualquier clase de entidad cambia el veredicto en al menos un
  contexto, y como máximo el 20% del corpus puede desaparecer sin que ningún veredicto
  cambie.
- **Fracaso:** más del 50% del corpus puede desaparecer en silencio.
- **Si es falsa** (y hoy hay evidencia de que lo será): `COMPLETE` deja de usarse como
  argumento de confianza en documentación y en la web. Se sigue emitiendo, con su
  significado real escrito al lado. No es un cambio de producto, es un cambio de lo que
  se afirma sobre él.

### H5 — Funciona con conocimiento parcial

- **Éxito:** con el 30% del corpus, al menos el 80% de los `MISSING_CONTEXT` son
  accionables: nombran una entidad o un tipo concreto que falta.
- **Fracaso:** menos del 50% son accionables, es decir, el halt se convierte en ruido.
- **Si es falsa:** Annona sólo sirve en greenfield, que es la minoría del mercado. El
  posicionamiento cambia a "empieza el conocimiento por la feature que estás
  construyendo", y el plugin de descubrimiento pasa a ser obligatorio, no opcional.

### H7 — El baseline es justo

- **Éxito:** el agente real lee igual o más que los 1.193 tokens simulados, confirmando
  que la simulación es cota inferior.
- **Fracaso:** lee materialmente menos, con lo que el 37,6% está inflado.
- **Si es falsa:** se recalcula y se republica la cifra. Si la ventaja real cae por
  debajo del 15%, la reducción de tokens deja de ser un argumento comercial y H1 pasa a
  decidirse sólo por calidad.

### H8 — El estimador no distorsiona

- **Éxito:** el ratio calculado con un tokenizador real queda a ±5 puntos porcentuales
  del 37,6%.
- **Fracaso:** se desvía más de 10 puntos, o los dos brazos se desvían en direcciones
  opuestas.
- **Si es falsa:** se republican todas las cifras del proyecto. No cambia el producto;
  cambia su credibilidad, y es más barato descubrirlo ahora que después de publicarlas.

### H4 — Ocho tipos y ocho relaciones bastan

- **Éxito:** de 10 tickets ajenos, ninguno exige un tipo o relación inexistente y como
  máximo uno obliga a forzar el significado de una relación.
- **Fracaso:** 3 o más exigen tipos nuevos, o 3 o más fuerzan significados.
- **Si es falsa:** hay que revisar el conjunto congelado de tipos, lo que implica una
  subida de versión del formato — el artefacto que los usuarios no pueden regenerar.
  Conviene descubrirlo antes de que existan usuarios.

### H6 — El mantenimiento no crece

- **Éxito:** ediciones manuales en `annona/` por PR aceptado con pendiente no creciente
  a lo largo de 4 milestones.
- **Fracaso:** se duplica.
- **Si es falsa:** la automatización de la resincronización sube al primer puesto del
  backlog, por encima de cualquier funcionalidad.

### H9 — El determinismo sirve para depurar

- **Éxito:** al menos la mitad de los fallos de agente se explican consultando la traza
  en lugar de leyendo el código.
- **Fracaso:** menos de uno de cada cinco.
- **Si es falsa:** el determinismo se sigue defendiendo por reproducibilidad de
  benchmarks, no por depuración. Se cae un pilar del discurso, no el producto.

---

## 3. Roadmap por reducción de incertidumbre

Ninguna hipótesis crítica comparte milestone con otra crítica.

### V1 — ¿Son válidos nuestros instrumentos de medida? *(1 día)*

**H8 + H3.** Ninguna es crítica y ninguna necesita modelo.

Va primero porque cuesta un día y porque ambas miden el instrumento, no el producto.
Ejecutar H1 con un estimador sin validar significa arriesgar cinco días para obtener un
número del que después habría que dudar.

**Termina cuando:** existe la banda de error del estimador y la tabla de "cuánto corpus
puede desaparecer en silencio".

### V2 — ¿Un agente rinde mejor con Annona? *(5 días)*

**H1** (crítica, sola) **+ H7**, que se aprovecha del mismo montaje con modelo.

Va inmediatamente después de V1, no al final. Es la pregunta existencial: si falla, los
otros ocho experimentos eran trabajo perdido. Retrasarla para acumular contexto sobre
brownfield es optimizar el aprendizaje mientras se ignora el riesgo.

**Termina cuando:** hay 60 ejecuciones puntuadas y una respuesta binaria.

### V3 — ¿Puede alguien que no diseñó el esquema poblar el grafo? *(2 días)*

**H2**, crítica, sola.

Sólo tiene sentido si V2 salió bien: no vale la pena comprobar si otros pueden usar algo
que no funciona.

**Termina cuando:** 3 personas lo han intentado y hay tres tiempos medidos.

### V4 — ¿Sirve en un proyecto que ya existe? *(3 días)*

**H5 + H4.** Ambas sobre proyectos reales, ninguna crítica, ninguna necesita modelo.

Después de V3 porque comparten sujeto: si ya hay tres ingenieros externos probando el
modelo, son las mismas personas y los mismos proyectos los que responden si el modelo
expresa su dominio y si tolera conocimiento parcial.

**Termina cuando:** hay una cifra de halts accionables y un recuento de tipos forzados.

### V5 — ¿Se sostiene en el tiempo? *(0 días de trabajo, 4 milestones de calendario)*

**H6 + H9.** No se ejecuta: se observa. La telemetría ya lo registra y H9 sólo existe si
V2 salió bien.

**Termina cuando:** hay cuatro puntos de datos, es decir, después de V4 y no antes.

---

## 4. Por qué este orden

| Decisión | Motivo |
|---|---|
| V1 antes que todo | 1 día que protege la validez de los otros 12 |
| H1 en segundo lugar y no al final | Es la única que puede matar el producto; conocerla tarde convierte todo lo anterior en trabajo perdido |
| H2 después de H1 | Comprobar si otros saben usar algo que no funciona no aporta información |
| H4 y H5 juntas y tarde | Comparten sujeto experimental con V3 y ninguna es crítica |
| H6 sin milestone propio | No es un experimento; es una serie temporal que ya se está registrando |
| H9 al final | Depende de que existan ejecuciones reales de agente |

**Aprendizaje por unidad de esfuerzo:** V1 responde 2 hipótesis en 1 día. V2 responde la
que decide si el producto existe. Entre las dos consumen 6 de los 13 días y eliminan la
mayor parte de la incertidumbre relevante.

---

## 5. ¿Cuándo deja Annona de ser un experimento?

Hay tres estados, y conviene no confundirlos.

**Hoy: experimento que funciona para su autor.** Todas las mediciones proceden de dos
corpus que escribió la misma persona que diseñó el esquema, sobre proyectos que se
modelaron desde cero. Ninguna afirmación sobre el rendimiento de un agente tiene
evidencia.

**Tras V2 con resultado positivo: hipótesis validada.** Se demuestra que el contexto
compilado produce mejor resultado con menos tokens. Es condición necesaria y no
suficiente: sigue siendo una técnica que funciona en manos de quien la inventó.

**Tras V3 y V4 con resultado positivo: producto.**

> **Annona deja de ser un experimento cuando tres personas que no participaron en su
> diseño modelan proyectos que no fueron creados para encajar en el modelo, y un agente
> completa esas tareas mejor que sin Annona.**

Las tres condiciones son necesarias y ninguna es suficiente:

- **V2** demuestra que la técnica funciona. Sin ella no hay nada.
- **V3** demuestra que funciona sin su autor. Sin ella hay una técnica, no un producto.
- **V4** demuestra que funciona sobre proyectos reales y no sobre datos diseñados para
  encajar. Sin ella hay un producto para greenfield, que es la minoría del mercado.

Son 11 de los 13 días. V1 no entra en la definición porque no valida el producto: valida
que las cifras que se publican son ciertas, que es una cuestión de honestidad y no de
existencia.

**Lo que no forma parte de la definición y conviene decirlo:** número de funcionalidades,
integraciones disponibles, tamaño del catálogo MCP y cobertura de tests. Ninguna de esas
cosas convierte un experimento en producto, y todas son más fáciles de conseguir que las
tres de arriba.
