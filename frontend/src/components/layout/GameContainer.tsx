import { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

export default function GameContainer({ children }: Props) {
  return (
    <main
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '0 1rem',
        width: '100%',
      }}
    >
      {children}
    </main>
  )
}