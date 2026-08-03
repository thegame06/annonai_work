# Revisión conceptual — ambigüedades, no funcionalidades

Revisión sobre el estado real del repositorio: 64 entidades, 65 relaciones declaradas,
3.262 líneas de código, 53 tests.

Ninguna recomendación añade un subsistema. Cinco de las ocho son **quitar** algo o
**escribir una frase**. Una sola añade un campo.

---

## 1. Workspace: qué es realmente `annona/`

**Respuesta corta: es conocimiento humano, y sólo eso.** No es configuración, no es
estado, no es cache, no es una base de datos.

| Pregunta | Respuesta |
|---|---|
| ¿Qué representa? | Afirmaciones que una persona decidió sobre el proyecto |
| ¿Es conocimiento? | Sí, exclusivamente |
| ¿Es configuración? | No. La configuración es `annona.yaml` (2 líneas: `format`, `name`) |
| ¿Es estado? | **Parcialmente, y ahí está la ambigüedad** — ver abajo |
| ¿Es cache? | No |
| ¿Es base de datos? | No. La base de datos es `.annona/runtime.db`, generada |
| ¿Es una mezcla? | Sí, de dos cosas que conviene distinguir |

**La ambigüedad real: `status` es estado, no conocimiento.**

`status: ready → done` cambia constantemente y no expresa ninguna decisión de
ingeniería. Está mezclado en el mismo fichero que `implements`, `decides` o el cuerpo
de un ADR, que son afirmaciones estables y valiosas. Consecuencia práctica ya medida:
en M1.5 hicieron falta 17 ediciones manuales, casi todas para mover estados.

No propongo separarlo en otro fichero — eso partiría la entidad en dos y sería peor.
Propongo **nombrarlo**: `annona/` contiene *afirmaciones estables* y *un campo de
estado por entidad*. Es la única parte volátil, y es la que `annona done` toca.

**Segunda ambigüedad, menor pero confusa: dos carpetas mal nombradas.**

- `annona/tests/` no contiene tests, contiene *entidades* de tipo `test` que
  describen qué verifica qué. Los tests reales viven en `packages/*/test/`. Un
  desarrollador nuevo abre `annona/tests/` esperando código.
- `annona/architecture/` contiene entidades de tipo `component`. El nombre de la
  carpeta y el `kind` no coinciden.

**Cambio mínimo:** renombrar a `annona/verification/` y `annona/components/`, y añadir
tres líneas al README diciendo que la carpeta es organizativa y que el `kind` del
fichero es lo único que manda. Coste: dos `git mv`. Beneficio: se elimina la única
trampa de onboarding que el propio dogfooding detectó (fricción 6, cuando asumí que la
carpeta indicaba propiedad).

---

## 2. Fuente de verdad por tipo de información

| Información | Quién la genera | Quién la modifica | ¿Regenerable? | ¿Versionar? | Si desaparece |
|---|---|---|---|---|---|
| Features | Persona | Persona | **No** | Sí | Se pierde el porqué del producto |
| Requirements | Persona | Persona | **No** | Sí | Se pierde qué debe cumplirse |
| ADR | Persona | Persona (sólo `supersedes`) | **No** | Sí | Se pierden las decisiones y sus motivos. Lo más caro |
| Componentes | Persona hoy; derivable en parte | Persona | Parcial | Sí | Recuperable aproximadamente desde la estructura de directorios |
| Tareas | Persona | Persona + `annona done` | Parcial | Sí | Recuperables aproximadamente desde commits |
| Reglas | Persona | Persona | **No** | Sí | Se pierden las convenciones del equipo |
| Glosario | Persona | Persona | **No** | Sí | Se pierde el vocabulario del dominio |
| **Relaciones (65)** | Persona | Persona | **No** | Sí | **Lo más valioso y lo menos recuperable** |
| Telemetría | Herramienta | Nadie (append-only) | **No** | **No** | Se pierde el historial de ejecuciones. Ver ambigüedad 2 |
| `runtime.db` | `annona compile` | Nadie | Sí | No | Nada. Se reconstruye |
| Ficheros de agente | `annona compile` | Nadie | Sí | No | Nada |
| Code Graph | Herramienta (M3) | Nadie | Sí | No | Nada |

**El hallazgo:** las 65 relaciones son el activo real. Un ADR sin la arista `decides`
es un documento suelto; con ella es conocimiento consultable. Y son exactamente lo que
ninguna herramienta puede deducir.

**Contradicción encontrada:** la telemetría es información **no reconstruible**
guardada en la zona **desechable**. La arquitectura afirma que borrar `.annona/` no
pierde información; con telemetría dentro, eso es falso. Ver ambigüedad 2.

---

## 3. `rm -rf annona/` — qué se pierde exactamente

### Reconstruible (aproximadamente, nunca igual)

| Qué | Desde dónde | Calidad de la reconstrucción |
|---|---|---|
| Componentes | Estructura de directorios, ficheros de build | Buena para el *qué*, nula para el *por qué* |
| Entidades `test` | Ficheros de test reales | Buena |
| Tareas | Historial de commits, mensajes | Pobre: se recupera qué se hizo, no qué se pretendía |
| `created`, `owner` | `git log --follow` | **Mejor que el fichero**, ver sección 5 |
| Estados | Inferibles del código y los tests | Aproximada |

### No reconstruible — sólo existe porque alguien lo escribió

| Qué | Cantidad hoy | Por qué es irrecuperable |
|---|---|---|
| ADR: contexto y alternativas descartadas | 6 | El código muestra la opción elegida, nunca las rechazadas ni el motivo |
| Requirements | 14 | El código muestra el comportamiento, no la obligación ni sus límites |
| Intención de las features | 5 | El problema de negocio no está en ningún fichero fuente |
| Reglas | 6 | Una convención respetada es invisible; se nota sólo cuando se rompe |
| Glosario | 6 | El vocabulario del dominio no está definido en el código |
| **Relaciones** | **65** | Ninguna herramienta deduce que ADR-0001 gobierna REQ-0001 |

**Veredicto: el diseño protege correctamente lo valioso.** Todo lo no reconstruible
vive en Git como texto plano, revisable en un PR, sin formato propietario. Si Annona
desaparece mañana, el conocimiento sigue siendo legible con `cat`.

**Pero hay un agujero concreto:** no existe copia ni verificación de que `annona/`
esté completo. `annona check` valida las cinco invariantes, no la existencia. Si
alguien borra `annona/adrs/` y hace commit, `check` pasa: sin ADRs no hay referencias
rotas. Ver ambigüedad 4.

---

## 4. Knowledge Graph frente a Code Graph

**La separación conceptual es correcta y hoy no hay mezcla.** El Code Graph no está
implementado (M3), y el Core no lo importa. Verificado por la regla de fronteras en CI.

| | Knowledge Graph | Code Graph |
|---|---|---|
| Origen | Afirmación humana | Derivación automática |
| Verdad | Lo que *debe* ser | Lo que *es* |
| Regenerable | No | Sí |
| Si discrepan | — | **La discrepancia es la señal** |

**Sin duplicación hoy. Con un riesgo concreto mañana:** `touches` (tarea → componente)
es una declaración humana de intención. Cuando llegue el Code Graph podrá decir qué
ficheros cambió realmente un commit. Son la misma pregunta desde dos lados.

Ya se observó el problema en M1.5: `touches` estaba mal en 3 de 5 tareas y sólo lo
detectó `doctor`, después.

**Cambio mínimo, y es una frase, no código:** dejar escrito que `touches` es
*intención declarada* y el Code Graph es *hecho observado*, que **el Code Graph nunca
escribe `touches`**, y que una divergencia se reporta en `doctor` como hallazgo, jamás
se corrige automáticamente. Sin esa frase, el primer instinto en M3 será
"autocompletar `touches`", y ese día el Knowledge Graph deja de ser conocimiento
humano y se convierte en un cache del código.

**Dependencias innecesarias: ninguna.** `CodeIntel` es una interfaz de un método y hoy
es interna, sin consumidor. Correcto.

---

## 5. Git: la información mínima que sí aporta

**Respuesta honesta: hoy, ninguna integración de Git mejora la calidad del contexto**,
porque no existe un mapa de ficheros a entidades. Sin ese mapa, "último commit" no se
puede asociar a ningún nodo, y el dato no es accionable.

Recomendar aquí "añadir autor y último commit al contexto" sería exactamente la
propuesta bonita que no resuelve un problema real.

**Lo que sí aporta valor es lo contrario: quitar dos campos.**

`created` y `owner` aparecen 48 veces en las entidades. Git ya los conoce, con más
precisión y sin poder mentir:

```
git log --diff-filter=A --format='%aI %an' -- annona/adrs/ADR-0001.yaml
```

Un campo `owner` en YAML se queda obsoleto en cuanto alguien cambia de equipo, y nadie
lo actualiza. `git log` no puede desincronizarse.

**Cambio mínimo:** marcar `created` y `owner` como opcionales y deprecados en el
envelope, y que `annona get` los derive de Git cuando falten. No romper nada
existente: los ficheros que ya los tienen siguen funcionando. Es aditivo y elimina 48
puntos de deriva.

**Cuando exista el Code Graph** (M3, no antes), el único dato de Git con valor claro
es la **frecuencia de co-cambio** entre ficheros de un componente: responde "¿esta
parte está viva?". No lo implementes ahora; no hay dónde colgarlo.

---

## 6. Context Compiler: ¿puede explicar por qué incluyó cada elemento?

**Casi. Y el "casi" es el hallazgo más importante de esta revisión.**

Hoy cada nodo incluido reporta:

```json
{ "id": "RULE-0001", "via": "constrains", "depth": 2, "layer": "L3" }
```

Eso dice **por qué tipo de relación** y **a qué distancia**. No dice **desde qué
nodo**. La cadena que pediste —

```
Task → Feature → Component → Files
```

— no es reconstruible sin ambigüedad. Con dos componentes en el contexto, `RULE-0001
via constrains depth 2` no permite saber cuál de los dos la arrastró. La traza se
puede *adivinar*, y adivinar es justo lo que Annona existe para evitar.

**Por qué importa de verdad:** es el mecanismo para depurar la sobre-recuperación que
el benchmark de agente reveló (−43,7% en TASK-0009). Sin saber qué nodo arrastró a
cuál, no se puede decidir qué podar. Y de cara al usuario, un contexto que no puede
justificar su propio contenido pide la misma confianza ciega que un embedding.

**Cambio mínimo: un campo.**

```ts
export type Ref = { id: NodeId; via: EdgeKind | 'seed'; depth: number; from: NodeId };
```

El retriever ya conoce `src` en el momento de descubrir cada nodo — sólo lo descarta.
Propagarlo a `IncludedNode` hace la cadena completa reconstruible encadenando `from`
hasta la semilla. Determinista, sin heurística, sin IA. Aproximadamente diez líneas.

Con eso, `annona context --explain` es un recorrido del array ya existente:

```
RULE-0001  constrains ← CMP-0004  touches ← TASK-0024 (seed)
```

---

## 7. Ambigüedades priorizadas

Ordenadas por coste si no se resuelven.

### 1. El contexto no puede justificar su propio contenido — **alta**

- **Duda:** ¿desde qué nodo entró cada elemento al contexto?
- **Problema:** sin la cadena no se puede podar la sobre-recuperación (ya cuesta
  perder contra `grep` en 1 de cada 10 tareas), ni responder "¿por qué me diste esto?".
  Es la diferencia entre trazabilidad y confianza ciega.
- **Cambio mínimo:** añadir `from: NodeId` a `Ref` y a `IncludedNode`. ~10 líneas.

### 2. La telemetría es no reconstruible y vive en la zona desechable — **alta**

- **Duda:** ¿es `.annona/` realmente desechable?
- **Problema:** la arquitectura afirma que borrarlo no pierde información. Con la
  telemetría dentro es falso, y todas las métricas de M1.5 y M1.6 salen de ahí. Un
  `annona compile --clean` no la borra hoy, pero nada lo impide y nadie lo ha escrito.
- **Cambio mínimo:** reconocer **tres** categorías en vez de dos — verdad versionada,
  runtime reconstruible, y observabilidad desechable-pero-no-reconstruible — y dejar
  escrito que borrar `.annona/` pierde el historial y sólo eso. Un párrafo. La
  alternativa (versionar la telemetría) contamina el conocimiento con datos generados
  y sería peor.

### 3. `status` es estado mezclado con conocimiento — **media**

- **Duda:** ¿`annona/` es conocimiento o también estado?
- **Problema:** es el 100% del coste de mantenimiento medido (17 ediciones). Al no
  estar nombrado como algo distinto, cada nueva idea de flujo de trabajo tenderá a
  añadir más campos volátiles junto a los estables.
- **Cambio mínimo:** documentar que `status` es el único campo volátil y que sólo
  `annona done` debería tocarlo. Una frase en el README. **No** separar ficheros.

### 4. Nada verifica que `annona/` esté completo — **media**

- **Duda:** ¿cómo sé que no falta conocimiento que existía?
- **Problema:** borrar `annona/adrs/` y hacer commit pasa `check` sin error. El activo
  irrecuperable no tiene red de seguridad.
- **Cambio mínimo:** que `check` avise si el número de entidades por `kind` cae
  respecto a `build_meta` de la compilación anterior. Un aviso, nunca un error
  bloqueante. Reutiliza tablas existentes.

### 5. `touches` frente al Code Graph — **media (explota en M3)**

- **Duda:** cuando el Code Graph sepa qué cambió de verdad, ¿quién manda?
- **Problema:** el instinto será autocompletar `touches`, y ese día el Knowledge Graph
  se convierte en un cache del código en lugar de conocimiento humano.
- **Cambio mínimo:** escribir la regla ahora — `touches` es intención, el Code Graph es
  hecho, la divergencia se reporta y jamás se autocorrige.

### 6. Carpetas cuyo nombre no coincide con su contenido — **baja**

- **Duda:** ¿`annona/tests/` contiene tests?
- **Problema:** confunde en el onboarding y refuerza la idea falsa de que la carpeta
  determina el significado. Ya me hizo tropezar durante el dogfooding.
- **Cambio mínimo:** `git mv` a `verification/` y `components/`, y una frase diciendo
  que la carpeta es organizativa.

### 7. `created` y `owner` duplican a Git — **baja**

- **Duda:** ¿cuál gana cuando discrepan?
- **Problema:** 48 apariciones que envejecen en silencio. Nadie actualiza `owner` al
  cambiar de equipo.
- **Cambio mínimo:** marcarlos opcionales y derivarlos de `git log` cuando falten.
  Aditivo, no rompe nada.

### 8. `annona done` escribe en la fuente de verdad — **baja, pero conviene escribirlo**

- **Duda:** ¿puede una herramienta modificar `annona/`?
- **Problema:** la arquitectura dice que los agentes no escriben conocimiento
  autoritativo. `done` sí escribe. Es correcto —lo invoca una persona— pero no está
  dicho en ningún sitio, y el siguiente comando que quiera escribir no tendrá criterio.
- **Cambio mínimo:** una frase: los comandos invocados por humanos pueden escribir en
  `annona/`; los agentes, nunca, y por eso no existe herramienta MCP de escritura.

---

## Resumen

De ocho ambigüedades, **una necesita código** (~10 líneas, el campo `from`), **una
necesita un `git mv`**, y **seis se resuelven escribiendo frases** que hoy sólo existen
en la cabeza de quien diseñó el sistema.

Eso es una señal buena sobre la arquitectura: los conceptos son correctos, lo que falta
es hacerlos explícitos antes de que el equipo crezca. Las dos altas comparten causa —
el sistema sabe más de lo que dice — y las dos merecen resolverse antes de M2.
