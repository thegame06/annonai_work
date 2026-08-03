# Infraestructura mínima de validación

Inventario de lo que hace falta para ejecutar el roadmap. Nada de esto es funcionalidad
de usuario. Todo se borra o se queda en `bench/` cuando la validación termine.

---

## Hallazgo previo: el golden dataset no sirve para H1

Comprobado sobre el repositorio: `bench/golden` contiene **83 ficheros YAML y cero
líneas de código**. Describe un sistema de pagos que no existe, sin `src`, sin tests,
sin nada ejecutable.

Eso significa que **no hay forma de puntuar si un agente resolvió la tarea**. El dataset
responde "¿recuperó Annona el conocimiento correcto?" —para eso tiene `expectations.json`—
pero no puede responder "¿el agente hizo el trabajo bien?", que es exactamente H1.

Segundo hallazgo relacionado: el brazo A del harness escribe la cadena literal
`'REPO-ONLY'` como prompt. Es un marcador de posición, no un brazo experimental.

**La alternativa mínima no es construir un dataset ejecutable.** Es usar el repositorio
de Annona, que ya tiene 12 tareas modeladas, código real y 8 ficheros de test:

> Se revierte el commit de una tarea ya cerrada, se pide al agente que la reimplemente,
> y **el oráculo es `npm test`**.

Sin dataset nuevo, sin criterio subjetivo, sin juez humano. Git y la suite de tests que
ya existen hacen de infraestructura. Es lo único que convierte H1 en ejecutable.

---

## 1. Inventario por hipótesis

| # | Herramientas necesarias | Ya existe | Falta | Cambio mínimo | Reutilizable en |
|---|---|---|---|---|---|
| **H1** | Dataset ejecutable, oráculo, runner de agente, contador de iteraciones | Harness con `--runner`, escritura de prompts, medición de tokens de entrada | Oráculo, dataset ejecutable, brazo A real, conteo de iteraciones y tokens de salida | Reutilizar el repo de Annona: `git revert` + `npm test` como oráculo. Sustituir la cadena `'REPO-ONLY'` por el contenido real | H7, H9 |
| **H2** | **Ninguna** | — | — | **Cero código.** Un protocolo escrito, 3 personas, un cronómetro | — |
| **H3** | Mutation Runner | Compilador, `bench context`, corpus golden | Borrar por clase, recompilar, comparar veredictos | ~40 líneas en `bench/` | H5 |
| **H4** | **Ninguna** | — | — | **Cero código.** 10 tickets ajenos y un recuento a mano | — |
| **H5** | Corpus Sampler | Compilador, `bench context`, corpus golden | Muestreo con semilla fija + clasificación de halts | ~30 líneas, comparte estructura con el Mutation Runner | H3 |
| **H6** | **Ninguna** | Telemetría, `annona metrics` | — | **Cero código.** No tocar la telemetría durante 4 milestones | — |
| **H7** | Runner de agente instrumentado | Lo mismo que H1 | Contar ficheros abiertos por el agente | Se obtiene gratis del brazo A de H1 si el runner registra lecturas | H1 |
| **H8** | Tokenizer Adapter | Tres copias de `length / 4` | Un tokenizador real y una comparación | ~30 líneas en `bench/`, sin tocar el Core | Todas las cifras |
| **H9** | Replay Engine | **Ya existe completo** | — | **Cero código.** Observar tras H1 | — |

**Cuatro de las nueve hipótesis no necesitan escribir una sola línea** (H2, H4, H6, H9).
Una de esas cuatro es crítica.

---

## 2. Componentes reutilizables

### Ya existen y no se tocan

| Componente | Estado | Sirve a |
|---|---|---|
| **Context Bench** (`bench context`) | Completo | H3, H5 |
| **Replay Engine** (`annona replay`) | Completo | H9 |
| **Telemetry** (`.annona/telemetry.jsonl` + `annona metrics`) | Completo | H6, H9 |
| **Corpus golden** (83 entidades + `expectations.json`) | Completo para recuperación | H3, H5, H7 |
| **Boundary/API checks en CI** | Completo | Todo |

### Faltan, por orden de coste

| Componente | Qué es | Coste | Sirve a |
|---|---|---|---|
| **Tokenizer Adapter** | Una función que tokeniza con un tokenizador real y compara contra la estimación. Vive en `bench/`, no en el Core | ~30 líneas | H8, y da la banda de error de todas las cifras |
| **Mutation Runner** | Borra una clase de entidad, recompila, recuenta veredictos | ~40 líneas | H3 |
| **Corpus Sampler** | Borra un % con semilla fija y clasifica halts en accionables o no | ~30 líneas, reutiliza el Mutation Runner | H5 |
| **Task Oracle** | Revertir un commit, ejecutar el agente, correr `npm test`, devolver pasa/falla | ~80 líneas | **H1**, H7 |
| **Agent Runner (completar)** | Brazo A real, conteo de iteraciones, tokens de salida, ficheros leídos | ~60 líneas sobre el esqueleto | **H1**, H7 |
| **Report Generator** | Agregar los JSON de cada corrida en una tabla comparable | ~40 líneas | Todos, **opcional** |

**Total: unas 280 líneas**, todas dentro de `bench/`, ninguna en el Core, ninguna en la
superficie pública.

El Report Generator es el único opcional: cada harness ya emite JSON y una hoja de
cálculo hace el mismo trabajo. No se construye hasta que exista una tercera corrida que
comparar.

---

## 3. Milestones de infraestructura

### I1 — Instrumentos de medida *(~70 líneas, desbloquea V1)*

**Tokenizer Adapter + Mutation Runner.**

Nada depende de un modelo, nada depende de terceros. Al terminar existen dos cifras: la
banda de error del estimador y el porcentaje de corpus que puede desaparecer sin que
ningún veredicto cambie.

Se construye primero porque el Tokenizer Adapter recalifica todas las cifras publicadas
y porque el Mutation Runner es la mitad del Corpus Sampler.

### I2 — Oráculo y runner *(~140 líneas, desbloquea V2)*

**Task Oracle + Agent Runner completado.**

El único milestone caro, y el único que necesita una clave de modelo. Consiste en:
elegir 10 tareas ya cerradas del repositorio de Annona, revertir sus commits en una copia
de trabajo, ejecutar los dos brazos y puntuar con la suite de tests existente.

No se escribe ningún dataset. No se escribe ningún juez. El oráculo es `npm test`.

### I3 — Muestreo *(~30 líneas, desbloquea V4)*

**Corpus Sampler**, que reutiliza el borrado del Mutation Runner cambiando el criterio
de selección.

Va después de I2 porque V4 va después de V2, y porque si H1 falla puede que V4 no se
ejecute nunca.

### Sin milestone

H2, H4, H6 y H9 no aparecen aquí porque no necesitan código. Es deliberado: **una
hipótesis crítica (H2) se valida sin escribir nada**, y meterla en un milestone de
infraestructura crearía trabajo que no existe.

---

## 4. ¿Qué es imprescindible para validar H1 y H2?

### Para H1 — cuatro capacidades, ninguna es un producto

1. **Un dataset ejecutable con oráculo objetivo.** No existe. La forma mínima es el
   propio repositorio de Annona: 12 tareas modeladas, código real, 8 ficheros de test.
   El oráculo es `npm test`; el escenario se genera con `git revert`.
2. **Un brazo A real.** Hoy escribe la cadena `'REPO-ONLY'`. Debe entregar al agente el
   repositorio sin conocimiento compilado y dejarlo buscar.
3. **Conteo de iteraciones y de tokens de salida.** Hoy sólo se miden tokens de entrada,
   y la afirmación de H1 es sobre el consumo total.
4. **Un contrato de runner.** Ya decidido por ADR-0006: un comando configurado que
   recibe un fichero de prompt. No se toca.

Nada de esto entra en el Core. Todo vive en `bench/` y se puede borrar después.

### Para H2 — ninguna

H2 se valida con un protocolo escrito, tres personas y un cronómetro. Las herramientas
que necesita —`annona init`, `check`, `context`, y los ficheros de instrucción
generados— ya existen y se usaron en el dogfooding.

**La asimetría merece decirse:** de las dos hipótesis que deciden si el producto existe,
una no requiere escribir código. Si el equipo pasa las próximas semanas construyendo
infraestructura, será por H1, nunca por H2. Y H2 se puede ejecutar **hoy, en paralelo**,
sin esperar a nada.

---

## 5. ¿Qué código no debería escribirse hasta validar H1 y H2?

Todo lo que sigue está decidido, especificado o pendiente, y **nada de ello ayuda a
responder una hipótesis existente**.

### Funcionalidades del roadmap — congeladas

| No construir | Por qué espera |
|---|---|
| Workflow Engine con guards | Ninguna hipótesis lo necesita |
| Providers (Jira, GitHub, ADO, Confluence) | Ninguna hipótesis lo necesita |
| Skills empaquetadas | Ninguna hipótesis lo necesita |
| Dashboard, incluido el inspector de contexto | H9 se observa con `replay`, que ya existe |
| CodeIntel / CodeGraph | Ninguna hipótesis lo necesita |
| Federación multi-repo | Ninguna hipótesis lo necesita |
| `propose` / `approve` | Ninguna hipótesis lo necesita |
| Plugin loader | Sin plugins que cargar |

### Correcciones de las revisiones conceptuales — también congeladas

Esta es la parte contraintuitiva, y es donde está la disciplina:

| No corregir todavía | Por qué |
|---|---|
| El campo `from` en el retriever | Sirve para depurar la sobre-recuperación. **Depurar antes de saber si importa es optimizar a ciegas.** H1 dirá si importa |
| La sobre-recuperación vía `depends_on` | Idéntico. Si H1 pasa con el compilador actual, el −43,7% de una tarea no era el problema |
| El veredicto que miente | **H3 lo mide; arreglarlo antes destruye el experimento**, porque el número que interesa es cuánto corpus desaparece sin que nadie se entere |
| Eliminar `owner`, `created`, `test.status`, `depends_on` | Correcto conceptualmente, irrelevante para las nueve hipótesis |
| Renombrar `annona/tests` y `annona/architecture` | Es fricción de onboarding: **H2 lo mide**. Arreglarlo antes elimina la señal |
| Sacar `RULE-0005` del grafo | Higiene, no incertidumbre |
| Los 3 puntos pendientes del freeze | Protegen la evolución a largo plazo de un producto que aún no se sabe si existe |

El caso de `annona/tests` es el más ilustrativo: es un defecto conocido, la corrección
cuesta dos minutos, y **corregirlo antes de H2 destruye la única oportunidad de medir
si un desconocido tropieza con él**. Un defecto conocido y no corregido es, en fase de
validación, un instrumento de medida.

### La regla

> Hasta que H1 y H2 estén respondidas, sólo se escribe código dentro de `bench/`.
> El Core, la CLI y el MCP no reciben ni una línea, salvo que un experimento demuestre
> que no puede ejecutarse sin ella.

Con esa regla, el trabajo pendiente son **280 líneas de infraestructura desechable**
frente a los varios miles que suman las funcionalidades congeladas.

---

## Resumen

| | |
|---|---|
| Código necesario para todo el roadmap | ~280 líneas, todas en `bench/` |
| Hipótesis que no requieren código | 4 de 9, incluida una crítica (H2) |
| Componentes que ya existen y bastan | Context Bench, Replay, Telemetría, corpus golden |
| Único milestone caro | I2 — oráculo y runner, unas 140 líneas y una clave de modelo |
| Bloqueo principal | El golden dataset no es ejecutable; el sustituto es el propio repositorio de Annona |
| Código a no escribir | Todo M2, el dashboard, y **todas las correcciones de las revisiones conceptuales** |
