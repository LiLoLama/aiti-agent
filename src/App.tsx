import { useEffect, useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabase';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { RequireAuth } from './components/RequireAuth';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  const [profiles, setProfiles] = useState<{ id: string; display_name: string | null }[]>([]);

  useEffect(() => {
    const loadProfiles = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .order('created_at', { ascending: true })
        .limit(5);

      if (error) {
        if (error.code === 'PGRST205') {
          console.info(
            "Supabase-Demoabfrage übersprungen, da die Tabelle 'profiles' nicht vorhanden ist."
          );
        } else {
          console.error('Fehler beim Laden der Profile aus Supabase', error);
        }
        return;
      }

      if (data && data.length > 0) {
        setProfiles(
          data.map((record) => ({
            id: record.id as string,
            display_name: (record.display_name as string | null) ?? null
          }))
        );
      }
    };

    void loadProfiles();
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
      {profiles.length > 0 && (
        <div style={{ display: 'none' }} aria-hidden="true">
          <ul>
            {profiles.map((profile) => (
              <li
                key={profile.id}
              >
                {profile.display_name ?? profile.id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default App;
