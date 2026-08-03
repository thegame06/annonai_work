# Evidencia — H8 y H3

Dos hipótesis ejecutadas. Ninguna necesitó modelo. Ambas cambian lo que se puede
afirmar sobre el producto.

Reproducir: `node --experimental-strip-types bench/h8-agentarms.ts <dataset>` y
`bench/h3-mutation.ts <dataset>`.

---

## H8 — el estimador de tokens: **FALLA**, y a favor

**Hipótesis:** contar `caracteres / 4` produce las mismas conclusiones que un
tokenizador real.

**Resultado: falla las dos condiciones de fracaso definidas en el roadmap.**

| Brazo | Estimado | Real (cl100k_base) | Error |
|---|---|---|---|
| A — agente con `grep` | 11.907 | 12.043 | **−1,1%** |
| B — contexto de Annona | 6.548 | 5.377 | **+21,8%** |

Las dos condiciones de fracaso se cumplen: el ratio se mueve más de 10 puntos **y** los
brazos se desvían en direcciones opuestas.

**La cifra publicada estaba subestimada:**

| Agregación | Con `chars/4` | Con tokenizador real |
|---|---|---|
| Media por tarea (como se publicó) | 37,5% | **49,0%** |
| Ratio agregado | 45,0% | **55,4%** |

**Por qué ocurre:** el contexto compilado es texto estructurado y denso en
identificadores (`REQ-0001 [requirement/accepted]`), que un tokenizador real comprime
bien. El corpus YAML es más prosa. `chars/4` penaliza sistemáticamente el formato de
salida de Annona, es decir, **el estimador estaba sesgado en contra del producto**.

**Lo que no cambia:** TASK-0009 sigue siendo la única tarea donde Annona cuesta más que
`grep`, aunque el margen se reduce de −43,4% a −20,1%. La sobre-recuperación sigue
siendo real; es menos grave de lo medido.

**Decisión de producto:** todas las cifras publicadas se recalculan con tokenizador
real. La comparación honesta frente a un agente competente es **49%**, no 37,6%. El
estimador se mantiene en el Core —es determinista y neutral respecto al proveedor— pero
ninguna cifra comercial vuelve a salir de él.

---

## H3 — qué vale la palabra COMPLETE: **el 24,4% del corpus puede desaparecer en silencio**

**Hipótesis:** `COMPLETE` indica que el agente tiene el conocimiento que la tarea
requiere.

**Método:** borrar una clase de entidad completa, recompilar, contar cuántos de los 24
contextos cambian de veredicto.

| Clase | Entidades borradas | Veredictos cambiados | Tokens perdidos | ¿Silencioso? |
|---|---|---|---|---|
| `adr` | 6 | **0 / 24** | 7,6% | **sí** |
| `rule` | 6 | **0 / 24** | **27,5%** | **sí** |
| `test` | 8 | **0 / 24** | 3,2% | **sí** |
| `term` | 4 | 0 / 24 | 0% | no (no aporta tokens) |
| `component` | 8 | 24 / 24 | 60% | no |
| `requirement` | 18 | 24 / 24 | 33,7% | no |
| `feature` | 8 | 24 / 24 | 10,8% | no |

**El caso peor es `rule`:** se pueden borrar las seis reglas del proyecto, el contexto
pierde el **27,5%** de su contenido, y los 24 contextos siguen diciendo `COMPLETE`. Un
agente recibiría un contexto sin ninguna restricción de ingeniería y el sistema le
diría que está completo.

**Criterio del roadmap:** éxito si ≤20% del corpus puede desaparecer sin que cambie
ningún veredicto; fracaso si >50%.

**Resultado: 24,4%.** No pasa el criterio de éxito, no llega al de fracaso. Es la zona
intermedia, y lo que la hace preocupante no es el porcentaje sino *qué* está dentro:
decisiones, reglas y verificaciones, es decir, exactamente el conocimiento que ninguna
herramienta puede reconstruir.

**Decisión de producto:** `COMPLETE` deja de usarse como argumento de confianza en
documentación y en cualquier material comercial. Significa "están presentes los tipos
exigidos: requisito, feature y componente" y así debe escribirse allí donde se emite.

**Lo que NO se hace ahora:** cambiar el compilador para exigir reglas o ADRs. Eso es un
cambio del Core y la política exige evidencia de que el problema afecta al resultado.
Hoy sólo hay evidencia de que el veredicto es más débil de lo que su nombre sugiere. Si
H1 muestra que los agentes fallan por falta de reglas, entonces habrá evidencia; hasta
entonces, medido y documentado.

---

## Estado de las nueve hipótesis

| # | Estado |
|---|---|
| H1 | **Bloqueada:** harness construido y verificado, falta clave de modelo |
| H2 | **Ejecutable hoy:** protocolo en `bench/H2-PROTOCOL.md`, no requiere código |
| **H3** | **Ejecutada** — 24,4% del corpus desaparece en silencio |
| H4 | Pendiente, necesita un proyecto ajeno |
| H5 | Pendiente, barata, sin modelo |
| H6 | En observación, la telemetría ya la registra |
| H7 | Bloqueada con H1 |
| **H8** | **Ejecutada** — falla; las cifras se recalculan al alza |
| H9 | Bloqueada por H1 |

**Dos hipótesis menos de incertidumbre, cero funcionalidades nuevas, cero cambios en el
Core.**

---

## Fricción registrada

| # | Fricción | Evidencia | Disposición |
|---|---|---|---|
| 12 | El veredicto de H8 sólo comprobaba una de las dos condiciones de fracaso definidas | La condición que falló —direcciones opuestas— no estaba implementada | **Corregido** en `bench/h8-tokenizer.ts`. Un criterio a medio implementar habría dado un PASS falso |
| 13 | El dataset golden vive en `bench/golden` pero `expectations.json` estaba fuera de la carpeta esperada por los scripts | Dos rutas distintas en dos harnesses | Backlog: unificar. Coste bajo, sin urgencia |
