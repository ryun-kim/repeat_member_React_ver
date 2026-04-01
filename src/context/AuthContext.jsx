import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 세션 직접 가져오기
    supabase.auth.getSession()
      .then(({ data }) => {
        const session = data?.session;
        if (session?.user) {
          setUser(session.user);
          supabase
            .from('profiles')
            .select()
            .eq('id', session.user.id)
            .single()
            .then(({ data: p }) => setProfile(p ?? null))
            .catch(console.error);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          supabase
            .from('profiles')
            .select()
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => setProfile(data));
        }
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username.trim()}@repeat.app`,
      password,
    });
    return error;
  };

  const signUp = async (username, nickname, password) => {
    const { error: signUpError, data } = await supabase.auth.signUp({
      email: `${username.trim()}@repeat.app`,
      password,
    });
    if (signUpError) return signUpError;
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: `${username.trim()}@repeat.app`,
        nickname,
        role: 'user',
      });
      return profileError;
    }
  };

  const signOut = () => supabase.auth.signOut();

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase.from('profiles').select().eq('id', user.id).single();
    setProfile(data);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
