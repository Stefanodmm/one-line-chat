import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chat en Red Local',
  description: 'Chat en tiempo real para usuarios en la misma red local',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}

