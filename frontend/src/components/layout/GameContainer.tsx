import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default function GameContainer({ children }: Props) {
  return (
    <main style={{ maxWidth: '640px', margin: '2rem auto', padding: '0 1rem' }}>
      {children}
    </main>
  )
}
