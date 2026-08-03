# Tercera revisión — auditoría de los principios

Auditoría de los ocho principios propuestos en la revisión anterior, sometidos a
contraejemplos. Cuatro sobreviven intactos. Tres están incompletos. Uno es incorrecto.
Y el conjunto tiene un defecto estructural que ninguno de ellos tiene por separado.

---

## 1. Auditoría de los principios existentes

### El defecto estructural: son un conjunto, no un procedimiento

Prueba a aplicarlos a `owner`:

- **P1** (¿sigue siendo verdad cuando el código cambia?) → Sí. **P1 admite `owner`.**
- **P4** (¿puede estar equivocado?) → Sí, alguien puede teclear mal el nombre.
  **P4 admite `owner`.**
- **P2** (¿un proceso determinista puede responderlo?) → Sí, `git log`. **P2 lo rechaza.**

Dos de tres principios dan la respuesta equivocada. Sólo P2 acierta. Lo mismo ocurre
con `test.status`: P1 y P4 lo admiten, sólo P2 lo rechaza.

Esto significa que **los principios no son intercambiables y su orden importa**, pero
en ningún sitio está dicho cuál se aplica primero. Dentro de cinco años, alguien
aplicará P1, obtendrá "sí es conocimiento" y se detendrá ahí. El razonamiento será
impecable y la conclusión falsa.

**Cambio mínimo — no un principio nuevo, sino una ordenación:**

> P2 se aplica **primero** y elimina candidatos. P1 y P4 sólo deciden sobre lo que P2
> no rechazó.

Sin esa frase, el conjunto es ambiguo por construcción.

### Principio por principio

| | ¿Correcto? | ¿Suficiente? | Excepciones | Veredicto |
|---|---|---|---|---|
| **P1** conocimiento = lo que sigue siendo verdad cuando el código cambia | Casi | No | Sí | **Reformular** |
| **P2** si un proceso determinista puede responderlo, no se escribe a mano | Sí | No | Sí, una | **Completar** |
| **P3** Annona nunca genera conocimiento humano | Sí | No | Aparente contradicción | **Completar** |
| **P4** el conocimiento puede estar equivocado; lo derivado sólo desactualizado | Sí | No | No | Correcto, subordinado a P2 |
| **P5** `annona/` describe el sistema, no al equipo | Sí | Sí | No | **Intacto** |
| **P6** Annona no trae conocimiento de fábrica | Sí | Sí | No | **Intacto** |
| **P7** un veredicto sólo afirma lo que comprobó | Sí | Sí | No | **Intacto, el más sólido** |
| **P8** todo lo que el compilador sabe debe poder decirlo | **No** | — | — | **Incorrecto** |

### P1 — reformular

Contraejemplo: un ADR marcado `superseded` ya no es verdad, y sigue siendo
conocimiento — probablemente el más valioso, porque documenta una alternativa
descartada. P1 tal como está lo expulsaría.

El error es la palabra "verdad". El conocimiento puede ser falso, obsoleto o estar
equivocado sin dejar de ser conocimiento. Lo que lo define no es su veracidad sino
**qué puede invalidarlo**.

> **P1 (reformulado):** el conocimiento sólo puede ser invalidado por una decisión
> humana, nunca por un cambio del código. Si editar el código convierte un dato en
> falso, ese dato es estado.

Ahora funciona: un ADR superseded fue invalidado por una decisión (correcto,
conocimiento); `task.status` se vuelve falso al escribir el código (correcto, estado);
`test.status` se vuelve falso al cambiar el código (correcto, estado).

### P2 — completar con la única excepción legítima

Contraejemplo: `touches` es derivable de un diff. P2, tal como está, lo expulsa. Pero
`touches` significa *qué pretendo cambiar*, y el diff dice *qué cambié*. Son preguntas
distintas, y la divergencia entre ambas es una señal útil — lo comprobamos en M1.5,
cuando `touches` estaba mal en 3 de 5 tareas.

> **P2 (completado):** si un proceso determinista puede responder un dato **y ese dato
> no tiene un significado humano independiente del resultado de ese proceso**, el
> proceso es la fuente de verdad y el dato no se escribe a mano.

La cláusula salva `touches` y no salva nada más: `owner`, `created`, `test.status` y
`depends_on` no significan nada distinto de lo que la herramienta observa.

Segundo matiz necesario: **P2 se aplica campo a campo, no entidad a entidad.** La
*existencia* de un componente es derivable; su *responsabilidad* no lo es.

### P3 — completar antes de M2

Contradicción con la arquitectura ya congelada: el roadmap incluye `annona propose`,
que permite a un agente redactar conocimiento con `status: proposed`. P3 dice que
Annona nunca genera conocimiento humano. Leído literalmente, **P3 prohíbe una
funcionalidad ya decidida**.

La resolución existe pero no está escrita: una propuesta no es conocimiento hasta que
una persona la acepta.

> **P3 (completado):** Annona nunca genera conocimiento humano. Un texto redactado por
> un agente no es conocimiento: es una propuesta, no satisface ninguna comprobación y
> no entra en ningún contexto hasta que una persona la acepta. La aceptación es el acto
> humano que crea el conocimiento, no la redacción.

Sin esta frase, el primer `propose` de M2 obliga a elegir entre romper P3 o cancelar la
funcionalidad, y lo más probable es que alguien reescriba P3 en caliente.

### P8 — incorrecto, y choca con la misión

"Todo lo que el compilador sabe sobre una decisión debe poder decirlo" es demasiado
fuerte. El compilador conoce el coste en tokens de cada nodo, tiempos por etapa, el
estado completo del recorrido. Si todo eso debe decirse, la salida crece
indefinidamente — y la misión del producto es producir el **contexto mínimo**. P8, tal
como está, pelea contra la razón de ser de Annona.

El fallo es confundir *poder explicar* con *explicar siempre*.

> **P8 (corregido):** toda inclusión y toda exclusión debe ser explicable de forma
> determinista **cuando se pregunte**. El contexto compilado no lleva la explicación;
> lleva lo necesario para reconstruirla.

Ahora es compatible con el presupuesto de tokens y sigue prohibiendo la confianza
ciega.

---

## 2. Qué convierte algo en conocimiento

Una sola regla, sin ejemplos:

> **Algo es conocimiento si su verdad la decidió una persona y ninguna observación del
> sistema puede confirmarla ni refutarla.**

El discriminante es la **observabilidad**, no la utilidad, ni la permanencia, ni el
esfuerzo de escribirlo.

| Dato | ¿Decidido por una persona? | ¿Observable? | Veredicto |
|---|---|---|---|
| Feature (intención) | Sí | No: el problema de negocio no está en ningún fichero | **Conocimiento** |
| Requirement | Sí | No: el código puede *violarlo*, que no es refutarlo | **Conocimiento** |
| ADR | Sí | No: el código muestra la opción elegida, nunca el motivo ni las descartadas | **Conocimiento** |
| Regla | Sí | No: una convención respetada es invisible | **Conocimiento** |
| `touches` | Sí | No: el diff dice qué cambió, no qué se pretendía | **Conocimiento** |
| `owner` | No | Sí: `git log` | Derivado |
| `test.status` | No | Sí: ejecutar los tests | Derivado |
| `depends_on` | No | Sí: los imports | Derivado |
| `task.status` | Sí | Sí: el código existe o no | **Estado** (decidido pero observable) |

El último caso es el que hace útil la regla: `task.status` lo decide una persona *y* es
observable. Esa combinación no es conocimiento ni dato derivado — es **estado**, la
tercera categoría, y explica por qué es lo único volátil dentro de `annona/`.

Un requisito puede ser violado por el código sin quedar refutado; una dependencia
declarada que el código contradice sí queda refutada. Esa asimetría es toda la
frontera.

---

## 3. Qué convierte algo en una entidad

Los criterios existentes eran tres. Falta uno, y es el que más entidades habría
evitado.

1. **¿Tiene identidad estable?** Debe poder renombrarse su título sin romper ninguna
   referencia. Si la identidad es su texto, es un campo.
2. **¿Participa en al menos una relación?** Una entidad aislada es una nota. El grafo
   es el producto; un nodo sin aristas no aporta nada al recorrido.
3. **¿Cambiaría algún contexto compilado si desapareciera?** Si ningún recorrido la
   alcanza, existe para el humano que la escribió, no para el sistema.
4. **(Criterio que faltaba) ¿Necesitará alguna otra entidad apuntarla?** Si nada la
   referenciará jamás, es un campo de otra entidad, no una entidad.

El cuarto criterio es el que rechaza `epic`, `sprint`, `milestone` o `risk`: nadie
necesita apuntar a un sprint desde un requisito. Sin él, los otros tres se pueden
satisfacer artificialmente inventando una arista.

Los cuatro se responden con Sí o No. Los cuatro deben ser Sí.

---

## 4. La frontera se mueve en una sola dirección

**Nunca debe escribirse a mano:** lo que un analizador determina con certeza — imports,
grafo de llamadas, existencia de ficheros, ubicación de símbolos, qué tocó un commit,
qué tests pasaron.

**Nunca debe derivarse automáticamente:** intención, obligación, motivo, alternativa
descartada, prohibición, prioridad y toda relación semántica.

**Qué ocurre cuando un dato cambia de categoría:** ocurre, y en una sola dirección.
`depends_on` fue conocimiento cuando no había parsers y hoy no lo es. `touches` puede
volverse parcialmente derivable con el Code Graph. Ningún dato viaja en sentido
contrario: nada que hoy se derive pasará mañana a escribirse a mano, porque las
herramientas no empeoran.

> **P9 — La frontera entre conocimiento y dato derivado sólo se mueve hacia la
> derivación. Cuando una herramienta demuestra que puede responder un campo de forma
> determinista, ese campo se elimina del grafo. No se conserva "por referencia", no se
> marca como opcional y no se mantiene en paralelo.**

La tentación exacta que P9 evita: conservar `depends_on` "por si acaso" cuando el Code
Graph ya lo sabe. Eso crea dos fuentes de verdad para el mismo hecho, que es
literalmente el problema que Annona existe para resolver.

---

## 5. Filosofía de recuperación

**Qué significa perder conocimiento:** no perder ficheros, sino perder la capacidad de
responder *por qué*. Un repositorio sin `annona/` sigue compilando, sigue pasando los
tests y sigue desplegándose. Lo único que ya no puede es explicarse. Por eso la pérdida
es silenciosa y por eso hace falta detectarla.

**Aceptable reconstruir:** exclusivamente lo observable — el runtime, los índices, los
ficheros de agente, y en el futuro los componentes y `depends_on`.

**Jamás reconstruir:** cualquier cosa decidida por una persona. Reconstruir un ADR
desde el código produciría un texto plausible, bien escrito e indistinguible de uno
real, que afirmaría un motivo que nadie tuvo. Sería exactamente la invención de
conocimiento que Annona existe para impedir.

**¿Debe Annona negarse alguna vez?** Sí, y es el caso que define el producto: **cuanto
más capaz sea de producir algo convincente, más obligada está a negarse.** Un ADR
inventado no se distingue de uno auténtico una vez escrito; un componente inferido sí
se puede contrastar contra el código. La calidad de la falsificación es el criterio,
no la dificultad técnica.

---

## 6. El papel de Git

**Evidencia histórica.** No es fuente de verdad y no es observabilidad.

- **No es fuente de verdad** del contenido: Git almacena ficheros sin entender qué
  afirman. Si Git y `annona/` discrepan sobre qué dice un ADR, es que alguien no ha
  hecho commit; no hay conflicto conceptual porque `annona/` *vive* en Git.
- **No es observabilidad**: eso es la telemetría, que registra qué hizo el sistema.
  Git registra qué afirmaron las personas.
- **Sí es evidencia histórica**, y con una consecuencia precisa: **`annona/` es fuente
  de verdad del *contenido* de una afirmación; Git lo es de *quién* la hizo y
  *cuándo*.** Ese reparto es la justificación de eliminar `owner` y `created`, y es
  suficiente para no volver a discutirlo.

De ahí se sigue el límite: cualquier uso de Git que vaya más allá de "quién afirmó qué
y cuándo" —análisis de co-cambio, métricas de actividad, atribución de código— no es
evidencia histórica sobre afirmaciones, es análisis de código, y pertenece al Code
Graph.

---

## 7. Responsabilidad del Context Compiler

> **Seleccionar el subgrafo mínimo que una tarea exige, renderizarlo de forma
> determinista y emitir un veredicto sobre lo que comprobó.**

Nada más. Tres verbos: seleccionar, renderizar, dictaminar.

**Lo que nunca debe asumir:**

| Responsabilidad prohibida | Por qué rompe el modelo |
|---|---|
| Ordenar por relevancia aprendida de datos | Destruye el determinismo, que es el producto |
| Invocar un modelo | Convierte a Annona en framework de IA; rompe la frontera del producto |
| Decidir qué hace el agente después | Sería un orquestador; Annona prepara, no dirige |
| Escribir en el grafo | Un bucle de realimentación: el conocimiento pasaría a depender de cómo se consumió |
| Guardar embeddings o índices semánticos | Es un RAG con otro nombre |
| Reescribir o resumir el texto del conocimiento | Introduce una interpretación que nadie decidió; viola P3 |
| Rellenar conocimiento ausente | Viola P3 y P7 a la vez |

La quinta y la sexta son las que llegarán disfrazadas de mejora de calidad. La defensa
no es que sean malas técnicas, sino que **un contexto que no se puede reproducir no se
puede depurar**, y sin eso Annona no se distingue de un RAG.

---

## 8. Riesgos de coherencia a cinco años

Ninguno es una mala decisión. Todos son decisiones razonables cuyo efecto acumulado
disuelve el modelo.

1. **La deriva hacia la gestión de proyectos.** `assignee` porque es cómodo, luego
   `priority`, luego `sprint`, luego un tablero. Cada paso es útil y ninguno es
   conocimiento. Al final Annona es un Jira peor con un compilador de contexto dentro.
   Lo frenan P1 y el criterio 4 de entidad; sin ellos no hay defensa.
2. **"Sólo una heurística, para este caso."** Llegará como petición legítima: "la
   búsqueda no encuentra nada". El día que el contexto deje de ser reproducible,
   `context diff` no significa nada, los fallos de un agente dejan de reproducirse, y
   el argumento comercial —37,6% frente a `grep`, pero *determinista*— desaparece.
3. **Que `COMPLETE` pase a significar "suficiente".** Es la deriva más silenciosa:
   nadie la decide, simplemente se empieza a leer así. P7 existe para esto y hoy es el
   único principio que lo impide.
4. **Aceptar datos derivados "por comodidad".** Un campo derivado dentro del grafo lo
   convierte en cache del código. Cuando el equipo descubra que un campo está obsoleto,
   dejará de confiar también en los que sí eran conocimiento. La desconfianza no se
   reparte: se contagia.
5. **Que el compilador empiece a escribir.** "Aprender" qué nodos fueron útiles y
   ajustar pesos parece obviamente bueno y es el fin del determinismo y de la
   separación de responsabilidades a la vez.
6. **Que Annona traiga plantillas.** Reglas de ejemplo en `annona init`, para que el
   producto "se vea útil desde el minuto uno". El grafo deja de ser del equipo. Lo
   frena P6.

El patrón común: **cada riesgo llega como una mejora de la experiencia de usuario, y
todos se pagan con determinismo o con propiedad del conocimiento.**

---

## 9. Criterios de admisión

Objetivos, respondibles con Sí o No, sin opinión.

**Nuevo tipo de entidad** — los cinco deben ser Sí:

1. ¿Supera la definición de conocimiento de la sección 2?
2. ¿Tiene identidad estable independiente de su texto?
3. ¿Participa en al menos una relación existente?
4. ¿Alguna otra entidad necesitará apuntarla?
5. ¿El recorrido del compilador lo alcanza, de modo que su ausencia cambiaría algún
   contexto?

**Nuevo campo** — los tres deben ser Sí:

1. ¿Falla P2? (es decir: ningún proceso determinista puede responderlo, o tiene
   significado humano independiente)
2. ¿Sólo puede invalidarlo una decisión humana, nunca un cambio del código? (P1)
3. ¿Es opcional, de forma que ningún fichero existente deja de ser válido? (política de
   compatibilidad)

**Nueva relación** — los tres deben ser Sí:

1. ¿La afirma una persona, en lugar de deducirla una herramienta?
2. ¿Algún paso del recorrido la usa? Si ningún plan la atraviesa, es documentación.
3. ¿Expresa algo que ninguna relación existente ya expresa?

**Nueva herramienta MCP** — los tres deben ser Sí:

1. ¿Existe una tarea de agente imposible sin ella?
2. ¿Es de sólo lectura, o su escritura es no autoritativa?
3. ¿El catálogo se mantiene en siete o menos? Cada herramienta es coste de tokens
   permanente en todas las sesiones.

**Nueva fuente de información** — los cuatro deben ser Sí:

1. ¿Es determinista?
2. ¿Es reconstruible, de modo que su pérdida no pierde conocimiento?
3. ¿Entra como propuesta, sin poder aceptar nada por sí misma? (P3)
4. ¿Annona sigue funcionando sin ella?

---

## 10. Revisión final

**¿Existe algún principio incorrecto?**
Uno: **P8**. Exige decir todo lo que el compilador sabe, lo que hace crecer la salida
sin límite y contradice la misión de contexto mínimo. Corregido: explicable cuando se
pregunte, no explicado siempre.

**¿Existe algún principio incompleto?**
Tres. **P1** confunde conocimiento con verdad y expulsaría un ADR superseded. **P2** no
distingue "derivable" de "derivable y sin significado humano propio", y expulsaría
`touches`. **P3** no distingue generar de proponer.

**¿Existe alguna contradicción?**
Dos. Una **interna**: P1 y P4 admiten `owner` y `test.status`, que P2 rechaza; el
conjunto sólo da respuestas correctas si P2 se aplica primero, y ese orden no está
escrito. Una **con la arquitectura congelada**: P3, leído literalmente, prohíbe
`annona propose`, que ya está en el roadmap de M2.

**¿Existe alguna responsabilidad mezclada?**
Ninguna nueva. Las dos conocidas —`RULE-0005` mezclando proceso con ingeniería, y la
telemetría no reconstruible en la zona desechable— siguen abiertas y ya tienen su
cambio mínimo definido.

**¿Qué concepto sigue dependiendo del conocimiento implícito del creador?**
Dos, y son los que más caro se pagan:

1. **El orden de aplicación de los principios.** Existe en la cabeza de quien los
   escribió y en ningún otro sitio. Es la diferencia entre un procedimiento y una lista
   de frases razonables.
2. **Que el determinismo es el producto, no una preferencia de implementación.** Todo
   el mundo entiende que Annona reduce tokens; casi nadie deduce que un contexto no
   reproducible no se puede depurar ni comparar, y que sin eso no queda nada que
   distinga a Annona de un RAG. Mientras eso no esté escrito como razón —y no como
   restricción— la primera petición de búsqueda semántica ganará la discusión.

---

## Resumen de cambios

Cinco frases y ninguna funcionalidad:

| # | Cambio | Rompe |
|---|---|---|
| 1 | P2 se aplica antes que P1 y P4 | Contradicción interna del conjunto |
| 2 | P1: invalidable sólo por decisión humana, no por cambio de código | P1 expulsa ADRs superseded |
| 3 | P2: añadir "y sin significado humano independiente" | P2 expulsa `touches` |
| 4 | P3: proponer no es generar; la aceptación crea el conocimiento | P3 prohíbe `annona propose` |
| 5 | P8: explicable cuando se pregunte, no siempre | P8 contradice el contexto mínimo |

Más P9 (la frontera sólo se mueve hacia la derivación) y el cuarto criterio de entidad
(¿alguien necesitará apuntarla?), que son los dos únicos huecos donde no había regla.
