import type { AxiosResponse } from "axios"
import axios from "axios"
import { config } from "../config/app.config"
import { ApiError } from "../errors/ApiError"
import { Logger } from "../utils/Logger"

export interface User {
  id: string
  name: string
  email: string
  avatar: string
  role: "admin" | "user" | "moderator"
  createdAt: string
  lastActiveAt?: string
  preferences: UserPreferences
}

export interface UserPreferences {
  theme: "light" | "dark"
  language: string
  notifications: {
    email: boolean
    push: boolean
    desktop: boolean
  }
}

export interface CreateUserRequest {
  name: string
  email: string
  role?: User["role"]
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  avatar?: string
  lastActiveAt?: Date
  preferences?: Partial<UserPreferences>
}

class UserServiceImpl {
  private baseUrl: string
  private timeout: number

  constructor() {
    this.baseUrl = `${config.api.baseUrl}/users`
    this.timeout = config.api.timeout || 5000
  }

  async getUser(userId: string): Promise<User> {
    try {
      Logger.debug(`Fetching user: ${userId}`)

      const response: AxiosResponse<User> = await axios.get(
        `${this.baseUrl}/${userId}`,
        { timeout: this.timeout }
      )

      if (!response.data) {
        throw new ApiError("User not found", 404)
      }

      Logger.debug("User fetched successfully")
      return response.data
    } catch (error) {
      Logger.error("Failed to fetch user:", error)

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new ApiError("User not found", 404)
        }
        if (error.response?.status === 401) {
          throw new ApiError("Unauthorized", 401)
        }
      }

      throw new ApiError("Failed to fetch user", 500)
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      Logger.info("Creating new user")

      const response: AxiosResponse<User> = await axios.post(
        this.baseUrl,
        {
          ...userData,
          preferences: {
            theme: "light",
            language: "en",
            notifications: {
              email: true,
              push: true,
              desktop: false
            }
          }
        },
        { timeout: this.timeout }
      )

      Logger.info(`User created with ID: ${response.data.id}`)
      return response.data
    } catch (error) {
      Logger.error("Failed to create user:", error)
      throw new ApiError("Failed to create user", 500)
    }
  }

  async updateUser(userId: string, updates: UpdateUserRequest): Promise<User> {
    try {
      Logger.info(`Updating user: ${userId}`)

      const response: AxiosResponse<User> = await axios.patch(
        `${this.baseUrl}/${userId}`,
        updates,
        { timeout: this.timeout }
      )

      Logger.info("User updated successfully")
      return response.data
    } catch (error) {
      Logger.error("Failed to update user:", error)

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new ApiError("User not found", 404)
      }

      throw new ApiError("Failed to update user", 500)
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      Logger.info(`Deleting user: ${userId}`)

      await axios.delete(`${this.baseUrl}/${userId}`, {
        timeout: this.timeout
      })

      Logger.info("User deleted successfully")
    } catch (error) {
      Logger.error("Failed to delete user:", error)
      throw new ApiError("Failed to delete user", 500)
    }
  }

  async getUsersByRole(role: User["role"]): Promise<Array<User>> {
    try {
      Logger.debug(`Fetching users by role: ${role}`)

      const response: AxiosResponse<Array<User>> = await axios.get(
        `${this.baseUrl}?role=${role}`,
        { timeout: this.timeout }
      )

      Logger.debug(`Found ${response.data.length} users with role: ${role}`)
      return response.data
    } catch (error) {
      Logger.error("Failed to fetch users by role:", error)
      throw new ApiError("Failed to fetch users", 500)
    }
  }
}

export const UserService = new UserServiceImpl()
