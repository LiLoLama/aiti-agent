import { useEffect, useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabase';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RequireAuth } from './components/RequireAuth';
import { ProfilePage } from './pages/ProfilePage';

interface TodoRecord {
  id?: string | number;
  title?: string;
  [key: string]: unknown;
}

function App() {
  const [todos, setTodos] = useState<TodoRecord[]>([]);

  useEffect(() => {
    const getTodos = async () => {
      const { data, error } = await supabase.from('todos').select('*');

      if (error) {
        console.error('Fehler beim Laden der Todos aus Supabase', error);
        return;
      }

      if (data && data.length > 0) {
        setTodos(data as TodoRecord[]);
      }
    };

    void getTodos();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {todos.length > 0 && (
        <div style={{ display: 'none' }} aria-hidden="true">
          <ul>
            {todos.map((todo, index) => (
              <li
                key={
                  typeof todo.id !== 'undefined' && todo.id !== null
                    ? String(todo.id)
                    : `todo-${index}`
                }
              >
                {typeof todo.title === 'string' && todo.title.length > 0
                  ? todo.title
                  : JSON.stringify(todo)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default App;
