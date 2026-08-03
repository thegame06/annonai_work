# Evidencia — H5: conocimiento parcial

Reproducir: `node --experimental-strip-types bench/h5-partial.ts bench/golden <borrado%> <semilla>`

**Resultado: FALLA.** Con conocimiento parcial los halts nunca dicen qué arreglar,
sólo qué forma tiene lo que falta.

---

## Lo medido

Borrado determinista del corpus golden, tareas borradas excluidas (no se puede
preguntar por una tarea que no tienes).

| Borrado | Corpus | Tareas | COMPLETE | Halts/tarea | Específicos | Estructurales | Ruido |
|---|---|---|---|---|---|---|---|
| 0% | 82 | 24 | **100%** | 0,0 | 0 | 0 | 0 |
| 30% | 55 | 17 | 35,3% | 1,2 | **0** | 21 | 0 |
| 50% | 41 | 14 | **0%** | 1,9 | **0** | 26 | 0 |
| 70% | 26 | 11 | **0%** | 2,2 | **0** | 24 | 0 |
| 90% | 8 | 3 | **0%** | 2,7 | **0** | 8 | 0 |

Estable entre semillas: cinco semillas a 70% dan entre 0% y 12,5% COMPLETE y entre
2,0 y 2,5 halts por tarea.

## El hallazgo

**A partir del 50% de borrado, ninguna tarea compila un contexto completo.** No es
degradación gradual: es un acantilado. Entre el 30% y el 50% se pasa de un tercio de
tareas utilizables a ninguna.

Y **cero halts específicos en todos los niveles**. Todos los halts son de la forma:

```
TASK-0001 implements no requirement
no feature governs this work
```

Dicen la *forma* de lo que falta —hay que declarar un `implements`— pero nunca
*hacia qué*. El desarrollador sabe que falta un requisito; no sabe cuál, ni si
existe y perdió el enlace, ni si hay que escribirlo.

Contra el criterio fijado en el roadmap (éxito ≥80% accionables, fracaso <50%): **0%
específicos. Falla.**

## Corrección de una métrica degenerada

La primera definición contaba un halt como accionable si `searched` contenía un id
**o** un nombre de relación. Todos los `MissingItem` que el compilador puede emitir
contienen uno u otro, así que la métrica devolvía 100% por construcción y no medía
nada. Salió PASS en la primera ejecución.

Sustituida por dos niveles: **específico** (nombra un id concreto) frente a
**estructural** (nombra sólo la relación). Con la definición corregida, el resultado
se invierte por completo.

Es el tercer caso en este proyecto del mismo error: una comprobación que no puede
fallar. Los otros dos fueron el veredicto de H8, que sólo miraba una de sus dos
condiciones de fracaso, y el test negativo del workflow, que daba verde porque la
inyección no se aplicaba.

## Qué significa para el producto

**Annona no está diseñado para brownfield hoy, y el modo de fallo no es el que se
suponía.** No es que dé contexto pobre: es que se niega a dar contexto, para todas
las tareas, en cuanto falta la mitad del conocimiento. Eso es correcto según el
principio de no inventar, y es inutilizable como primera experiencia.

Un equipo que instale Annona sobre un proyecto existente verá `MISSING_CONTEXT` en
todo hasta haber modelado el grafo casi entero. Es exactamente el coste inicial que
la validación tenía que descubrir.

## Lo que NO se hace ahora

No se toca el compilador. Bajo Product Validation Mode, esto es una medición, no un
mandato. Las opciones posibles —halts que sugieran candidatos, o un modo degradado
que compile con lo que haya— son implementación y necesitan que H1 diga primero si
un agente rinde mejor con contexto compilado. Si H1 falla, esta limitación es
irrelevante.

## Lo que sí cambia hoy

Una afirmación. Annona funciona sobre proyectos cuyo conocimiento se escribe desde el
principio. Sobre un proyecto existente, el coste de entrada es modelar la mayor parte
del grafo antes de obtener el primer contexto útil, y conviene decirlo antes de que
alguien lo descubra instalándolo.
