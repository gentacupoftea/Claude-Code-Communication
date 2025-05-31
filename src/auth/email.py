"""
Email service for authentication-related emails
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import os

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending authentication-related emails"""
    
    def __init__(self):
        # Email configuration from environment variables
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@conea.ai")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        self.enabled = os.getenv("EMAIL_ENABLED", "false").lower() == "true"
    
    async def send_password_reset_email(self, to_email: str, user_name: str, reset_token: str) -> bool:
        """Send password reset email to user"""
        try:
            if not self.enabled:
                # In development, just log the reset link
                reset_link = f"{self.frontend_url}/auth/reset-password?token={reset_token}"
                logger.info(f"Password reset link for {to_email}: {reset_link}")
                return True
            
            # Create reset link
            reset_link = f"{self.frontend_url}/auth/reset-password?token={reset_token}"
            
            # Create email content
            subject = "Reset Your Password - Conea"
            
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #4F46E5;">Reset Your Password</h2>
                        <p>Hi {user_name or 'there'},</p>
                        <p>We received a request to reset your password. Click the button below to create a new password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{reset_link}" 
                               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 6px; display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #4F46E5;">{reset_link}</p>
                        <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
                        <p>If you didn't request a password reset, please ignore this email. Your password won't be changed.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This is an automated message from Conea. Please do not reply to this email.
                        </p>
                    </div>
                </body>
            </html>
            """
            
            text_body = f"""
Reset Your Password

Hi {user_name or 'there'},

We received a request to reset your password. Visit the link below to create a new password:

{reset_link}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email. Your password won't be changed.

This is an automated message from Conea. Please do not reply to this email.
            """
            
            # Send email
            return await self._send_email(to_email, subject, text_body, html_body)
            
        except Exception as e:
            logger.error(f"Error sending password reset email: {str(e)}")
            return False
    
    async def send_password_changed_email(self, to_email: str, user_name: str) -> bool:
        """Send password changed confirmation email"""
        try:
            if not self.enabled:
                logger.info(f"Password changed notification for {to_email}")
                return True
            
            subject = "Your Password Has Been Changed - Conea"
            
            html_body = f"""
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #4F46E5;">Password Changed Successfully</h2>
                        <p>Hi {user_name or 'there'},</p>
                        <p>This email confirms that your password has been successfully changed.</p>
                        <p>If you did not make this change, please contact our support team immediately.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{self.frontend_url}/login" 
                               style="background-color: #4F46E5; color: white; padding: 12px 30px; 
                                      text-decoration: none; border-radius: 6px; display: inline-block;">
                                Sign In
                            </a>
                        </div>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This is an automated security notification from Conea.
                        </p>
                    </div>
                </body>
            </html>
            """
            
            text_body = f"""
Password Changed Successfully

Hi {user_name or 'there'},

This email confirms that your password has been successfully changed.

If you did not make this change, please contact our support team immediately.

Sign in to your account: {self.frontend_url}/login

This is an automated security notification from Conea.
            """
            
            return await self._send_email(to_email, subject, text_body, html_body)
            
        except Exception as e:
            logger.error(f"Error sending password changed email: {str(e)}")
            return False
    
    async def _send_email(self, to_email: str, subject: str, text_body: str, html_body: str) -> bool:
        """Internal method to send email"""
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.from_email
            msg['To'] = to_email
            
            # Add text and HTML parts
            text_part = MIMEText(text_body, 'plain')
            html_part = MIMEText(html_body, 'html')
            
            msg.attach(text_part)
            msg.attach(html_part)
            
            # Send email
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False


# Global email service instance
email_service = EmailService()