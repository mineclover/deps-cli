import axios from 'axios'
import { UserService, User, CreateUserRequest, UpdateUserRequest } from './UserService'
import { Logger } from '../utils/Logger'
import { ApiError } from '../errors/ApiError'
import { config } from '../config/app.config'

// Mock dependencies
jest.mock('axios')
jest.mock('../utils/Logger')
jest.mock('../config/app.config', () => ({
  config: {
    api: {
      baseUrl: 'https://api.test.com',
      timeout: 5000
    }
  }
}))

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockLogger = Logger as jest.Mocked<typeof Logger>

const mockUser: User = {
  id: '123',
  name: 'Test User',
  email: 'test@example.com',
  avatar: 'https://example.com/avatar.jpg',
  role: 'user',
  createdAt: '2023-01-01T00:00:00Z',
  lastActiveAt: '2023-12-01T00:00:00Z',
  preferences: {
    theme: 'light',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      desktop: false
    }
  }
}

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLogger.debug.mockImplementation(() => {})
    mockLogger.info.mockImplementation(() => {})
    mockLogger.error.mockImplementation(() => {})
  })

  describe('getUser', () => {
    it('should fetch user successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUser })

      const result = await UserService.getUser('123')

      expect(result).toEqual(mockUser)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.test.com/users/123',
        { timeout: 5000 }
      )
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching user: 123')
      expect(mockLogger.debug).toHaveBeenCalledWith('User fetched successfully')
    })

    it('should throw ApiError when user not found (404)', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 }
      })
      mockedAxios.isAxiosError.mockReturnValue(true)

      await expect(UserService.getUser('123')).rejects.toThrow(
        expect.objectContaining({
          message: 'User not found',
          statusCode: 404
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch user:', expect.any(Object))
    })

    it('should throw ApiError when unauthorized (401)', async () => {
      mockedAxios.get.mockRejectedValue({
        isAxiosError: true,
        response: { status: 401 }
      })
      mockedAxios.isAxiosError.mockReturnValue(true)

      await expect(UserService.getUser('123')).rejects.toThrow(
        expect.objectContaining({
          message: 'Unauthorized',
          statusCode: 401
        })
      )
    })

    it('should throw ApiError when response data is null', async () => {
      mockedAxios.get.mockResolvedValue({ data: null })

      await expect(UserService.getUser('123')).rejects.toThrow(
        expect.objectContaining({
          message: 'User not found',
          statusCode: 404
        })
      )
    })

    it('should handle generic network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'))
      mockedAxios.isAxiosError.mockReturnValue(false)

      await expect(UserService.getUser('123')).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to fetch user',
          statusCode: 500
        })
      )
    })
  })

  describe('createUser', () => {
    const createUserRequest: CreateUserRequest = {
      name: 'New User',
      email: 'new@example.com',
      role: 'user'
    }

    it('should create user successfully', async () => {
      mockedAxios.post.mockResolvedValue({ data: mockUser })

      const result = await UserService.createUser(createUserRequest)

      expect(result).toEqual(mockUser)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.test.com/users',
        {
          ...createUserRequest,
          preferences: {
            theme: 'light',
            language: 'en',
            notifications: {
              email: true,
              push: true,
              desktop: false
            }
          }
        },
        { timeout: 5000 }
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new user')
      expect(mockLogger.info).toHaveBeenCalledWith(`User created with ID: ${mockUser.id}`)
    })

    it('should handle create user errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Server error'))

      await expect(UserService.createUser(createUserRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to create user',
          statusCode: 500
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to create user:', expect.any(Error))
    })
  })

  describe('updateUser', () => {
    const updateRequest: UpdateUserRequest = {
      name: 'Updated Name',
      email: 'updated@example.com'
    }

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateRequest }
      mockedAxios.patch.mockResolvedValue({ data: updatedUser })

      const result = await UserService.updateUser('123', updateRequest)

      expect(result).toEqual(updatedUser)
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        'https://api.test.com/users/123',
        updateRequest,
        { timeout: 5000 }
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Updating user: 123')
      expect(mockLogger.info).toHaveBeenCalledWith('User updated successfully')
    })

    it('should throw ApiError when user not found during update', async () => {
      mockedAxios.patch.mockRejectedValue({
        isAxiosError: true,
        response: { status: 404 }
      })
      mockedAxios.isAxiosError.mockReturnValue(true)

      await expect(UserService.updateUser('123', updateRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'User not found',
          statusCode: 404
        })
      )
    })

    it('should handle generic update errors', async () => {
      mockedAxios.patch.mockRejectedValue(new Error('Server error'))
      mockedAxios.isAxiosError.mockReturnValue(false)

      await expect(UserService.updateUser('123', updateRequest)).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to update user',
          statusCode: 500
        })
      )
    })
  })

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockedAxios.delete.mockResolvedValue({})

      await UserService.deleteUser('123')

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        'https://api.test.com/users/123',
        { timeout: 5000 }
      )
      expect(mockLogger.info).toHaveBeenCalledWith('Deleting user: 123')
      expect(mockLogger.info).toHaveBeenCalledWith('User deleted successfully')
    })

    it('should handle delete errors', async () => {
      mockedAxios.delete.mockRejectedValue(new Error('Server error'))

      await expect(UserService.deleteUser('123')).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to delete user',
          statusCode: 500
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete user:', expect.any(Error))
    })
  })

  describe('getUsersByRole', () => {
    const mockUsers: User[] = [mockUser, { ...mockUser, id: '456', role: 'admin' }]

    it('should fetch users by role successfully', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUsers })

      const result = await UserService.getUsersByRole('admin')

      expect(result).toEqual(mockUsers)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.test.com/users?role=admin',
        { timeout: 5000 }
      )
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching users by role: admin')
      expect(mockLogger.debug).toHaveBeenCalledWith('Found 2 users with role: admin')
    })

    it('should handle fetch users by role errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Server error'))

      await expect(UserService.getUsersByRole('admin')).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to fetch users',
          statusCode: 500
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch users by role:', expect.any(Error))
    })
  })

  describe('Configuration', () => {
    it('should use correct base URL and timeout from config', () => {
      expect(config.api.baseUrl).toBe('https://api.test.com')
      expect(config.api.timeout).toBe(5000)
    })
  })

  describe('Error Handling', () => {
    it('should properly identify axios errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 500 }
      }

      mockedAxios.get.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      await expect(UserService.getUser('123')).rejects.toThrow(ApiError)
    })

    it('should handle non-axios errors', async () => {
      const genericError = new Error('Generic error')

      mockedAxios.get.mockRejectedValue(genericError)
      mockedAxios.isAxiosError.mockReturnValue(false)

      await expect(UserService.getUser('123')).rejects.toThrow(ApiError)
    })
  })
})