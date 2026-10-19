# Reglas de las explicaciones de la graduación

Las frases que el paciente lee en «Mi receta» y las que el optómetra usa con «Explicar al paciente» salen de **un solo lugar**: `src/utilidades/graduacion.js`.
Cada rango tiene su prueba en `src/utilidades/graduacionReglas.test.js` (los límites de cada rango y la frase). Si cambias un rango, cambia esta tabla y esa prueba.

## Esfera (miopía e hipermetropía)
| Valor | Clasificación | Frase |
|---|---|---|
| de −0.25 a +0.25 | neutra | «Tu esfera es casi neutra: de lejos ves bien sin corrección en este ojo.» |
| −0.50 a −3.00 | miopía leve | «Tienes miopía leve: ves bien de cerca y un poco borroso de lejos.» |
| −3.25 a −6.00 | miopía moderada | «…de cerca ves bien y de lejos ves borroso sin tus lentes.» |
| más de −6.00 | miopía alta | «…de lejos ves muy borroso sin tus lentes.» |
| +0.50 a +2.00 | hipermetropía leve | «…ves bien de lejos, pero de cerca la vista se puede cansar.» |
| +2.25 a +5.00 | hipermetropía moderada | «…te cuesta enfocar de cerca y la vista se cansa con facilidad.» |
| más de +5.00 | hipermetropía alta | «…te cuesta ver bien de cerca y también de lejos sin tus lentes.» |

En el ojo izquierdo, si es del mismo tipo y nivel que el derecho, se compara: «igual que en el ojo derecho», «un poco / algo / bastante menor o mayor» (diferencia < 0.75, < 1.50, más).

## Cilindro (astigmatismo)
| Valor (sin signo) | Clasificación | Frase |
|---|---|---|
| menos de 0.25 | no hay | «No tienes astigmatismo en este ojo.» |
| 0.25 a 1.00 | leve | «Leve: algunas líneas se ven un poco estiradas.» |
| 1.25 a 2.00 | moderado | «Moderado: las líneas se ven estiradas o dobles sin tus lentes.» |
| más de 2.00 | alto | «Alto: sin tus lentes las líneas se ven muy estiradas o dobles.» |

Se añade «Tus lentes lo corrigen.» solo en el ojo derecho y solo si su agudeza con lentes es **completa** (20/20 o mejor).

## Adición (ayuda para ver de cerca)
| Valor | Clasificación | Frase |
|---|---|---|
| vacía o 0 | no hay | (no se dice nada) |
| +0.25 a +1.25 | baja | «Es una ayuda pequeña … para ver de cerca.» |
| +1.50 a +2.00 | media | «Es una ayuda media …» |
| más de +2.00 | alta | «Es una ayuda grande …» |

Con lente progresivo o bifocal la frase dice «que tus lentes progresivos / bifocales dan en la parte de abajo»; sin ellos, «para leer y ver de cerca».

## Agudeza visual (se lee por el denominador de «20/xx»)
| Agudeza | Clasificación | Frase |
|---|---|---|
| 20/20 o mejor (20/10, 20/15) | completa | «Ves con nitidez completa, como debe ser.» |
| 20/25 y 20/30 | casi completa | «Ves casi con toda la nitidez: te falta muy poco.» |
| 20/35 y 20/40 | buena | «Ves bien, aunque todavía no con toda la nitidez.» |
| 20/50 a 20/70 | disminuida | «Ves con menos nitidez de la normal: coméntalo con tu optómetra.» |
| 20/80 o peor | reducida | «Ves con poca nitidez: coméntalo con tu optómetra.» |

Error corregido (18 oct. 2026): 20/25 decía «nitidez completa». La visión completa es 20/20; 20/25 es casi completa.
