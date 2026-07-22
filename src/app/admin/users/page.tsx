import { redirect } from 'next/navigation'
import { UserManagementTable } from '@/components/admin/UserManagementTable'
import { requireRole } from '@/lib/auth/session'
import { prisma } from '@/lib/db'

export default async function AdminUsersPage() {
  const admin = await requireRole(['ADMIN'])
  if (!admin) redirect('/admin')

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      failedLoginCount: true,
      lockedUntil: true,
      lastLoginAt: true,
    },
  })

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-navy-800">사용자 관리</h1>
      <UserManagementTable initialUsers={users} currentUserId={admin.id} />
    </div>
  )
}
