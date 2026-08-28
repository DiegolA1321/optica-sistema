import React, { useState, useEffect } from "react"
import { ArrowLeft, ShieldCheck, FileText, Lock, Database, Mail, Scale } from "lucide-react"

const INK = "#0E2B33"
const PORCELAIN = "#F7F5F0"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Política de privacidad + términos de uso — antes eran links muertos en el
// footer del login y de la página de venta (<span> sin onClick). El sistema
// maneja datos de salud de pacientes reales; el anteproyecto de tesis
// promete protección de datos explícitamente (sección 6/7.4) y hasta ahora
// no había ningún texto que se lo explicara a quien lo usa. Contenido real,
// no relleno: describe exactamente lo que este sistema hace (Supabase para
// datos, Resend para correos, hash de contraseñas, RLS por óptica), en línea
// con la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP).
export default function PaginaLegal({ vistaInicial = "privacidad", onVolver }) {
  const [vista, setVista] = useState(vistaInicial)

  // El navegador restaura la posición de scroll entre navegaciones de la
  // misma pestaña — sin esto, entrar acá desde el final de una página larga
  // (el footer) aterriza scrolleado hasta abajo en vez de arriba del todo.
  useEffect(() => { window.scrollTo(0, 0) }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: PORCELAIN }}>
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-8">
        <button
          type="button"
          onClick={onVolver}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-700 cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <div className="mb-8 flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <Scale size={22} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Legal</h1>
            <p className="text-sm text-slate-500">Política de privacidad y términos de uso del sistema.</p>
          </div>
        </div>

        <div className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
          <button
            type="button"
            onClick={() => setVista("privacidad")}
            className={"flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors cursor-pointer " + (vista === "privacidad" ? "text-white" : "text-slate-500 hover:bg-slate-50")}
            style={vista === "privacidad" ? { background: GRAD } : undefined}
          >
            <ShieldCheck size={16} /> Privacidad
          </button>
          <button
            type="button"
            onClick={() => setVista("terminos")}
            className={"flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors cursor-pointer " + (vista === "terminos" ? "text-white" : "text-slate-500 hover:bg-slate-50")}
            style={vista === "terminos" ? { background: GRAD } : undefined}
          >
            <FileText size={16} /> Términos de uso
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8" style={{ boxShadow: "0 20px 40px -24px rgba(14,43,51,0.15)" }}>
          {vista === "privacidad" ? <ContenidoPrivacidad /> : <ContenidoTerminos />}
        </div>
      </div>
    </div>
  )
}

function Seccion({ icon: Icon, titulo, children }) {
  return (
    <div className="mb-7 last:mb-0">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
        {Icon && <Icon size={16} className="text-blue-600" />} {titulo}
      </h3>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">{children}</div>
    </div>
  )
}

function ContenidoPrivacidad() {
  return (
    <>
      <p className="mb-6 text-xs text-slate-400">Última actualización: agosto de 2026.</p>

      <Seccion icon={Database} titulo="Qué datos recolectamos">
        <p>Del paciente: nombre, cédula, teléfono, correo (opcional), fecha de nacimiento, y datos clínicos (diagnóstico, evolución visual, medidas de la receta, historial de citas y consultas). Del personal (administradores y asistentes): nombre, correo y credenciales de acceso.</p>
      </Seccion>

      <Seccion icon={Lock} titulo="Cómo protegemos tus datos">
        <p>Las contraseñas nunca se guardan en texto plano — se almacenan con hash (bcrypt) o mediante la autenticación gestionada de Supabase, según el tipo de cuenta. El acceso a los datos está restringido por rol: cada óptica solo puede ver la información de sus propios pacientes, un asistente solo ve los módulos que su administrador le habilita. Todas las conexiones viajan cifradas (HTTPS/TLS) y los datos se almacenan cifrados en reposo en la base de datos gestionada.</p>
      </Seccion>

      <Seccion icon={Mail} titulo="Con quién compartimos información">
        <p>No vendemos ni compartimos tus datos con terceros para fines publicitarios. Usamos dos proveedores externos, solo para operar el sistema: <strong>Supabase</strong> (alojamiento de la base de datos y autenticación) y <strong>Resend</strong> (envío de los correos de recordatorio de citas y saludos de cumpleaños, únicamente si diste tu correo y la óptica activó esa función).</p>
      </Seccion>

      <Seccion icon={ShieldCheck} titulo="Tus derechos">
        <p>Podés pedirle a la óptica donde eres paciente que te muestre, corrija o elimine tus datos personales, de acuerdo con la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP). Como este sistema es usado por cada óptica de forma independiente, esas solicitudes se atienden directamente con la óptica, que es quien administra tu información.</p>
      </Seccion>

      <Seccion titulo="Almacenamiento en tu navegador">
        <p>Usamos almacenamiento local del navegador (localStorage) para mantener tu sesión iniciada mientras usás el sistema. No usamos cookies de rastreo publicitario ni compartimos esta información con redes de publicidad.</p>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>Para cualquier consulta sobre tus datos, comunicate directamente con la óptica donde te atendés.</p>
      </Seccion>
    </>
  )
}

function ContenidoTerminos() {
  return (
    <>
      <p className="mb-6 text-xs text-slate-400">Última actualización: agosto de 2026.</p>

      <Seccion titulo="Aceptación">
        <p>Al usar este sistema — como paciente, administrador o asistente de una óptica — aceptás estos términos. Si no estás de acuerdo, no debés usar la plataforma.</p>
      </Seccion>

      <Seccion titulo="Qué es este sistema">
        <p>Es una plataforma de gestión clínica, agendamiento de citas y CRM para ópticas. Cada óptica que se registra administra sus propios pacientes, citas, inventario y personal de forma independiente y aislada de las demás.</p>
      </Seccion>

      <Seccion titulo="Tu cuenta">
        <p>Sos responsable de mantener tu contraseña en privado y de toda actividad que ocurra desde tu cuenta. Avisá de inmediato a la óptica si sospechás que alguien más accedió a tu cuenta sin permiso.</p>
      </Seccion>

      <Seccion titulo="Uso apropiado">
        <p>No está permitido usar el sistema para ingresar información falsa, intentar acceder a datos de otra óptica, o interferir con el funcionamiento normal de la plataforma.</p>
      </Seccion>

      <Seccion titulo="Disponibilidad del servicio">
        <p>Este es un sistema en desarrollo activo (proyecto de titulación universitaria). Hacemos lo posible por mantenerlo disponible, pero no garantizamos un funcionamiento ininterrumpido ni libre de errores.</p>
      </Seccion>

      <Seccion titulo="Cambios a estos términos">
        <p>Podemos actualizar estos términos y la política de privacidad. Los cambios importantes se reflejarán con una nueva fecha de "última actualización" en esta misma página.</p>
      </Seccion>

      <Seccion titulo="Ley aplicable">
        <p>Estos términos se rigen por las leyes de la República del Ecuador.</p>
      </Seccion>
    </>
  )
}
