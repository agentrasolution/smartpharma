import { Resend } from "resend";
import { config } from "../config/env";

const resend = config.resend.apiKey ? new Resend(config.resend.apiKey) : null;

export const emailService = {
  /**
   * Sends an email via Resend or logs it in development/fallback mode.
   */
  async sendEmail({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!to || !to.includes("@")) {
      return { success: false, error: "Invalid recipient email" };
    }

    if (!resend) {
      console.log(`\n================== [EMAIL SERVICE (MOCK / NO API KEY)] ==================`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text Preview: ${text || subject}`);
      console.log(`=========================================================================\n`);
      return { success: true, id: `mock-${Date.now()}` };
    }

    try {
      const response = await resend.emails.send({
        from: config.resend.fromEmail,
        to,
        subject,
        html,
        text: text || subject,
      });

      if (response.error) {
        console.error("Resend API error:", response.error);
        return { success: false, error: response.error.message };
      }

      return { success: true, id: response.data?.id };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to send email via Resend:", errorMsg);
      return { success: false, error: errorMsg };
    }
  },

  /**
   * Sends a 6-digit verification code email with 7-day grace period reminder.
   */
  async sendVerificationCodeEmail(to: string, otp: string, pharmacyName: string) {
    const subject = `Your SmartPharma verification code: ${otp}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 28px 32px; text-align: left; }
          .header h1 { color: #ffffff; font-size: 20px; margin: 0; font-weight: 700; letter-spacing: -0.02em; }
          .badge { display: inline-block; background: #0284c7; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; margin-bottom: 8px; }
          .content { padding: 32px; }
          .otp-card { background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0284c7; font-family: monospace; }
          .otp-expiry { font-size: 12px; color: #64748b; margin-top: 8px; }
          .grace-note { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #1e40af; line-height: 1.5; margin: 20px 0; }
          .footer { padding: 20px 32px; background: #fafafa; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">SmartPharma ERP</span>
            <h1>Verify your pharmacy email</h1>
          </div>
          <div class="content">
            <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
              Hello <strong>${pharmacyName || "Valued Partner"}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              Thank you for registering with SmartPharma. Please use the 6-digit verification code below to verify your email address:
            </p>

            <div class="otp-card">
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">Valid for 15 minutes • Do not share this code</div>
            </div>

            <div class="grace-note">
              <strong>Grace Period Active:</strong> You have a <strong>7-day grace period</strong> from registration to verify your email address. During this time you enjoy uninterrupted access to all pharmacy operations.
            </div>

            <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
              If you did not request this verification, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} SmartPharma Cloud ERP. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
    const text = `Your SmartPharma verification code is: ${otp}. Valid for 15 minutes. You have a 7-day grace period to verify your account.`;

    return this.sendEmail({ to, subject, html, text });
  },

  /**
   * Sends a 6-digit OTP code for pharmacy owner password reset.
   */
  async sendPasswordResetOtpEmail(to: string, otp: string, pharmacyName: string) {
    const subject = `Reset your SmartPharma password: ${otp}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 24px; color: #1e293b; }
          .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
          .header { background: #0f172a; padding: 28px 32px; text-align: left; }
          .header h1 { color: #ffffff; font-size: 20px; margin: 0; font-weight: 700; letter-spacing: -0.02em; }
          .badge { display: inline-block; background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; margin-bottom: 8px; }
          .content { padding: 32px; }
          .otp-card { background: #fff5f5; border: 2px dashed #fca5a5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace; }
          .otp-expiry { font-size: 12px; color: #7f1d1d; margin-top: 8px; }
          .warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 13px; color: #92400e; line-height: 1.5; margin: 20px 0; }
          .footer { padding: 20px 32px; background: #fafafa; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">Security Alert</span>
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p style="font-size: 15px; line-height: 1.6; margin-top: 0;">
              Hello <strong>${pharmacyName || "Pharmacy Administrator"}</strong>,
            </p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
              We received a request to reset the administrator password for your SmartPharma account. Use the one-time code below to proceed:
            </p>

            <div class="otp-card">
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">Valid for 15 minutes • Single use only</div>
            </div>

            <div class="warning">
              <strong>Security Warning:</strong> If you did not request this password reset, someone may be attempting to access your account. Please check your credentials immediately.
            </div>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} SmartPharma Cloud ERP. All rights reserved.
          </div>
        </div>
      </body>
      </html>
    `;
    const text = `Your SmartPharma password reset code is: ${otp}. Valid for 15 minutes.`;

    return this.sendEmail({ to, subject, html, text });
  },
};
