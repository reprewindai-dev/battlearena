import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xjnxrkdtdfvusofiwshu.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqbnhya2R0ZGZ2dXNvZml3c2h1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjA4MDExNywiZXhwIjoyMDg3NjU2MTE3fQ.SGVCJmzvosXMToHLBPFYESn3vI2UcX2nvRUry-4fFDY'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetPassword() {
  const email = 'anthonymillwater2@gmail.com'
  const newPassword = 'Spitzone2026!'

  try {
    // Get the user
    const { data: { users }, error } = await supabase.auth.admin.listUsers()
    
    if (error) throw error
    
    const user = users.find(u => u.email === email)
    if (!user) {
      console.error('User not found')
      return
    }

    // Update user password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (updateError) throw updateError

    console.log(`✅ Password reset for ${email}`)
    console.log(`New password: ${newPassword}`)
    console.log('You can now log in with this password.')
  } catch (error) {
    console.error('Error resetting password:', error)
  }
}

resetPassword()
