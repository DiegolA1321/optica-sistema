-- 0133 · La receta del portal con lo nuevo de la ficha clínica de cinco pasos
-- Pedido de Diego (19 oct. 2026): la ficha ahora guarda la agudeza «con la receta nueva», la adición por ojo, la distancia pupilar de cada ojo y de cerca, y el prisma por ojo, y la receta del portal («Mi receta»,
-- «Cómo ves con tus lentes», «Descargar receta») debe usarlos. Como el portal solo recibe lo que `consulta_para_paciente` le entrega (migración 0107), hay que agregarlos ahí.
--
-- Qué cambia (solo esa función; misma firma y mismo tipo de retorno => no se crea otra versión):
--   · od y oi: además de esfera, cilindro, eje, avSc y avCc, ahora avRx (con la receta nueva) y las letras falladas de cada agudeza (avScF, avCcF, avRxF).
--   · medidas: además de adicion, avCerca, dp y alt, ahora adicionOd, adicionOi, avCercaRx, dpOd, dpOi, dpCerca y el prisma de cada ojo (prismaOdCant/Base, prismaOiCant/Base).
--   · La política «mostrar medidas» sigue igual: la distancia pupilar (total, de cada ojo y de cerca) y la altura solo viajan si la óptica lo permite.
--   · NO viaja nada de lo demás de la ficha (anamnesis, lentes actuales, cover test, objetiva, queratometría, salud ocular): eso es solo del personal. La descarga de «mis datos» (derecho de acceso) sí lo incluye, como antes.
-- No cambia ninguna tabla ni dato: las recetas guardadas antes siguen entregándose igual (los campos nuevos llegan vacíos/ausentes).

create or replace function public.consulta_para_paciente(c jsonb, p_montaje boolean, p_completa boolean)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  dc jsonb := coalesce(c -> 'datos_clinicos', '{}'::jsonb);
  medidas jsonb := coalesce(dc -> 'medidas', '{}'::jsonb);
  resultado jsonb;
begin
  -- Distancia pupilar (total, de cada ojo y de cerca) y altura de montaje: solo con permiso de la óptica.
  if not p_montaje then
    medidas := medidas - 'dp' - 'alt' - 'dpOd' - 'dpOi' - 'dpCerca';
  end if;

  resultado := jsonb_build_object(
    'id', c -> 'id', 'paciente_id', c -> 'paciente_id', 'paciente', c -> 'paciente',
    'fecha', c -> 'fecha', 'created_at', c -> 'created_at', 'usa_lentes', c -> 'usa_lentes',
    'diagnostico', c -> 'diagnostico', 'lente_recomendado', c -> 'lente_recomendado', 'indicaciones', c -> 'indicaciones',
    'profesional_nombre', c -> 'profesional_nombre', 'profesional_registro', c -> 'profesional_registro'
  );

  if p_completa then
    -- Descarga de sus datos: todo lo clínico y personal, sin campos internos.
    resultado := resultado || jsonb_build_object(
      'motivo', c -> 'motivo', 'antecedentes', c -> 'antecedentes', 'alergias', c -> 'alergias',
      'antecedentes_familiares', c -> 'antecedentes_familiares', 'detalle_consulta', c -> 'detalle_consulta',
      'diagnostico_categorias', c -> 'diagnostico_categorias', 'proximo_control_dias', c -> 'proximo_control_dias',
      'estado_correccion', c -> 'estado_correccion', 'evolucion_calculada', c -> 'evolucion_calculada',
      'datos_clinicos', (dc - 'control_agenda' - 'control_asignado_a' - 'lente_producto_id')
                         || jsonb_build_object('medidas', medidas)
    );
  else
    -- Portal: la receta y nada más.
    resultado := resultado || jsonb_build_object(
      'datos_clinicos', jsonb_build_object(
        'od', jsonb_strip_nulls(jsonb_build_object('esfera', dc #> '{od,esfera}', 'cilindro', dc #> '{od,cilindro}', 'eje', dc #> '{od,eje}',
                                                    'avSc', dc #> '{od,avSc}', 'avCc', dc #> '{od,avCc}', 'avRx', dc #> '{od,avRx}',
                                                    'avScF', dc #> '{od,avScF}', 'avCcF', dc #> '{od,avCcF}', 'avRxF', dc #> '{od,avRxF}')),
        'oi', jsonb_strip_nulls(jsonb_build_object('esfera', dc #> '{oi,esfera}', 'cilindro', dc #> '{oi,cilindro}', 'eje', dc #> '{oi,eje}',
                                                    'avSc', dc #> '{oi,avSc}', 'avCc', dc #> '{oi,avCc}', 'avRx', dc #> '{oi,avRx}',
                                                    'avScF', dc #> '{oi,avScF}', 'avCcF', dc #> '{oi,avCcF}', 'avRxF', dc #> '{oi,avRxF}')),
        'medidas', jsonb_strip_nulls(jsonb_build_object(
          'adicion', medidas -> 'adicion', 'adicionOd', medidas -> 'adicionOd', 'adicionOi', medidas -> 'adicionOi',
          'avCerca', medidas -> 'avCerca', 'avCercaRx', medidas -> 'avCercaRx',
          'dp', medidas -> 'dp', 'dpOd', medidas -> 'dpOd', 'dpOi', medidas -> 'dpOi', 'dpCerca', medidas -> 'dpCerca', 'alt', medidas -> 'alt',
          'prismaOdCant', medidas -> 'prismaOdCant', 'prismaOdBase', medidas -> 'prismaOdBase', 'prismaOiCant', medidas -> 'prismaOiCant', 'prismaOiBase', medidas -> 'prismaOiBase'
        ))
      )
    );
  end if;
  return resultado;
end;
$$;
