import React, { useState, useEffect } from 'react'
import { User, UserService } from '../services/UserService'
import { Logger } from '../utils/Logger'
import './UserProfile.css'

interface UserProfileProps {
  userId: string
  onUserUpdate?: (user: User) => void
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUserUpdate }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)
        Logger.info(`Fetching user with ID: ${userId}`)

        const userData = await UserService.getUser(userId)
        setUser(userData)
        onUserUpdate?.(userData)

        Logger.info('User data loaded successfully')
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        Logger.error('Failed to fetch user:', errorMessage)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchUser()
    }
  }, [userId, onUserUpdate])

  const handleUserEdit = async (updatedUser: Partial<User>) => {
    if (!user) return

    try {
      const updated = await UserService.updateUser(user.id, updatedUser)
      setUser(updated)
      onUserUpdate?.(updated)
      Logger.info('User updated successfully')
    } catch (err) {
      Logger.error('Failed to update user:', err)
    }
  }

  if (loading) {
    return <div className="user-profile-loading">Loading user profile...</div>
  }

  if (error) {
    return <div className="user-profile-error">Error: {error}</div>
  }

  if (!user) {
    return <div className="user-profile-not-found">User not found</div>
  }

  return (
    <div className="user-profile">
      <div className="user-header">
        <img src={user.avatar} alt={`${user.name}'s avatar`} className="user-avatar" />
        <h1>{user.name}</h1>
        <p className="user-email">{user.email}</p>
      </div>

      <div className="user-details">
        <div className="user-info">
          <label>Role:</label>
          <span>{user.role}</span>
        </div>

        <div className="user-info">
          <label>Joined:</label>
          <span>{new Date(user.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <button
        onClick={() => handleUserEdit({ lastActiveAt: new Date() })}
        className="btn-update-activity"
      >
        Update Last Activity
      </button>
    </div>
  )
}

export default UserProfile