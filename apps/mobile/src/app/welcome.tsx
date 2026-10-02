import { Redirect } from 'expo-router';

// Приветствие теперь — первый шаг регистрации (Google, Apple, email, «У меня уже есть аккаунт»)
export default function Welcome() {
  return <Redirect href="/register" />;
}
