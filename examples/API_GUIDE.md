# User Management API Guide

이 가이드는 User Management API의 사용법을 설명합니다.

## 개요

User Management API는 사용자 데이터를 관리하기 위한 RESTful API입니다.

### 주요 기능

- 사용자 조회, 생성, 수정, 삭제
- 역할별 사용자 필터링
- 사용자 프로필 관리

## 설치 및 설정

### 1. 패키지 설치

```bash
npm install axios
npm install @types/react --save-dev
npm install @testing-library/react --save-dev
```

### 2. 환경 설정

```typescript
// config/app.config.ts
export const config = {
  api: {
    baseUrl: process.env.API_BASE_URL || 'https://api.example.com',
    timeout: 5000
  }
}
```

### 3. 서비스 초기화

```typescript
import { UserService } from './services/UserService'
import { Logger } from './utils/Logger'

// Logger 설정
Logger.configure({
  level: 'info',
  format: 'json'
})

// 사용자 정보 가져오기
const user = await UserService.getUser('123')
console.log(user)
```

## API 사용 예시

### 사용자 조회

```typescript
import { UserService } from './services/UserService'

try {
  const user = await UserService.getUser('user-id-123')
  console.log('User found:', user.name)
} catch (error) {
  console.error('Failed to fetch user:', error)
}
```

### 사용자 생성

```typescript
import { UserService, CreateUserRequest } from './services/UserService'

const newUser: CreateUserRequest = {
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user'
}

try {
  const createdUser = await UserService.createUser(newUser)
  console.log('User created:', createdUser.id)
} catch (error) {
  console.error('Failed to create user:', error)
}
```

### React 컴포넌트 사용

```tsx
import React from 'react'
import { UserProfile } from './components/UserProfile'

function App() {
  const handleUserUpdate = (user) => {
    console.log('User updated:', user)
  }

  return (
    <div className="app">
      <UserProfile
        userId="123"
        onUserUpdate={handleUserUpdate}
      />
    </div>
  )
}

export default App
```

## 테스트 작성

### 단위 테스트

```typescript
import { UserService } from './UserService'
import axios from 'axios'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('UserService', () => {
  it('should fetch user successfully', async () => {
    const mockUser = { id: '123', name: 'Test User' }
    mockedAxios.get.mockResolvedValue({ data: mockUser })

    const result = await UserService.getUser('123')

    expect(result).toEqual(mockUser)
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.example.com/users/123',
      { timeout: 5000 }
    )
  })
})
```

### React 컴포넌트 테스트

```tsx
import { render, screen } from '@testing-library/react'
import { UserProfile } from './UserProfile'

describe('UserProfile', () => {
  it('should render user name', async () => {
    render(<UserProfile userId="123" />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
  })
})
```

## 에러 처리

### API 에러 타입

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
```

### 에러 처리 예시

```typescript
try {
  const user = await UserService.getUser('invalid-id')
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 404:
        console.log('User not found')
        break
      case 401:
        console.log('Unauthorized access')
        break
      default:
        console.log('API error:', error.message)
    }
  } else {
    console.log('Unexpected error:', error)
  }
}
```

## 베스트 프랙티스

### 1. 타입 안전성

항상 TypeScript 인터페이스를 사용하여 타입 안전성을 보장하세요.

```typescript
interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'moderator'
}
```

### 2. 에러 처리

모든 API 호출에서 적절한 에러 처리를 구현하세요.

### 3. 로깅

개발 및 디버깅을 위해 적절한 로깅을 추가하세요.

### 4. 테스트 커버리지

높은 테스트 커버리지를 유지하세요.

## 문제 해결

### 일반적인 문제

1. **네트워크 타임아웃**
   - `config.api.timeout` 값을 조정하세요
   - 네트워크 연결을 확인하세요

2. **인증 에러**
   - API 키가 올바른지 확인하세요
   - 토큰이 만료되지 않았는지 확인하세요

3. **CORS 에러**
   - 서버 CORS 설정을 확인하세요
   - 프록시 설정을 고려하세요

## 추가 리소스

- [React Testing Library 가이드](https://testing-library.com/docs/react-testing-library/intro/)
- [Axios 문서](https://axios-http.com/docs/intro)
- [TypeScript 가이드](https://www.typescriptlang.org/docs/)