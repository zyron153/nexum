import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState, createContext, useContext } from 'react';
import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import InspectionForm from './pages/InspectionForm';
import ProjectList from './pages/ProjectList';
import Parameters from './pages/Parameters';
import DailyLogs from './pages/DailyLogs';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

import { ToastProvider } from './contexts/ToastContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile({ uid: u.uid, ...docSnap.data() } as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-stone-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/projects" element={user ? <ProjectList /> : <Navigate to="/login" />} />
            <Route path="/parameters" element={user ? <Parameters /> : <Navigate to="/login" />} />
            <Route path="/daily-logs/new" element={user ? <DailyLogs /> : <Navigate to="/login" />} />
            <Route path="/inspections/new" element={user ? <InspectionForm /> : <Navigate to="/login" />} />
            <Route path="/inspections/:id" element={user ? <InspectionForm /> : <Navigate to="/login" />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthContext.Provider>
  );
}
