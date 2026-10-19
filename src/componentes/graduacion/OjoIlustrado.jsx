// El ojo ilustrado de la graduación (iris, pupila y brillo): lo usan el Inicio y Mi receta del portal y el perfil del paciente del personal. Es un dibujo, no un dato: el
// valor y el nombre del ojo van siempre en texto al lado (`aria-hidden`).
let contador = 0
export default function OjoIlustrado({ ancho = 160, className = "" }) {
  const id = `ojo-${(contador = (contador + 1) % 100000)}`
  return (
    <svg data-ojo-ilustrado aria-hidden="true" focusable="false" viewBox="0 0 160 100" width={ancho} height={(ancho * 100) / 160} className={className}>
      <defs>
        <radialGradient id={id + "-iris"} cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#3F86FF" />
          <stop offset="62%" stopColor="#1B54C9" />
          <stop offset="100%" stopColor="#0E2F8F" />
        </radialGradient>
        <clipPath id={id + "-ojo"}><path d="M10 52 Q80 -8 150 52 Q80 108 10 52 Z" /></clipPath>
      </defs>
      <path d="M10 52 Q80 -8 150 52 Q80 108 10 52 Z" fill="#FFFFFF" />
      <g clipPath={`url(#${id}-ojo)`}>
        <circle cx="80" cy="52" r="29" fill={`url(#${id}-iris)`} />
        <circle cx="80" cy="52" r="12.5" fill="#0A1A3D" />
        <circle cx="68" cy="40" r="5.5" fill="#FFFFFF" />
      </g>
      <path d="M10 52 Q80 108 150 52" fill="none" stroke="#C3D2EE" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M10 52 Q80 -8 150 52" fill="none" stroke="#0F2340" strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  )
}
