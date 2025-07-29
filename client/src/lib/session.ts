// Session management utility for the client
export class SessionManager {
  private static readonly SESSION_KEY = 'video-session-id';
  private sessionId: string | null = null;

  constructor() {
    this.sessionId = this.getStoredSessionId();
  }

  private getStoredSessionId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SessionManager.SESSION_KEY);
    }
    return null;
  }

  private storeSessionId(sessionId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SessionManager.SESSION_KEY, sessionId);
    }
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    this.storeSessionId(sessionId);
  }

  public getSessionHeaders(): Record<string, string> {
    const language = typeof window !== 'undefined' ? (localStorage.getItem('videolm-language') || 'ja') : 'ja';
    return this.sessionId ? { 
      'X-Session-Id': this.sessionId,
      'X-User-Language': language
    } : {
      'X-User-Language': language
    };
  }

  public updateFromResponse(response: Response): void {
    const sessionId = response.headers.get('X-Session-Id');
    if (sessionId && sessionId !== this.sessionId) {
      this.setSessionId(sessionId);
    }
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();