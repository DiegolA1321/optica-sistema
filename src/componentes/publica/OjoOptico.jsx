import { useId } from "react"

// Ojo de la marca: iris que gira muy lento, pupila que «respira» y un brillo suave. Sin imagen principal de la óptica,
// es lo que ocupa su lugar. El movimiento (clases lg-*) lo apaga prefers-reduced-motion en EstilosPublica.
export default function OjoOptico({ className = "" }) {
  const id = useId().replace(/:/g, "")
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label="Ilustración de un ojo">
      <defs>
        <radialGradient id={`iris-${id}`} cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="45%" stopColor="#2563EB" />
          <stop offset="85%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#172554" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="190" fill={`url(#iris-${id})`} />
      <g className="lg-spin">
        {Array.from({ length: 72 }).map((_, i) => {
          const rad = (i * 5 * Math.PI) / 180
          const larga = i % 3 === 0
          return (
            <line
              key={i}
              x1={200 + 78 * Math.cos(rad)}
              y1={200 + 78 * Math.sin(rad)}
              x2={200 + (larga ? 186 : 170) * Math.cos(rad)}
              y2={200 + (larga ? 186 : 170) * Math.sin(rad)}
              stroke="#BFDBFE"
              strokeWidth={larga ? 1.4 : 0.8}
              strokeOpacity={larga ? 0.5 : 0.28}
              strokeLinecap="round"
            />
          )
        })}
      </g>
      <circle cx="200" cy="200" r="190" fill="none" stroke="#1E3A8A" strokeOpacity="0.75" strokeWidth="6" />
      <circle className="lg-pupila" cx="200" cy="205" r="74" fill="#050B1A" />
      <circle className="lg-brillo" cx="170" cy="166" r="22" fill="#E5E7EB" />
    </svg>
  )
}
