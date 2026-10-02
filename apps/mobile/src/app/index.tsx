import { Redirect } from 'expo-router';

// Экраны приложения появятся на следующих этапах; пока открываем витрину.
export default function Index() {
  return <Redirect href="/showcase" />;
}
