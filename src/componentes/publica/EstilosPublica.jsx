// Animaciones de la página pública, la ventana de ingreso y el ingreso del superadmin. Todo el movimiento se apaga con
// prefers-reduced-motion (un solo bloque @media al final).
export default function EstilosPublica() {
  return (
    <style>{`
      html { scroll-behavior: smooth; }
      @keyframes lgFocus { from { filter: blur(14px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
      @keyframes lgRise  { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
      @keyframes lgSpin    { to { transform: rotate(360deg); } }
      @keyframes lgGlow  { 0%,100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
      @keyframes lgPupila { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      @keyframes lgBrillo { 0%,100% { opacity: 0.85; } 50% { opacity: 0.55; } }
      @keyframes lgFlota { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      @keyframes lgModal { from { opacity: 0; transform: scale(0.96) translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes lgVelo  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes lgLuz { 0% { transform: translate(-30%, -20%); } 50% { transform: translate(30%, 25%); } 100% { transform: translate(-30%, -20%); } }
      .lg-focus { animation: lgFocus 1s cubic-bezier(0.2,0.7,0.2,1) both; }
      .lg-rise  { animation: lgRise 0.7s ease-out both; }
      .lg-spin  { animation: lgSpin 90s linear infinite; transform-box: fill-box; transform-origin: center; }
      .lg-glow  { animation: lgGlow 6s ease-in-out infinite; }
      .lg-pupila { animation: lgPupila 5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      .lg-brillo { animation: lgBrillo 6s ease-in-out infinite; }
      .lg-flota  { animation: lgFlota 6s ease-in-out infinite; }
      .lg-flota-2 { animation-delay: -2s; }
      .lg-flota-3 { animation-delay: -4s; }
      .lg-modal { animation: lgModal 0.22s cubic-bezier(0.2,0.7,0.2,1) both; }
      .lg-velo  { animation: lgVelo 0.2s ease-out both; }
      .lg-luz   { animation: lgLuz 24s ease-in-out infinite; }
      .lg-d1 { animation-delay: .05s; } .lg-d2 { animation-delay: .18s; }
      .lg-d3 { animation-delay: .31s; } .lg-d4 { animation-delay: .44s; }
      @media (prefers-reduced-motion: reduce) {
        html { scroll-behavior: auto; }
        .lg-focus,.lg-rise,.lg-spin,.lg-glow,.lg-pupila,.lg-brillo,.lg-flota,.lg-modal,.lg-velo,.lg-luz { animation: none !important; }
      }
    `}</style>
  )
}
