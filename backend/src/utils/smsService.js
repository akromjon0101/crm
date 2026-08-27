const axios = require('axios');

class EskizService {
  constructor() {
    this.email = process.env.ESKIZ_EMAIL;
    this.password = process.env.ESKIZ_PASSWORD;
    this.from = process.env.ESKIZ_FROM || '4546';
    this.baseUrl = 'https://notify.eskiz.uz/api';
    this.token = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Get authentication token from Eskiz.
   * Tokens are cached for ~24 hours.
   */
  async getToken() {
    // If we have a valid token, return it
    if (this.token && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.token;
    }

    try {
      console.log('[Eskiz] Authenticating...');
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        email: this.email,
        password: this.password
      });

      if (response.data && response.data.data && response.data.data.token) {
        this.token = response.data.data.token;
        // Eskiz tokens typically last 30 days, but we refresh every 24h to be safe
        this.tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        return this.token;
      }
      throw new Error('Failed to get token from Eskiz');
    } catch (error) {
      console.error('[Eskiz Auth Error]', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Send a single SMS.
   * Phone format: 998XXXXXXXXX (no +)
   */
  async sendSMS(phone, message) {
    const token = await this.getToken();
    if (!token) {
      console.error('[Eskiz] Skipping SMS: No token');
      return { success: false, message: 'Auth failed' };
    }

    // Clean phone number (strip + and spaces)
    const cleanPhone = String(phone).replace(/\D/g, '');

    try {
      const response = await axios.post(
        `${this.baseUrl}/message/sms/send`,
        {
          mobile_phone: cleanPhone,
          message: message,
          from: this.from
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log(`[Eskiz] SMS sent to ${cleanPhone}: ${response.data.status}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[Eskiz Send Error]', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }
}

// Singleton instance
module.exports = new EskizService();
