# Friction Log — M1.5

Every departure from the intended Annona workflow, recorded as it happened.
Each entry is a backlog candidate. Nothing here was invented from an architectural idea.

| # | When | Friction | Evidence | Disposition |
|---|---|---|---|---|
| 1 | before first task | Runtime cannot live on the mounted filesystem: `node:sqlite` fails with a raw `disk I/O error` | FUSE mount has no file locking | Fixed in M1: WAL fallback + a `CoreError` naming the cause. Still blocks working directly on network shares — accepted limitation, documented |
| 2 | TASK-0001 | Glossary terms rendered empty in generated instruction files and in every context | `definition` was never mapped into the runtime, so all 3 terms were dead weight | **Defect, fixed.** `toNode` maps a term's definition to its summary |
| 3 | TASK-0001 | Context repeats the same sentence twice for rules | `summary` and `body` both rendered with no overlap check | Backlog: dedupe when summary is a prefix of body. Wasted ~40 tokens per rule |
| 4 | TASK-0001 | Context pulled all 6 components when the task touches 2 | `depends_on` chains expand transitively to depth 3 | Backlog: measure before changing. Cost is ~300 tokens on a 937-token context |
| 5 | TASK-0001 | Fixed the term defect with no task in the knowledge base — bypassed the workflow to stay in flow | Defect found mid-task; creating a task first felt like ceremony | Recorded retroactively as TASK-0006. **Real signal:** the workflow has no cheap path for "bug found while doing something else". Backlog: `annona new task --from-context` |
| 6 | TASK-0001..0005 | `touches` was wrong on 3 of 5 tasks: work landed in components the task never declared | Discovered only when `doctor` reported untouched components | Backlog: `check` warning when a commit changes files mapped to components the active task does not touch. Needs CodeIntel (M3) |
| 7 | after implementing | 17 knowledge edits needed to resync statuses and relationships with reality | Every task said `ready`, every test said `pending`, after all were done | **The core maintenance cost.** Measured, not estimated. See report |
| 8 | throughout | Dev environment had to be copied out of the mounted folder to run at all | `node:sqlite` cannot lock on FUSE | Environment limitation, already documented |
| 9 | TASK-0011 | Built `annona done` so it marked tests `passing` — asserting a fact it had no evidence for | Contradicted REQ-0013 ("drift is detected, not assumed") in the same milestone that declared it | **Fixed.** `done` now reports which tests need review and changes no test status |
| 10 | TASK-0012 | The 92.6% token claim collapses to 37.6% against a competent repo-only agent, and is negative on 1 of 10 tasks | `annona bench agent`: TASK-0009 costs 638 tokens via Annona vs 444 by grepping | **Repositions the product.** Over-retrieval (friction 4) is no longer cosmetic — it decides whether Annona wins on small tasks |
| 11 | throughout | Each `annona done` runs in its own process, so every task got a different session id | `metrics` reports 8 sessions for one work stretch; `replay` shows 2-step timelines | Backlog: session id should derive from the task, not the process. ADR-0005 chose process-derived and dogfooding shows it wrong |
| 14 | workflow | La plantilla de instrucciones nombraba `annona search`, que no existe en la CLI (sólo como herramienta MCP) | Detectado al comparar la plantilla con la superficie real de comandos | **Corregido antes de generar.** Nuevo test falla si la plantilla nombra cualquier comando o herramienta inexistente |
| 15 | workflow | Los marcadores `{PROJECT}` y `{PREAMBLE}` salieron literales en los ficheros generados | Error de escapado al construir la plantilla | **Corregido.** Un test compara los cuatro ficheros de vendor y verifica que sólo difieren en el preámbulo |
| 16 | workflow v2 | La misión pedía que Discovery inspeccionase CodeGraph y que el Context Compiler combinase conocimiento + CodeGraph + Git | Ninguna de las dos existe: no hay implementación de CodeIntel y el compilador sólo lee el grafo de conocimiento | **No se prometió.** La plantilla dice que Annona aporta intención y que estructura e historia las reúne el agente con sus propias herramientas. Test nuevo falla si la plantilla promete CodeGraph |
| 17 | workflow v2 | Los tests de la plantilla fallaban por el ajuste de línea, no por el contenido | `already recorded tells the / developer you did not look` parte la frase en dos líneas | **Corregido** normalizando espacios antes de comparar, en lugar de debilitar la aserción |
| 18 | environment-aware | La plantilla acoplaba Discovery a herramientas concretas: `git log` como comando y 5 menciones a Git | Contradice "el entorno determina las herramientas, no las instrucciones" | **Corregido.** Discovery habla de niveles de conocimiento, no de herramientas. Dos tests nuevos: ninguna herramienta de terceros nombrada, y todo comando en backticks debe ser `annona` |
| 19 | environment-aware | **El test negativo dio un falso PASS**: inyecté `git log` en la plantilla y la suite siguió en verde | La cadena de inyección no coincidía con la línea real (faltaba el prefijo `3. `), así que no se inyectó nada | **Detectado y repetido.** Con la inyección real, saltan las dos guardas con el mensaje correcto. Un test negativo que no se verifica no prueba nada |
| 20 | H5 | La métrica de "halt accionable" devolvía 100% por construcción: no podía fallar | Todos los `MissingItem` contienen un id o un nombre de relación, y la definición aceptaba cualquiera de los dos | **Redefinida** en dos niveles antes de publicar nada. Tercer caso del mismo error en el proyecto: comprobaciones que no pueden fallar |

## Onboarding (recorrido real desde un repositorio vacío)

| # | Fricción | Evidencia | Disposición |
|---|---|---|---|
| 21 | **No hay forma de instalar Annona.** El paquete raíz es privado y no está en npm; hay que clonar y ejecutar con `node --experimental-strip-types` | Comprobado en un directorio vacío | **Registrada, no corregida.** Es la primera barrera que encontrará cualquier desarrollador nuevo |
| 22 | `annona init` dice "next: annona compile", pero compilar un proyecto vacío da `0 entities` y ninguna pista de qué hacer después | El recorrido se queda sin camino tras el paso 2 | **Registrada.** Documentado como paso 4 en Getting Started, no corregido en el producto |
| 23 | `annona compile` en un proyecto vacío responde `(unchanged)` en la primera ejecución | No había nada previo que pudiera estar "sin cambios" | **Registrada.** Confuso en el primer uso |
| 24 | `annona init` deja `name: untitled` y ese nombre encabeza los cuatro ficheros de agente | `# untitled` en CLAUDE.md | **Registrada.** Documentado como aviso explícito en Getting Started |
| 25 | Para la primera tarea compilable hacen falta **4 ficheros YAML escritos a mano** si no hay agente delante | feature + requirement + component + task | **Registrada.** Es el coste de arranque real, no un defecto en sí |

**Ninguna corregida.** Cinco fricciones de onboarding en un recorrido de quince minutos,
todas antes de escribir una sola línea de código de producto. Se revisarán al final del
Validation Sprint, según el criterio de evidencia repetida.
| 26 | onboarding | El tutorial ponía "escribir cuatro YAML a mano" como paso 4, dando a entender que ése es el uso normal | Revisión de Bladimir sobre la documentación | **Corregido.** El flujo con agente pasa a ser el camino principal; el YAML se muestra como *lo que el agente escribió*. Nota: eso mueve al frente el único camino que nadie ha ejecutado de principio a fin |
