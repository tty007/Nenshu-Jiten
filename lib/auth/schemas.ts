import { z } from "zod";

const email = z.string().trim().email("メールアドレスの形式が正しくありません");
const password = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください")
  .max(128, "パスワードが長すぎます");
const displayName = z
  .string()
  .trim()
  .min(1, "表示名を入力してください")
  .max(50, "表示名は50文字以内で入力してください");

export const signUpSchema = z.object({
  email,
  password,
  displayName,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "パスワードを入力してください"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "パスワードが一致しません",
    path: ["passwordConfirm"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
    newPassword: password,
    newPasswordConfirm: z.string(),
  })
  .refine((d) => d.newPassword === d.newPasswordConfirm, {
    message: "新しいパスワードが一致しません",
    path: ["newPasswordConfirm"],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

export const updateEmailSchema = z.object({ email });
export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;

export const updateDisplayNameSchema = z.object({ displayName });
export type UpdateDisplayNameInput = z.infer<typeof updateDisplayNameSchema>;
