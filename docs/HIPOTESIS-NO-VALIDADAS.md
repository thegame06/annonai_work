# Hipótesis no validadas

Inventario de lo que el modelo conceptual afirma y todavía no ha demostrado.
Ordenado por lo que cambiaría una decisión si resultara falso.

**Lo que sí está medido** (para no repetirlo): reducción de tokens frente a baseline
ingenuo (92,6%, 24 tareas) y frente a `grep` competente (37,6%, 10 tareas); tamaño de
contexto independiente del corpus (161 tokens con 110, 1.050 y 4.200 entidades);
determinismo (48 compilaciones, 0 divergencias); cero omisiones silenciosas en cuatro
presupuestos; latencia (`load` 17 ms constante, contexto 0,81 ms en frío); coste de
mantenimiento (1 línea de conocimiento por 9,4 de código; 17 ediciones manuales → 0);
consumo por un agente vía MCP con atribución de caller.

---

## H1 — Un agente rinde mejor con contexto compilado

**Hipótesis:** un agente que recibe 655 tokens de contexto compilado completa la tarea
igual o mejor que uno que recibe 1.193 tokens obtenidos por su cuenta.

**Evidencia existente:** ninguna sobre rendimiento. Sólo el coste de entrada de ambos
brazos. `annona bench agent` reporta `modelArmRun: false`.

**Evidencia que falta:** tasa de éxito, número de iteraciones, tiempo hasta el primer
parche correcto, y si el agente pide información adicional.

**Experimento mínimo:** las 10 tareas del golden dataset, dos brazos, un solo modelo,
tres repeticiones por brazo para absorber varianza. Criterio de éxito predefinido por
tarea (los tests del propio dataset pasan). Métricas: éxito, iteraciones, tokens
totales consumidos —no sólo los de entrada—, tiempo. Coste estimado: 60 ejecuciones.
El harness ya escribe ambos prompts en disco; falta una clave y `--runner`.

**Por qué es la primera:** si H1 es falsa, el resto del inventario es irrelevante.

---

## H2 — Alguien que no diseñó el esquema puede escribir conocimiento

**Hipótesis:** un ingeniero que no participó en el diseño puede modelar una feature
real y obtener un contexto `COMPLETE` sin ayuda.

**Evidencia existente:** cero. Los dos únicos corpus —el golden dataset y el propio
`annona/`— los escribí yo, que definí el esquema. Es un sesgo declarado en el informe
de M1.5.

**Evidencia que falta:** tiempo hasta el primer contexto `COMPLETE`, errores más
frecuentes, qué campos se malinterpretan, cuántas veces se consulta la documentación.

**Experimento mínimo:** 3 ingenieros, ninguno con contacto previo con el modelo. Una
feature real de su propio proyecto, 60 minutos, sólo el README y los ficheros de
instrucción generados. Medir: minutos hasta `COMPLETE`, errores de `check`, y cuántos
usan la carpeta como si determinara el significado (la trampa que ya me hizo tropezar).

**Por qué importa:** si sólo el diseñador puede poblar el grafo, el producto no es
adoptable, con independencia de H1.

---

## H3 — El veredicto es fiable

**Hipótesis:** `COMPLETE` indica que el agente tiene el conocimiento que la tarea
requiere.

**Evidencia existente: contraria.** Ya está demostrado que borrar `annona/adrs/` deja
todos los contextos en `COMPLETE`, porque un ADR nunca fue exigido. La hipótesis, en su
lectura fuerte, es **falsa**.

**Evidencia que falta:** el tamaño real del problema. No se sabe qué proporción del
conocimiento puede desaparecer sin que ningún veredicto cambie.

**Experimento mínimo:** testing por mutación sobre el golden dataset. Para cada clase
de entidad (adr, rule, test, term, component), borrarla por completo, recompilar y
contar cuántos de los 24 contextos cambian de veredicto. La salida es una tabla de
"porcentaje del corpus eliminable sin que el sistema se entere". Es determinista, no
necesita modelo y se ejecuta en minutos.

**Nota:** este experimento no valida la hipótesis, la acota. El resultado dice cuánto
vale hoy la palabra `COMPLETE`.

---

## H4 — Ocho tipos de nodo y ocho relaciones bastan para un dominio real

**Hipótesis:** el modelo expresa el conocimiento de ingeniería de cualquier proyecto
sin añadir tipos.

**Evidencia existente:** dos corpus (pagos y Annona), ambos escritos por mí, ambos
diseñados —consciente o inconscientemente— para encajar en el modelo. Es evidencia
circular.

**Evidencia que falta:** un dominio de terceros que nadie intentó adaptar.

**Experimento mínimo:** coger los últimos 10 tickets cerrados de un proyecto real
ajeno, modelarlos, y contar exclusivamente dos cifras: cuántos exigieron un tipo o
relación que no existe, y cuántos se pudieron expresar sólo forzando una relación a
significar algo distinto de su definición. La segunda cifra importa más que la primera,
porque es la que ya ocurrió con `RULE-0005` apuntando a un componente por no tener otra
arista disponible.

---

## H5 — El modelo funciona con conocimiento parcial

**Hipótesis:** un proyecto con el 30% de su conocimiento modelado obtiene valor, y los
halts son accionables en vez de ruido.

**Evidencia existente:** 100% de cobertura en dos proyectos donde el conocimiento se
escribió *primero* y *completo*. Es el caso más favorable posible y no representa a
ningún proyecto existente.

**Evidencia que falta:** la tasa de `COMPLETE` y, sobre todo, si los `MISSING_CONTEXT`
resultantes son accionables o simplemente frecuentes.

**Experimento mínimo:** tomar el golden dataset, eliminar el 70% de las entidades al
azar con semilla fija, ejecutar las 24 tareas y clasificar cada halt en accionable
—nombra algo concreto que falta— o inútil. Determinista, reproducible, sin modelo.
La métrica que decide es la proporción de halts accionables, no la cobertura.

---

## H6 — El coste de mantenimiento no crece con el tiempo

**Hipótesis:** mantener el grafo cuesta un esfuerzo constante por unidad de trabajo.

**Evidencia existente:** dos milestones, una persona, ediciones manuales de 17 → 0 tras
`annona done`. Es una medida puntual, no una tendencia.

**Evidencia que falta:** cualquier serie temporal. Dos puntos no describen una curva, y
el segundo se obtuvo justo después de construir la herramienta que lo reduce.

**Experimento mínimo:** ninguno nuevo — la telemetría ya lo registra. Basta con no
tocarla y publicar tres cifras por milestone: ediciones manuales en `annona/` por PR
aceptado, hallazgos de `doctor` por compilación y proporción de tareas cerradas con
`done` frente a a mano. Necesita cuatro milestones para tener una línea.

---

## H7 — El brazo de comparación es justo

**Hipótesis:** los 1.193 tokens del brazo `grep` representan lo que consume un agente
real sin Annona.

**Evidencia existente:** una simulación que asume que el agente greps con precisión,
nunca abre un fichero equivocado y se detiene tras dos rondas. Está declarado como cota
inferior.

**Evidencia que falta:** el comportamiento observado de un agente real leyendo un
repositorio.

**Experimento mínimo:** instrumentar una sola sesión real de un agente resolviendo tres
tareas del golden dataset sin Annona, contando ficheros abiertos y tokens leídos.
No hace falta que resuelva bien; sólo interesa cuánto lee. Si el número real supera al
simulado, el 37,6% es conservador y conviene saberlo antes de usarlo comercialmente.

---

## H8 — El estimador de tokens no distorsiona las conclusiones

**Hipótesis:** contar `caracteres / 4` produce las mismas conclusiones que un
tokenizador real.

**Evidencia existente:** ninguna. Se eligió por neutralidad de proveedor y porque ambos
brazos usan la misma fórmula.

**Evidencia que falta:** la banda de error. El conocimiento en YAML tiene mucha
puntuación e identificadores; el código tiene otra densidad. Si los dos brazos se
desvían de forma distinta, el 37,6% puede moverse.

**Experimento mínimo:** tokenizar el corpus golden y los 24 contextos con un
tokenizador real y comparar los ratios. Es la validación más barata del inventario
—una tarde— y afecta al número que se usará comercialmente.

---

## H9 — El determinismo tiene valor práctico

**Hipótesis:** que el contexto sea reproducible ayuda a depurar fallos de agente.

**Evidencia existente:** que *es* determinista, comprobado. Ninguna de que alguien se
haya beneficiado.

**Evidencia que falta:** casos reales donde `replay` o `context diff` localizaron la
causa de un fallo.

**Experimento mínimo:** ninguno hasta que exista H1. Cuando haya ejecuciones reales de
agente, registrar cuántos fallos se explicaron consultando la traza frente a cuántos se
diagnosticaron leyendo el código. Es observación, no experimento, y es la única
evidencia posible de que el determinismo es el producto y no una preferencia.

---

## Resumen

| # | Hipótesis | Estado | Coste del experimento |
|---|---|---|---|
| H1 | El agente rinde mejor | Sin evidencia | Alto: 60 ejecuciones + clave |
| H2 | Otros pueden escribir conocimiento | Sin evidencia | Medio: 3 personas, 1 hora |
| H3 | El veredicto es fiable | **Evidencia contraria** | Bajo: mutación, sin modelo |
| H4 | 8+8 tipos bastan | Evidencia circular | Medio: 10 tickets ajenos |
| H5 | Funciona con conocimiento parcial | Sin evidencia | Bajo: borrado con semilla |
| H6 | El mantenimiento no crece | Dos puntos, sin tendencia | Nulo: ya se registra |
| H7 | El baseline es justo | Simulado | Bajo: una sesión observada |
| H8 | El estimador no distorsiona | Sin evidencia | **Muy bajo: una tarde** |
| H9 | El determinismo sirve | Sin evidencia | Bloqueado por H1 |

**Cuatro son baratas y no necesitan modelo** (H3, H5, H7, H8). Las cuatro acotan
afirmaciones que ya se están usando para describir el producto.

**Dos deciden si el producto existe** (H1 y H2), y ninguna de las dos se puede
responder desde el repositorio.

**Una ya tiene evidencia en contra** (H3): la lectura fuerte de `COMPLETE` es falsa hoy,
y el experimento sólo sirve para medir cuánto.
