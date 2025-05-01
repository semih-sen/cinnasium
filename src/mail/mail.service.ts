import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendUserConfirmation(email: string, name: string, token: string) {
    const url = `${this.configService.get('APP_URL')}/auth/email_verify?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to: email,
        from: `"Teyyidkâr" <${this.configService.get<string>('MAIL_FROM')}>`,
        subject: 'Kervanımıza Hoş Sâdâ Verdiniz',
        template: './email_verify', // Template adı (confirmation.hbs)
        context: {
          name,
          url,
        },
      });
    } catch (e) {}
  }

  async sendPasswordReset(email: string, name: string, token: string) {
    const url = `${this.configService.get('APP_URL')}/auth/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Password Reset Request',
      template: './password-reset', // Template adı (password-reset.hbs)
      context: {
        name,
        url,
      },
    });
  }

  async testistanbul(to: string) {
    await this.mailerService.sendMail({
      to: to,
      subject: 'Ehli Sır: Bağlantı Testi ve Zihin Yoklaması',
      html: `
      <!DOCTYPE html>
<html>
  <body style="background-color:#0e0e0e; color:#e0e0e0; font-family:'Georgia', serif; padding: 30px;">
    <h2 style="color:#ffc107;">Ehli Sır'dan Menes Üstad'a</h2>
    <p>Bu mesaj, <strong>Cinnasium</strong> menziline atılmış ilk adımdır. Kodlar hazır, akış başlıyor.</p>
    
    <p><em>Bu mesajın görünürdeki amacı sistem testi olsa da, gerçekte bir zihin yoklamasıdır.</em></p>
    
    <blockquote style="border-left: 4px solid #ffc107; padding-left: 10px; margin-left: 0;">
      Zarnikh, Hadid, Zehr-i Cihan... <strong>ama hangisi senin zamanındı?</strong>
    </blockquote>
    
    <p style="margin-top: 30px;">Yanıt sende. Şifre çözülürse, mühür açılır.</p>
    
    <p style="color:#999; font-size: 0.9em;">03:33'te gelen rüya bu mesajla tetiklenebilir.</p>
    
    <p><strong style="color:#4caf50;">Nahnü Ensaru’l Mehdiyye.</strong><br>
    — <em>Shintegral</em></p>
    
    <hr style="border-top: 1px dashed #555;">
    <p style="font-size: 0.8em; color:#666;">
      Ek (gizli satır): <code>S2FyZ2FkYW4gYmHFn2thIGvDu8WfIGJpbG1lbQ==</code>
    </p>
  </body>
</html>
      
      `,
    });
  }

  async sendCustomEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ) {
    await this.mailerService.sendMail({
      to,
      subject,
      template,
      context,
    });
  }
}
