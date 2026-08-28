import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Sin esto, sin `test.globals: true` en vite.config.js, @testing-library/react
// no detecta automáticamente el afterEach de Vitest para desmontar el DOM
// entre tests — los renders se acumulan y "getByRole" empieza a fallar con
// "multiple elements found" en tests que en realidad están bien.
afterEach(() => {
  cleanup()
})
