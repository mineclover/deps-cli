/**
 * 알림 서비스 클래스 (사용되지 않는 파일)
 */

export interface Notification {
  id: string
  userId: string
  message: string
  type: 'info' | 'warning' | 'error'
  createdAt: Date
  read: boolean
}

export class NotificationService {
  private notifications: Array<Notification> = []

  /**
   * 알림 생성
   */
  createNotification(userId: string, message: string, type: Notification['type'] = 'info'): Notification {
    const notification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      message,
      type,
      createdAt: new Date(),
      read: false
    }

    this.notifications.push(notification)
    return notification
  }

  /**
   * 사용자의 알림 가져오기
   */
  getUserNotifications(userId: string): Array<Notification> {
    return this.notifications.filter(notification => notification.userId === userId)
  }

  /**
   * 알림 읽음 처리
   */
  markAsRead(notificationId: string): boolean {
    const notification = this.notifications.find(n => n.id === notificationId)
    if (notification) {
      notification.read = true
      return true
    }
    return false
  }
}