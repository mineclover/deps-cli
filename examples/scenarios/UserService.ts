/**
 * 사용자 관리 서비스 - 코드 의존성 분석을 위한 샘플 파일
 */

import { Database } from "@/database/Database.js" // internal-module (alias)
import axios from "axios" // external-library
import * as _fs from "node:fs" // builtin-module
import * as _path from "node:path" // builtin-module
import { Config } from "./config/Config.js" // internal-module
import type { User, UserCreateRequest } from "./types/User.js" // internal-module (type-only)
import { Logger } from "./utils/Logger.js" // internal-module

export interface UserServiceOptions {
  apiBaseUrl: string
  timeout: number
  retries: number
}

export class UserService {
  private logger: Logger
  private config: Config
  private db: Database

  constructor(options: UserServiceOptions) {
    this.logger = new Logger("UserService")
    this.config = new Config(options)
    this.db = new Database(options.apiBaseUrl)
  }

  async createUser(userData: UserCreateRequest): Promise<User> {
    this.logger.info("Creating new user", { userData })

    try {
      // 외부 API 호출
      const response = await axios.post(`${this.config.apiBaseUrl}/users`, userData, {
        timeout: this.config.timeout,
        headers: {
          "Content-Type": "application/json"
        }
      })

      const user = response.data as User

      // 데이터베이스에 저장
      await this.db.saveUser(user)

      this.logger.info("User created successfully", { userId: user.id })
      return user
    } catch (error) {
      this.logger.error("Failed to create user", { error, userData })
      throw new Error(`사용자 생성 실패: ${error}`)
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    this.logger.debug("Fetching user by ID", { userId })

    try {
      // 먼저 로컬 데이터베이스에서 확인
      const localUser = await this.db.findUserById(userId)
      if (localUser) {
        return localUser
      }

      // 외부 API에서 조회
      const response = await axios.get(`${this.config.apiBaseUrl}/users/${userId}`, {
        timeout: this.config.timeout
      })

      const user = response.data as User

      // 로컬 데이터베이스에 캐시
      await this.db.saveUser(user)

      return user
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null
      }

      this.logger.error("Failed to fetch user", { error, userId })
      throw error
    }
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    this.logger.info("Updating user", { userId, updateData })

    const existingUser = await this.getUserById(userId)
    if (!existingUser) {
      throw new Error(`사용자를 찾을 수 없습니다: ${userId}`)
    }

    try {
      const response = await axios.put(`${this.config.apiBaseUrl}/users/${userId}`, updateData, {
        timeout: this.config.timeout
      })

      const updatedUser = response.data as User

      // 로컬 데이터베이스 업데이트
      await this.db.updateUser(userId, updatedUser)

      this.logger.info("User updated successfully", { userId })
      return updatedUser
    } catch (error) {
      this.logger.error("Failed to update user", { error, userId, updateData })
      throw error
    }
  }

  async deleteUser(userId: string): Promise<void> {
    this.logger.info("Deleting user", { userId })

    try {
      await axios.delete(`${this.config.apiBaseUrl}/users/${userId}`, {
        timeout: this.config.timeout
      })

      // 로컬 데이터베이스에서도 삭제
      await this.db.deleteUser(userId)

      this.logger.info("User deleted successfully", { userId })
    } catch (error) {
      this.logger.error("Failed to delete user", { error, userId })
      throw error
    }
  }

  async listUsers(limit = 50, offset = 0): Promise<Array<User>> {
    this.logger.debug("Listing users", { limit, offset })

    try {
      const response = await axios.get(`${this.config.apiBaseUrl}/users`, {
        params: { limit, offset },
        timeout: this.config.timeout
      })

      const users = response.data as Array<User>

      // 로컬 데이터베이스에 캐시
      for (const user of users) {
        await this.db.saveUser(user)
      }

      return users
    } catch (error) {
      this.logger.error("Failed to list users", { error, limit, offset })
      throw error
    }
  }

  private async validateUserData(userData: UserCreateRequest): Promise<void> {
    if (!userData.email || !userData.name) {
      throw new Error("이메일과 이름은 필수입니다")
    }

    // 이메일 중복 체크
    const existingUser = await this.db.findUserByEmail(userData.email)
    if (existingUser) {
      throw new Error("이미 사용 중인 이메일입니다")
    }
  }

  async getUserStats(): Promise<{ total: number; active: number; lastMonth: number }> {
    try {
      const response = await axios.get(`${this.config.apiBaseUrl}/users/stats`, {
        timeout: this.config.timeout
      })

      return response.data
    } catch (error) {
      this.logger.error("Failed to get user stats", { error })
      throw error
    }
  }
}
