import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { User } from '@supabase/supabase-js';

type UserProfile = {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  age?: number;
  gender?: string;
  weight?: number;
};

type UserContextType = {
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  loading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser(sessionUser: User) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, age, gender, weight')
        .eq('id', sessionUser.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      }

      if (data) {
        const newUser = { id: sessionUser.id, email: sessionUser.email ?? '', ...data };
        setUser(newUser);
        setLoading(false);
      } else {
        // Insert a new row if none exists and return it
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: sessionUser.id }])
          .select()
          .single();

        if (insertError) {
          console.error('Error creating profile:', insertError);
          setUser({ id: sessionUser.id, email: sessionUser.email ?? '' });
          setLoading(false);
        } else if (newProfile) {
          const newUser = { id: sessionUser.id, email: sessionUser.email ?? '', ...newProfile };
          setUser(newUser);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Unexpected error in fetchUser:', error);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data?.session;
      if (session?.user) {
        fetchUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session && session.user) {
        fetchUser(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserProvider;