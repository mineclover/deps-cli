/**
 * UserService 테스트 - 테스트 의존성 분석을 위한 샘플 파일
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'  // test-utility
import { jest } from '@jest/globals'                                      // test-utility
import axios from 'axios'                                                 // test-utility (mocked)
import { UserService } from './UserService.js'                           // test-target
import { Logger } from './utils/Logger.js'                               // test-target
import { Database } from '@/database/Database.js'                        // test-target
import { setupTestDatabase, cleanupTestDatabase } from '../test-utils/database-setup.js'  // test-setup
import { createMockUser, createMockUserRequest } from '../__mocks__/user-mocks.js'       // test-setup
import type { User, UserCreateRequest } from './types/User.js'           // test-target (types)

// 외부 라이브러리 모킹
vi.mock('axios')                                                          // test-utility (mock setup)
vi.mock('./utils/Logger.js')                                            // test-setup (mock)
vi.mock('@/database/Database.js')                                       // test-setup (mock)

const mockedAxios = vi.mocked(axios)
const MockedLogger = vi.mocked(Logger)
const MockedDatabase = vi.mocked(Database)

describe('UserService', () => {
  let userService: UserService
  let mockLogger: vi.Mocked<Logger>
  let mockDatabase: vi.Mocked<Database>

  const defaultOptions = {
    apiBaseUrl: 'https://api.test.com',
    timeout: 5000,
    retries: 3
  }

  beforeEach(async () => {
    // 테스트 환경 설정
    await setupTestDatabase()                                             // test-setup

    // 목 객체 초기화
    mockLogger = new MockedLogger() as vi.Mocked<Logger>
    mockDatabase = new MockedDatabase() as vi.Mocked<Database>

    MockedLogger.mockImplementation(() => mockLogger)
    MockedDatabase.mockImplementation(() => mockDatabase)

    // UserService 인스턴스 생성
    userService = new UserService(defaultOptions)

    // axios 기본 모킹
    mockedAxios.post.mockClear()
    mockedAxios.get.mockClear()
    mockedAxios.put.mockClear()
    mockedAxios.delete.mockClear()
    mockedAxios.isAxiosError.mockClear()
  })

  afterEach(async () => {
    await cleanupTestDatabase()                                           // test-setup
    vi.clearAllMocks()
  })

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      // Arrange
      const userRequest = createMockUserRequest({                         // test-setup
        name: 'John Doe',
        email: 'john@example.com'
      })
      const expectedUser = createMockUser({                               // test-setup
        id: '123',
        name: 'John Doe',
        email: 'john@example.com'
      })

      mockedAxios.post.mockResolvedValue({
        data: expectedUser,
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any
      })

      mockDatabase.saveUser.mockResolvedValue(undefined)

      // Act
      const result = await userService.createUser(userRequest)

      // Assert
      expect(result).toEqual(expectedUser)
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users`,
        userRequest,
        expect.objectContaining({
          timeout: defaultOptions.timeout,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      expect(mockDatabase.saveUser).toHaveBeenCalledWith(expectedUser)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User created successfully',
        { userId: expectedUser.id }
      )
    })

    it('should handle API errors during user creation', async () => {
      // Arrange
      const userRequest = createMockUserRequest()
      const apiError = new Error('API Error')

      mockedAxios.post.mockRejectedValue(apiError)

      // Act & Assert
      await expect(userService.createUser(userRequest)).rejects.toThrow('사용자 생성 실패')
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create user',
        { error: apiError, userData: userRequest }
      )
    })

    it('should handle database errors during user creation', async () => {
      // Arrange
      const userRequest = createMockUserRequest()
      const user = createMockUser()
      const dbError = new Error('Database Error')

      mockedAxios.post.mockResolvedValue({ data: user } as any)
      mockDatabase.saveUser.mockRejectedValue(dbError)

      // Act & Assert
      await expect(userService.createUser(userRequest)).rejects.toThrow(dbError)
    })
  })

  describe('getUserById', () => {
    const userId = 'user-123'
    const user = createMockUser({ id: userId })

    it('should return user from local database if available', async () => {
      // Arrange
      mockDatabase.findUserById.mockResolvedValue(user)

      // Act
      const result = await userService.getUserById(userId)

      // Assert
      expect(result).toEqual(user)
      expect(mockDatabase.findUserById).toHaveBeenCalledWith(userId)
      expect(mockedAxios.get).not.toHaveBeenCalled()
    })

    it('should fetch user from API if not in local database', async () => {
      // Arrange
      mockDatabase.findUserById.mockResolvedValue(null)
      mockedAxios.get.mockResolvedValue({ data: user } as any)
      mockDatabase.saveUser.mockResolvedValue(undefined)

      // Act
      const result = await userService.getUserById(userId)

      // Assert
      expect(result).toEqual(user)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users/${userId}`,
        { timeout: defaultOptions.timeout }
      )
      expect(mockDatabase.saveUser).toHaveBeenCalledWith(user)
    })

    it('should return null for 404 errors', async () => {
      // Arrange
      mockDatabase.findUserById.mockResolvedValue(null)
      const error = {
        response: { status: 404 },
        isAxiosError: true
      }
      mockedAxios.get.mockRejectedValue(error)
      mockedAxios.isAxiosError.mockReturnValue(true)

      // Act
      const result = await userService.getUserById(userId)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw for other API errors', async () => {
      // Arrange
      mockDatabase.findUserById.mockResolvedValue(null)
      const error = new Error('Network Error')
      mockedAxios.get.mockRejectedValue(error)
      mockedAxios.isAxiosError.mockReturnValue(false)

      // Act & Assert
      await expect(userService.getUserById(userId)).rejects.toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch user',
        { error, userId }
      )
    })
  })

  describe('updateUser', () => {
    const userId = 'user-123'
    const existingUser = createMockUser({ id: userId })
    const updateData = { name: 'Updated Name' }
    const updatedUser = { ...existingUser, ...updateData }

    it('should update user successfully', async () => {
      // Arrange
      mockDatabase.findUserById.mockResolvedValue(existingUser)
      mockedAxios.get.mockResolvedValue({ data: existingUser } as any)
      mockedAxios.put.mockResolvedValue({ data: updatedUser } as any)
      mockDatabase.updateUser.mockResolvedValue(undefined)

      // Act
      const result = await userService.updateUser(userId, updateData)

      // Assert
      expect(result).toEqual(updatedUser)
      expect(mockedAxios.put).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users/${userId}`,
        updateData,
        { timeout: defaultOptions.timeout }
      )
      expect(mockDatabase.updateUser).toHaveBeenCalledWith(userId, updatedUser)
    })

    it('should throw error if user does not exist', async () => {
      // Arrange
      mockDatabase.findUserById.mockResolvedValue(null)
      mockedAxios.get.mockRejectedValue({ response: { status: 404 } })
      mockedAxios.isAxiosError.mockReturnValue(true)

      // Act & Assert
      await expect(userService.updateUser(userId, updateData))
        .rejects.toThrow(`사용자를 찾을 수 없습니다: ${userId}`)
    })
  })

  describe('deleteUser', () => {
    const userId = 'user-123'

    it('should delete user successfully', async () => {
      // Arrange
      mockedAxios.delete.mockResolvedValue({ status: 204 } as any)
      mockDatabase.deleteUser.mockResolvedValue(undefined)

      // Act
      await userService.deleteUser(userId)

      // Assert
      expect(mockedAxios.delete).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users/${userId}`,
        { timeout: defaultOptions.timeout }
      )
      expect(mockDatabase.deleteUser).toHaveBeenCalledWith(userId)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User deleted successfully',
        { userId }
      )
    })

    it('should handle deletion errors', async () => {
      // Arrange
      const error = new Error('Deletion failed')
      mockedAxios.delete.mockRejectedValue(error)

      // Act & Assert
      await expect(userService.deleteUser(userId)).rejects.toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete user',
        { error, userId }
      )
    })
  })

  describe('listUsers', () => {
    const users = [
      createMockUser({ id: '1', name: 'User 1' }),
      createMockUser({ id: '2', name: 'User 2' })
    ]

    it('should list users with default pagination', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: users } as any)
      mockDatabase.saveUser.mockResolvedValue(undefined)

      // Act
      const result = await userService.listUsers()

      // Assert
      expect(result).toEqual(users)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users`,
        {
          params: { limit: 50, offset: 0 },
          timeout: defaultOptions.timeout
        }
      )
      expect(mockDatabase.saveUser).toHaveBeenCalledTimes(users.length)
    })

    it('should list users with custom pagination', async () => {
      // Arrange
      const limit = 10
      const offset = 20
      mockedAxios.get.mockResolvedValue({ data: users } as any)
      mockDatabase.saveUser.mockResolvedValue(undefined)

      // Act
      const result = await userService.listUsers(limit, offset)

      // Assert
      expect(result).toEqual(users)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users`,
        {
          params: { limit, offset },
          timeout: defaultOptions.timeout
        }
      )
    })
  })

  describe('getUserStats', () => {
    const stats = {
      total: 100,
      active: 85,
      lastMonth: 15
    }

    it('should return user statistics', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: stats } as any)

      // Act
      const result = await userService.getUserStats()

      // Assert
      expect(result).toEqual(stats)
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${defaultOptions.apiBaseUrl}/users/stats`,
        { timeout: defaultOptions.timeout }
      )
    })

    it('should handle stats API errors', async () => {
      // Arrange
      const error = new Error('Stats API Error')
      mockedAxios.get.mockRejectedValue(error)

      // Act & Assert
      await expect(userService.getUserStats()).rejects.toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get user stats',
        { error }
      )
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle network timeouts', async () => {
      // Arrange
      const timeoutError = new Error('TIMEOUT')
      mockedAxios.post.mockRejectedValue(timeoutError)

      // Act & Assert
      await expect(userService.createUser(createMockUserRequest()))
        .rejects.toThrow('사용자 생성 실패')
    })

    it('should handle malformed API responses', async () => {
      // Arrange
      mockedAxios.get.mockResolvedValue({ data: null } as any)
      mockDatabase.findUserById.mockResolvedValue(null)

      // Act
      const result = await userService.getUserById('invalid-id')

      // Assert
      expect(result).toBeNull()
    })
  })
})