import { Redirect } from 'expo-router';

// Вкладка «+» не открывается как экран: таб-бар ведёт на /task/new
export default function CreateTab() {
  return <Redirect href="/task/new" />;
}
