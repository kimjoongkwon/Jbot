import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { ChatPageClient } from '@/components/chat/ChatPageClient'

export default async function ChatPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.mustChangePassword) redirect('/account/security')

  return <ChatPageClient userName={user.name} userRole={user.role} />
}
