import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { ChatPageClient } from '@/components/chat/ChatPageClient'
import { DatabaseUnavailableNotice } from '@/components/shared/DatabaseUnavailableNotice'

// getCurrentUser()가 cookies()를 사용하므로 이미 사실상 동적으로 렌더링되지만,
// DB를 사용하는 화면이라는 것을 명시적으로 표시해 향후 코드 변경에도 안전하게
// 동적 렌더링이 유지되도록 한다.
export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  let user
  try {
    user = await getCurrentUser()
  } catch (error) {
    console.error('[chat] 로그인 확인 중 DB 조회 실패:', error)
    return <DatabaseUnavailableNotice />
  }
  if (!user) redirect('/login')

  return <ChatPageClient userName={user.name} userRole={user.role} />
}
