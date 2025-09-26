/**
 * 사용자 서비스 클래스
 */
export interface User {
  id: string
  name: string
  email: string
  createdAt: Date
}

export class UserService {
  private users: Array<User> = []

  /**
   * 사용자 추가
   */
  addUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...user,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date()
    }

    this.users.push(newUser)
    return newUser
  }

  /**
   * ID로 사용자 찾기
   */
  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id)
  }

  /**
   * 이메일로 사용자 찾기
   */
  getUserByEmail(email: string): User | undefined {
    return this.users.find(user => user.email === email)
  }

  /**
   * 모든 사용자 가져오기
   */
  getAllUsers(): Array<User> {
    return [...this.users]
  }

  /**
   * 사용자 삭제 (사용되지 않는 메서드)
   */
  deleteUser(id: string): boolean {
    const index = this.users.findIndex(user => user.id === id)
    if (index !== -1) {
      this.users.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * 사용자 수 반환 (사용되지 않는 메서드)
   */
  getUserCount(): number {
    return this.users.length
  }
}