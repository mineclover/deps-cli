/**
 * 데모 애플리케이션 엔트리 포인트
 */

import { UserService, type User } from './UserService.js'

// UserService만 사용하고 NotificationService는 사용하지 않음
const userService = new UserService()

// 사용자 추가
const user1 = userService.addUser({
  name: 'John Doe',
  email: 'john@example.com'
})

const user2 = userService.addUser({
  name: 'Jane Smith',
  email: 'jane@example.com'
})

// getUserById와 getAllUsers만 사용
console.log('User by ID:', userService.getUserById(user1.id))
console.log('All users:', userService.getAllUsers())

// getUserByEmail, deleteUser, getUserCount는 사용하지 않음