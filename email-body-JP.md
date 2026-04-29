# Supabase Email Templates (日本語版)

Supabase Dashboard → **Authentication → Email Templates** に貼り付けて使う日本語テンプレートです。

## 使い方

各テンプレートで2箇所を編集します：

1. **Subject heading** 欄に `件名:` 行の値をコピー
2. **Body (HTML)** 欄に `本文:` 以下のHTMLブロック全体をコピー（既存の英語テンプレートを全削除して上書き）
3. **Save changes**

CTAリンクは Supabase が自動で `{{ .ConfirmationURL }}` を本物のURLに展開します。

---

## Authentication

### 1. Confirm sign up

**件名:**
```
【年収辞典】メールアドレスの確認をお願いします
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">メールアドレスの確認をお願いします</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典にご登録いただきありがとうございます。<br>
          以下のボタンをクリックして、メールアドレスの確認を完了してください。
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#1e40af;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">メールアドレスを確認する</a>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0 0 8px 0;">
          ボタンが押せない場合は以下のURLをブラウザに貼り付けてください。
        </p>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;margin:0 0 24px 0;">
          {{ .ConfirmationURL }}
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:16px;">
          このメールに心当たりがない場合は、お手数ですが破棄してください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 2. Invite user

**件名:**
```
【年収辞典】への招待が届いています
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">年収辞典への招待が届いています</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウント作成にご招待いただきました。<br>
          以下のボタンからアカウントの設定を進めてください。
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#1e40af;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">アカウントを作成する</a>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0 0 8px 0;">
          ボタンが押せない場合は以下のURLをブラウザに貼り付けてください。
        </p>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;margin:0 0 24px 0;">
          {{ .ConfirmationURL }}
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:16px;">
          この招待に心当たりがない場合は、お手数ですが破棄してください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 3. Magic link

**件名:**
```
【年収辞典】ログイン用リンクをお送りします
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">ログイン用リンク</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          以下のボタンをクリックすると、年収辞典にログインできます。<br>
          このリンクは一度のみ使用可能です。
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#1e40af;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">ログインする</a>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0 0 8px 0;">
          ボタンが押せない場合は以下のURLをブラウザに貼り付けてください。
        </p>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;margin:0 0 24px 0;">
          {{ .ConfirmationURL }}
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:16px;">
          このログイン要求に心当たりがない場合は、お手数ですが破棄してください。第三者にこのリンクを共有しないでください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 4. Change email address

**件名:**
```
【年収辞典】新しいメールアドレスの確認
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">メールアドレス変更の確認</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントで、メールアドレスの変更がリクエストされました。<br>
          以下のボタンをクリックすると、新しいメールアドレス（{{ .NewEmail }}）への変更が完了します。
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#1e40af;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">メールアドレスの変更を確定する</a>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0 0 8px 0;">
          ボタンが押せない場合は以下のURLをブラウザに貼り付けてください。
        </p>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;margin:0 0 24px 0;">
          {{ .ConfirmationURL }}
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:16px;">
          このリクエストに心当たりがない場合は、お手数ですが破棄してください。アカウントは現在のメールアドレスのまま変更されません。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 5. Reset password

**件名:**
```
【年収辞典】パスワード再設定のご案内
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">パスワード再設定のご案内</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントでパスワード再設定がリクエストされました。<br>
          以下のボタンをクリックして新しいパスワードを設定してください。
        </p>
        <p style="margin:0 0 24px 0;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;background-color:#1e40af;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">新しいパスワードを設定する</a>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0 0 8px 0;">
          ボタンが押せない場合は以下のURLをブラウザに貼り付けてください。
        </p>
        <p style="font-size:12px;line-height:1.5;color:#6b7280;word-break:break-all;margin:0 0 24px 0;">
          {{ .ConfirmationURL }}
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:16px;">
          このリクエストに心当たりがない場合は、お手数ですが破棄してください。現在のパスワードはそのまま有効です。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 6. Reauthentication

**件名:**
```
【年収辞典】本人確認コード
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">本人確認コード</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 16px 0;">
          重要な操作の確認のため、以下のコードを入力してください。
        </p>
        <p style="text-align:center;margin:0 0 24px 0;">
          <span style="display:inline-block;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:10px;padding:16px 28px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:700;letter-spacing:0.4em;color:#111827;">{{ .Token }}</span>
        </p>
        <p style="font-size:12px;line-height:1.7;color:#6b7280;margin:0;border-top:1px solid #e5e7eb;padding-top:16px;">
          この操作に心当たりがない場合は、ただちにパスワードを変更してください。コードを第三者に共有しないでください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

## Security（操作完了通知）

これらは「○○が変更されました」というお知らせメール。CTAボタンは無く、もし身に覚えがない場合の対応案内を載せる。

### 7. Password changed

**件名:**
```
【年収辞典】パスワードが変更されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">パスワードが変更されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントのパスワードが変更されました。<br>
          今後は新しいパスワードでログインしてください。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：第三者によるアクセスの可能性があります。<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を直ちに行ってください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 8. Email address changed

**件名:**
```
【年収辞典】メールアドレスが変更されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">メールアドレスが変更されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントのメールアドレスが変更されました。<br>
          今後の通知は新しいメールアドレス宛にお送りします。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：第三者がアカウントにアクセスした可能性があります。<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を直ちに行ってください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 9. Phone number changed

**件名:**
```
【年収辞典】電話番号が変更されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">電話番号が変更されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントに登録された電話番号が変更されました。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：直ちに<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を行い、ログインしてアカウント情報をご確認ください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 10. Identity linked

**件名:**
```
【年収辞典】新しいログイン方法が連携されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">新しいログイン方法が連携されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントに、新しいログイン方法（外部サービス連携）が追加されました。<br>
          今後はそのログイン方法でもサインインできます。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：直ちに<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を行い、不要な連携を解除してください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 11. Identity unlinked

**件名:**
```
【年収辞典】ログイン方法の連携が解除されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">ログイン方法の連携が解除されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントから、ログイン方法（外部サービス連携）の解除が行われました。<br>
          そのログイン方法ではサインインできなくなりました。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：直ちに<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を行い、アカウントの状態をご確認ください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 12. Multi-factor authentication method added

**件名:**
```
【年収辞典】二段階認証が追加されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">二段階認証が追加されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントに、新しい二段階認証（多要素認証）が追加されました。<br>
          今後のログイン時にこの認証方法を使用します。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：直ちに<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を行い、追加された認証要素を解除してください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

### 13. Multi-factor authentication method removed

**件名:**
```
【年収辞典】二段階認証が解除されました
```

**本文:**
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Hiragino Kaku Gothic ProN,Yu Gothic,Meiryo,sans-serif;color:#111827;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:40px;">
      <tr><td>
        <p style="font-size:13px;font-weight:600;color:#1e40af;letter-spacing:0.08em;margin:0 0 8px 0;">年収辞典</p>
        <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 16px 0;line-height:1.4;">二段階認証が解除されました</h1>
        <p style="font-size:14px;line-height:1.8;color:#374151;margin:0 0 24px 0;">
          年収辞典のアカウントから、二段階認証（多要素認証）の解除が行われました。<br>
          アカウントのセキュリティレベルが下がっています。
        </p>
        <p style="font-size:13px;line-height:1.7;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:12px 16px;margin:0 0 16px 0;">
          ⚠️ 心当たりがない場合：直ちに<a href="{{ .SiteURL }}/auth/forgot-password" style="color:#b45309;font-weight:600;">パスワードの再設定</a>を行い、再度二段階認証を有効化してください。
        </p>
      </td></tr>
    </table>
    <p style="font-size:11px;color:#9ca3af;margin:16px 0 0 0;">
      <a href="{{ .SiteURL }}" style="color:#6b7280;text-decoration:none;">年収辞典</a> | 有価証券報告書から見る企業のリアルな数字
    </p>
  </td></tr>
</table>
```

---

## 共通 Tips

- **デザイン**: 全テンプレートで同じ枠デザイン（白カード + brand-600 ボタン）を使い、ブランド統一
- **HTMLメール**: 古いメールクライアント（Outlook 等）でも崩れないよう `<table>` レイアウトとインラインCSSを採用
- **Subject の `【年収辞典】`**: 受信箱で目立つように冒頭に括弧付きで配置
- **重要な操作の通知**: Security系メールは「身に覚えがない場合」の連絡先 / 対応手順を必ず提示
- **Reauthentication の Token**: Supabase が自動的に6桁のコードに展開してくれる（`{{ .Token }}`）
- **テンプレート変数**: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}` のみ使用。バージョンによって追加変数（`.Email`, `.OldEmail`, `.Provider` 等）が使えるが、ここでは互換性優先で最小限
