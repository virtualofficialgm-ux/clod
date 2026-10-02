import { redirect } from 'next/navigation';

// Лендинг появится на этапе 2; пока главная ведёт на витрину компонентов.
export default function Home() {
  redirect('/dev/showcase');
}
