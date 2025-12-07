export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp?: Date;
}

class Analytics {
  private isDevelopment = process.env.NODE_ENV === 'development';

  track(event: AnalyticsEvent): void {
    if (this.isDevelopment) {
      console.log('[Analytics]', event);
      return;
    }

    // Send to analytics service (e.g., PostHog, Mixpanel, Google Analytics)
    if (typeof window !== 'undefined') {
      // Client-side tracking
      this.sendToAnalytics(event);
    }
  }

  private sendToAnalytics(event: AnalyticsEvent): void {
    // TODO: Integrate with analytics service
    // Example for PostHog:
    // posthog.capture(event.name, event.properties);
    
    // Example for Google Analytics:
    // gtag('event', event.name, event.properties);
  }

  // Common events
  pageView(path: string): void {
    this.track({
      name: 'page_view',
      properties: { path },
    });
  }

  userLogin(userId: string, role: string): void {
    this.track({
      name: 'user_login',
      properties: { userId, role },
    });
  }

  userLogout(userId: string): void {
    this.track({
      name: 'user_logout',
      properties: { userId },
    });
  }

  transactionCreated(transactionId: string, amount: number): void {
    this.track({
      name: 'transaction_created',
      properties: { transactionId, amount },
    });
  }

  productPurchased(productId: string, productName: string, price: number): void {
    this.track({
      name: 'product_purchased',
      properties: { productId, productName, price },
    });
  }

  errorOccurred(error: string, context?: Record<string, unknown>): void {
    this.track({
      name: 'error_occurred',
      properties: { error, ...context },
    });
  }
}

export const analytics = new Analytics();
