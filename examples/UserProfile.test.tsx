import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { UserProfile } from './UserProfile'
import { UserService } from '../services/UserService'
import { Logger } from '../utils/Logger'

// Mock dependencies
jest.mock('../services/UserService')
jest.mock('../utils/Logger')
jest.mock('./UserProfile.css', () => ({}))

const mockUserService = UserService as jest.Mocked<typeof UserService>
const mockLogger = Logger as jest.Mocked<typeof Logger>

const mockUser = {
  id: '123',
  name: 'John Doe',
  email: 'john@example.com',
  avatar: 'https://example.com/avatar.jpg',
  role: 'user' as const,
  createdAt: '2023-01-01T00:00:00Z',
  lastActiveAt: '2023-12-01T00:00:00Z',
  preferences: {
    theme: 'light' as const,
    language: 'en',
    notifications: {
      email: true,
      push: true,
      desktop: false
    }
  }
}

describe('UserProfile Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger.info.mockImplementation(() => {})
    mockLogger.error.mockImplementation(() => {})
  })

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      mockUserService.getUser.mockImplementation(() => new Promise(() => {}))

      render(<UserProfile userId="123" />)

      expect(screen.getByText('Loading user profile...')).toBeInTheDocument()
    })
  })

  describe('Success State', () => {
    beforeEach(() => {
      mockUserService.getUser.mockResolvedValue(mockUser)
    })

    it('should render user profile when data is loaded', async () => {
      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('user')).toBeInTheDocument()
      expect(screen.getByText('1/1/2023')).toBeInTheDocument()
    })

    it('should call UserService.getUser with correct userId', async () => {
      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(mockUserService.getUser).toHaveBeenCalledWith('123')
      })
    })

    it('should call onUserUpdate when user data is loaded', async () => {
      const mockOnUserUpdate = jest.fn()

      render(<UserProfile userId="123" onUserUpdate={mockOnUserUpdate} />)

      await waitFor(() => {
        expect(mockOnUserUpdate).toHaveBeenCalledWith(mockUser)
      })
    })

    it('should log info messages during successful fetch', async () => {
      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(mockLogger.info).toHaveBeenCalledWith('Fetching user with ID: 123')
      })

      expect(mockLogger.info).toHaveBeenCalledWith('User data loaded successfully')
    })
  })

  describe('Error State', () => {
    it('should show error message when fetch fails', async () => {
      const errorMessage = 'Network error'
      mockUserService.getUser.mockRejectedValue(new Error(errorMessage))

      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(screen.getByText(`Error: ${errorMessage}`)).toBeInTheDocument()
      })
    })

    it('should log error when fetch fails', async () => {
      const error = new Error('Network error')
      mockUserService.getUser.mockRejectedValue(error)

      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch user:', 'Network error')
      })
    })

    it('should handle unknown error types', async () => {
      mockUserService.getUser.mockRejectedValue('Unknown error')

      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(screen.getByText('Error: Unknown error')).toBeInTheDocument()
      })
    })
  })

  describe('User Interactions', () => {
    beforeEach(() => {
      mockUserService.getUser.mockResolvedValue(mockUser)
      mockUserService.updateUser.mockResolvedValue({
        ...mockUser,
        lastActiveAt: '2023-12-02T00:00:00Z'
      })
    })

    it('should update last activity when button is clicked', async () => {
      const mockOnUserUpdate = jest.fn()

      render(<UserProfile userId="123" onUserUpdate={mockOnUserUpdate} />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      const updateButton = screen.getByText('Update Last Activity')
      fireEvent.click(updateButton)

      await waitFor(() => {
        expect(mockUserService.updateUser).toHaveBeenCalledWith('123', {
          lastActiveAt: expect.any(Date)
        })
      })

      expect(mockOnUserUpdate).toHaveBeenCalledTimes(2) // Once for initial load, once for update
    })

    it('should handle update errors gracefully', async () => {
      mockUserService.updateUser.mockRejectedValue(new Error('Update failed'))

      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })

      const updateButton = screen.getByText('Update Last Activity')
      fireEvent.click(updateButton)

      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to update user:', expect.any(Error))
      })
    })
  })

  describe('Edge Cases', () => {
    it('should show not found message when user is null', async () => {
      mockUserService.getUser.mockResolvedValue(null as any)

      render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument()
      })
    })

    it('should not fetch user when userId is empty', () => {
      render(<UserProfile userId="" />)

      expect(mockUserService.getUser).not.toHaveBeenCalled()
    })

    it('should refetch user when userId changes', async () => {
      const { rerender } = render(<UserProfile userId="123" />)

      await waitFor(() => {
        expect(mockUserService.getUser).toHaveBeenCalledWith('123')
      })

      rerender(<UserProfile userId="456" />)

      await waitFor(() => {
        expect(mockUserService.getUser).toHaveBeenCalledWith('456')
      })

      expect(mockUserService.getUser).toHaveBeenCalledTimes(2)
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUserService.getUser.mockResolvedValue(mockUser)
    })

    it('should have proper alt text for avatar image', async () => {
      render(<UserProfile userId="123" />)

      await waitFor(() => {
        const avatar = screen.getByAltText("John Doe's avatar")
        expect(avatar).toBeInTheDocument()
        expect(avatar).toHaveAttribute('src', mockUser.avatar)
      })
    })

    it('should have proper button labeling', async () => {
      render(<UserProfile userId="123" />)

      await waitFor(() => {
        const button = screen.getByRole('button', { name: 'Update Last Activity' })
        expect(button).toBeInTheDocument()
      })
    })
  })
})