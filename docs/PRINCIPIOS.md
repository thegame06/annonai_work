# Segunda revisión conceptual — principios que aún no están escritos

Parte del estado real (64 entidades, 65 relaciones) y de la revisión anterior. No
repito lo ya identificado salvo en un punto, donde encontré una **contradicción**: la
ambigüedad 4 de la revisión anterior era más grave de lo que dije.

---

## 1. Límite entre conocimiento y estado

La revisión anterior dijo "`status` es estado". Era una simplificación. Mirando los
valores reales del repositorio, **`status` esconde tres cosas distintas con tres dueños
distintos bajo un mismo nombre de campo**:

| Tipo | Valores hoy | Qué es | Quién es el dueño |
|---|---|---|---|
| `task.status` | `done` (12) | Estado de flujo de trabajo | Una persona, vía `annona done` |
| `test.status` | `passing` (4), `pending` (5) | **Un hecho sobre una ejecución** | **El ejecutor de tests, no el fichero** |
| `feature`, `adr`, `requirement`, `rule`, `component`, `term` | `in_progress`, `accepted`, `active` | Ciclo de vida editorial | Una persona |

`test.status: passing` es la duplicación más peligrosa del sistema y es exactamente el
mismo error que `owner`: afirma en YAML un hecho que otra herramienta conoce mejor y
que nadie actualizará. Ya me hizo tropezar durante M1.6, cuando construí `annona done`
marcando tests como `passing` sin evidencia.

**Qué es conocimiento:** lo que alguien decidió y sigue siendo verdad aunque el código
cambie — intención, obligación, motivo, prohibición, vocabulario, y las relaciones
entre todo eso.

**Qué es sólo estado:** dónde está algo en un flujo (`task.status`) y qué ocurrió en
una ejecución (`test.status`).

**Propiedades futuras que caerán en la misma confusión:** `assignee`, `priority`,
`due`, `estimate`, `sprint`, `progress`, `blocked_by`, `last_run`, `coverage`. Todas
parecen conocimiento del proyecto y ninguna lo es. Cada una llegará como una petición
razonable, y cada una envejecerá sola.

**El principio que lo evita** (P1 y P2 en la sección 8): un campo pertenece a
`annona/` sólo si sigue siendo verdad cuando el código cambia, y ningún campo puede
afirmar un hecho que otra herramienta observa directamente.

---

## 2. Fuente de verdad: qué debería derivarse

| Dato | ¿Conocimiento humano? | ¿Derivable? | Riesgo de duplicación | Fuente de verdad correcta |
|---|---|---|---|---|
| `owner`, `created` | No | Sí | Alto, ya identificado | `git log` |
| **`test.status`** | **No** | **Sí** | **Alto, no identificado antes** | **La ejecución de tests** |
| **`component.depends_on`** (6 hoy) | **No** | **Sí** | **Alto en M3** | **Los imports del código** |
| `task.touches` | Sí, como intención | Sí, como hecho | Alto en M3 | Ambas, y son cosas distintas |
| Componentes | Sí, el *qué representa* | Parcial, la existencia | Medio | Persona |
| Relaciones semánticas (`implements`, `decides`, `constrains`, `refines`) | **Sí** | **No** | Ninguno | Persona |
| `bytes` | No | Sí, ya se deriva | Ninguno | El compilador |

`depends_on` es el segundo `touches` y nadie lo ha señalado: seis aristas escritas a
mano que describen qué componente importa a cuál. Un parser lo sabe con certeza. La
diferencia con `touches` es que `touches` tiene una lectura humana legítima
—"qué *pretendo* cambiar"— y `depends_on` no tiene ninguna: un componente depende de
otro o no depende, y el código lo decide.

**Principio general para cualquier entidad futura** (P2): antes de añadir un campo,
pregunta si existe un proceso determinista que pueda responderlo. Si existe, ese
proceso es la fuente de verdad y el campo no debe escribirse a mano. Si no existe, es
conocimiento y debe escribirse.

---

## 3. Filosofía de recuperación — y una contradicción con la revisión anterior

La revisión anterior dijo que `check` no detecta la desaparición de conocimiento.
**El problema es peor: el veredicto miente.**

Borra `annona/adrs/` y haz commit. Entonces:

- `annona check` pasa: sin ADRs no hay referencias rotas.
- `annona compile` compila menos entidades y no dice nada.
- **`annona context` sigue devolviendo `COMPLETE`** en todas las tareas.

Porque `COMPLETE` significa "están presentes los tipos exigidos" —requisito, feature,
componente— y un ADR nunca fue exigido. El contexto se vuelve más pobre y el sistema
sigue afirmando que está completo.

Eso no es un aviso que falta. Es el único mecanismo de confianza del producto
afirmando algo falso. Un agente que recibe ese contexto no puede saberlo, y el usuario
tampoco.

### Comportamiento esperado

| Pregunta | Respuesta |
|---|---|
| ¿Qué debe poder reconstruirse? | Sólo lo derivable: `runtime.db`, índices, ficheros de agente, y en el futuro componentes y `depends_on` |
| ¿Qué nunca podrá reconstruirse? | Intención, obligación, motivo, prohibición, vocabulario y **las 65 relaciones semánticas** |
| ¿Debe detectar la pérdida? | **Sí.** Comparando con la última compilación conocida |
| ¿Debe impedir continuar? | **No.** Un proyecto puede legítimamente borrar conocimiento obsoleto |
| ¿Debe advertir? | **Sí, y de forma imposible de ignorar**: si el corpus encoge sin que un commit lo explique, el veredicto del contexto no puede seguir siendo `COMPLETE` en silencio |
| ¿Debe reconstruir automáticamente? | **Sólo lo derivable, y nunca conocimiento humano.** Reconstruir un ADR desde el código es inventarlo, que es precisamente lo que Annona existe para impedir |

**Principio** (P3): Annona nunca genera conocimiento humano, ni siquiera para
repararse a sí misma. Ante la duda, avisa y se detiene; jamás rellena el hueco.

---

## 4. Conocimiento del producto frente a conocimiento del proyecto

**No son dos dominios. Es el mismo modelo aplicado a dos proyectos distintos**, y eso
es correcto: si el modelo no sirviera para describir Annona, tampoco serviría para
describir un sistema de pagos.

Pero hay **una mezcla real hoy**, y está en el repositorio:

```
RULE-0005  "No feature without observed friction"  constrains → CMP-0005
```

Eso no es una restricción de ingeniería sobre un componente. Es una regla de *proceso*
sobre cómo trabaja el equipo. Está apuntando a un componente de código porque
`constrains` es la única arista disponible, no porque tenga sentido.

La distinción que falta no es producto/proyecto, es **conocimiento de ingeniería frente
a conocimiento de proceso**:

- *Ingeniería*: "el dinero se representa en unidades menores enteras". Restringe el
  código, y un agente puede violarla escribiendo código.
- *Proceso*: "ninguna feature sin fricción observada". Restringe a las personas, y
  ningún agente puede violarla escribiendo código.

**Principio** (P5): `annona/` describe el sistema, no el equipo. Una regla que un
agente no puede violar escribiendo código no pertenece al grafo de conocimiento; va en
CONTRIBUTING. El cambio mínimo es sacar RULE-0005 y no crear un `kind` nuevo.

Segunda observación, para cuando Annona se distribuya: **Annona no debe traer
conocimiento propio**. Ninguna regla, ADR ni glosario de fábrica. El día que `annona
init` genere una regla de ejemplo, el usuario tendrá en su grafo afirmaciones que
nadie de su equipo decidió, y el grafo dejará de ser suyo. Lo único que Annona escribe
son los ficheros de instrucciones, que son generados y desechables.

---

## 5. Knowledge Graph frente a Code Graph — el principio que falta

**Qué no debería escribirse nunca a mano:** cualquier cosa que un parser determine con
certeza — imports, grafo de llamadas, qué ficheros existen, dónde está definido un
símbolo, qué ficheros tocó un commit. Hoy `depends_on` viola esto.

**Qué no debería derivarse nunca automáticamente:** intención, obligación, motivo,
alternativa descartada, prohibición, prioridad y toda relación semántica. Ningún
análisis puede deducir que ADR-0001 gobierna REQ-0001, porque esa relación no está en
el código: está en la cabeza de quien la decidió.

**Qué pasa si ambos contienen lo mismo:** no es que se contradigan, es peor. El
Knowledge Graph pierde su razón de existir. Si `depends_on` describe los imports, es un
cache del código y siempre estará más obsoleto que el código. Y en cuanto el equipo
descubra que está obsoleto, dejará de confiar también en las partes que sí eran
conocimiento. **La pérdida de confianza no se reparte: se contagia.**

**El principio que lo evita** (P4), y es la frase más útil de esta revisión:

> El Knowledge Graph contiene afirmaciones que pueden estar **equivocadas**.
> El Code Graph contiene hechos que sólo pueden estar **desactualizados**.

Si un dato puede estar desactualizado pero no equivocado, no pertenece al Knowledge
Graph. Es un criterio que se aplica en cinco segundos a cualquier campo futuro.

---

## 6. Git

**La respuesta sigue siendo no**, y conviene explicar por qué las opciones tentadoras
fallan, para que nadie las reabra dentro de un año.

- *"Último commit y autor del componente"* — necesita un mapa fichero→entidad que no
  existe. Sin él, el dato no se puede colgar de ningún nodo.
- *"Ficheros relacionados por co-cambio"* — es un buen candidato para el Code Graph en
  M3, no para el compilador de contexto, y es estadístico, no determinista.
- *"El requisito se editó después del ADR que lo decide, luego la decisión puede estar
  obsoleta"* — no necesita mapa y es determinista, pero la señal es débil: editar la
  redacción de un requisito no invalida la decisión que lo gobierna. Produciría avisos
  que el equipo aprendería a ignorar, y un aviso ignorado es peor que ninguno.

**Lo único que Git aporta hoy sigue siendo una resta**: derivar `owner` y `created`, ya
recomendado. Git es la fuente de verdad de *cuándo y quién*, y `annona/` no debería
repetirlo. Eso no es una integración; es dejar de duplicar.

---

## 7. Context Compiler: tres ambigüedades más de trazabilidad

Además del campo `from` ya identificado, la misma raíz —el sistema sabe más de lo que
dice— produce tres huecos más:

**a. "¿Por qué *no* está X?" no tiene respuesta.** `excluded[]` sólo contiene lo
descartado por presupuesto. Lo que el plan de recorrido nunca alcanzó es invisible.
Ausencia por irrelevancia y ausencia por falta de espacio son cosas distintas y sólo
se reporta una. **Cambio mínimo: ninguno en código.** El plan de recorrido ya es
estático y declarado; basta con documentar que *la ausencia de un nodo que no está en
`excluded[]` significa que el plan no lo alcanza*, y publicar el plan junto al
contexto. La explicación ya existe, sólo no está dicha.

**b. `COMPLETE` no significa lo que su nombre sugiere.** Significa "los tipos exigidos
están presentes", no "se incluyó todo el conocimiento relevante". Es la sección 3.
**Cambio mínimo: definirlo por escrito** en el mismo sitio donde se define el veredicto.
No renombrarlo — el nombre es correcto para lo que hace; lo que falta es la frase.

**c. Dos identificadores sin roles escritos.** `contextId` identifica las *entradas*
(hash de sourceHash+tarea+presupuesto+retriever) y `hash` identifica la *salida* (hash
del texto). Son útiles para cosas distintas: `contextId` responde "¿es la misma
pregunta?", `hash` responde "¿es la misma respuesta?". Nadie lo ha escrito, y el
siguiente mantenedor que vea dos hashes eliminará uno. **Cambio mínimo: dos líneas de
comentario.**

---

## 8. Principios arquitectónicos

Cada uno elimina una ambigüedad observada, no una hipotética.

> **P1 — Conocimiento es lo que sigue siendo verdad cuando el código cambia.**
> Todo lo demás es estado, y el estado se guarda porque no hay más remedio, no porque
> pertenezca ahí.
> *Elimina:* la confusión de `status`, y frena `priority`, `assignee`, `sprint`.

> **P2 — Si un proceso determinista puede responder un dato, ese proceso es la fuente
> de verdad y el dato no se escribe a mano.**
> *Elimina:* `owner`, `created`, `test.status`, `depends_on`.

> **P3 — Annona nunca genera conocimiento humano, ni para repararse a sí misma.**
> Ante conocimiento ausente, avisa y se detiene. Nunca rellena el hueco.
> *Elimina:* la ambigüedad sobre la recuperación automática.

> **P4 — El conocimiento puede estar equivocado; los hechos derivados sólo pueden estar
> desactualizados. Si un dato no puede estar equivocado, no es conocimiento.**
> *Elimina:* el riesgo de que el Knowledge Graph se convierta en un cache del código.

> **P5 — `annona/` describe el sistema, no el equipo.**
> Una regla que un agente no puede violar escribiendo código no pertenece al grafo.
> *Elimina:* la mezcla de conocimiento de proceso y de ingeniería (RULE-0005).

> **P6 — Annona no trae conocimiento de fábrica.**
> El grafo contiene únicamente afirmaciones que alguien del equipo decidió.
> *Elimina:* la futura tentación de plantillas y reglas de ejemplo.

> **P7 — Un veredicto sólo puede afirmar lo que el sistema realmente comprobó.**
> `COMPLETE` significa "están los tipos exigidos", nunca "está todo lo relevante".
> *Elimina:* el veredicto que miente tras una pérdida parcial de conocimiento.

> **P8 — Todo lo que el compilador sabe sobre una decisión debe poder decirlo.**
> Si el sistema conoce el camino, el motivo o la alternativa y no lo expone, está
> pidiendo confianza ciega, que es lo que distingue a Annona de un embedding.
> *Elimina:* el campo `from` ausente, `excluded` incompleto, los dos identificadores.

Ocho principios. Cinco son restricciones sobre qué **no** hacer, que es la forma de un
sistema que quiere seguir siendo pequeño.

---

## 9. Dentro de cinco años, sin conocer a los creadores

### Qué les resultará ambiguo

**"¿Por qué ocho tipos de nodo y no nueve?"** El criterio de admisión —cada tipo debe
participar en el recorrido— existe pero no está en ningún sitio donde se lea antes de
añadir el noveno. Sin él, `epic`, `story`, `bug`, `risk` y `milestone` entrarán uno a
uno, cada uno con un argumento razonable, y el modelo se volverá un gestor de
proyectos.

**"¿Por qué no hay embeddings?"** Ésta es la que más presión recibirá, y llegará como
una petición de usuario legítima: "no encuentro nada con la búsqueda". La respuesta no
es que los embeddings sean malos, sino que el determinismo es el producto: si el
contexto deja de ser reproducible, `annona context diff` deja de funcionar, los fallos
de un agente dejan de ser reproducibles, y no queda nada que distinga a Annona de un
RAG. Eso no está escrito.

**"¿Qué significa COMPLETE?"** Ver sección 3. Alguien lo leerá como "el conocimiento
es suficiente" y construirá encima.

**"¿Por qué el estado vive junto al conocimiento?"** Sin P1, alguien lo "arreglará"
separándolo, partirá la entidad en dos ficheros y duplicará las relaciones.

**"¿Puede una herramienta escribir en `annona/`?"** `annona done` lo hace. La regla
—los comandos humanos sí, los agentes nunca— existe sólo como hábito.

**"¿Por qué el Core no llama al modelo?"** Parece una limitación arbitraria y es la
frontera del producto. Alguien añadirá una llamada "sólo para este caso".

### Qué conceptos se interpretarán distinto

- **"Conocimiento"** — sin P1 y P4, acabará significando "cualquier cosa útil sobre el
  proyecto", que es la definición que convierte a Annona en una wiki.
- **"Contexto"** — sin P8, acabará significando "el prompt", y entonces las mejoras
  serán de redacción en vez de trazabilidad.
- **"Runtime desechable"** — la telemetría ya lo contradice.
- **"Fricción"** — hoy significa "salirse del flujo previsto y anotarlo". Sin esa
  disciplina, el backlog volverá a llenarse de ideas de arquitectura.

### Qué falta para que el modelo siga siendo consistente

Los ocho principios de la sección 8, en el repositorio y no en un documento de
revisión, más tres criterios de admisión que hoy son implícitos:

1. **Un tipo de nodo entra sólo si participa en el recorrido del compilador.**
2. **Un campo entra sólo si supera P1 y P2.**
3. **Una herramienta MCP entra sólo si un agente no puede trabajar sin ella** — cada
   una es coste de tokens permanente en todas las sesiones.

---

## Resumen

Cinco hallazgos nuevos, ninguno requiere un subsistema:

1. **El veredicto miente tras una pérdida parcial de conocimiento** — borrar todos los
   ADRs deja todos los contextos en `COMPLETE`. Es el único mecanismo de confianza del
   producto y hoy puede afirmar algo falso.
2. **`test.status` es un hecho de otra herramienta** escrito a mano — el mismo error
   que `owner`, no detectado antes.
3. **`depends_on` es el segundo `touches`** y, a diferencia de `touches`, no tiene
   lectura humana legítima.
4. **RULE-0005 mezcla conocimiento de proceso con conocimiento de ingeniería**, y la
   distinción que falta no es producto/proyecto.
5. **Faltan tres explicaciones deterministas** que el compilador ya podría dar: por qué
   no está un nodo, qué garantiza el veredicto, y para qué sirve cada identificador.

De los cinco, **sólo el primero es urgente**: los demás cuestan mantenimiento, ése
cuesta confianza.
