import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, getDocs, collection, addDoc } from 'firebase/firestore';
import { Construction } from 'lucide-react';
import { motion } from 'motion/react';
import AnimatedButton from '../components/AnimatedButton';

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user profile exists
      const docRef = doc(db, 'users', result.user.uid);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Create default inspector profile for new users for the MVP
        await setDoc(docRef, {
          email: result.user.email,
          name: result.user.displayName,
          role: 'inspector', // Default role
          createdAt: serverTimestamp(),
        });

        // Seed demo projects if none exist
        const projectsSnap = await getDocs(collection(db, 'projects'));
        if (projectsSnap.empty) {
          const demoProjects = [
            { 
              name: 'Skyline Plaza', 
              location: 'London, UK', 
              status: 'active', 
              ownerId: result.user.uid, 
              memberIds: [result.user.uid],
              createdAt: serverTimestamp() 
            },
            { 
              name: 'Riverfront Residences', 
              location: 'Manchester, UK', 
              status: 'active', 
              ownerId: result.user.uid, 
              memberIds: [result.user.uid],
              createdAt: serverTimestamp() 
            },
          ];
          for (const p of demoProjects) {
            await addDoc(collection(db, 'projects'), p);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 bg-white p-8 border border-stone-200 rounded-2xl shadow-sm"
      >
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-amber-400 rounded-xl flex items-center justify-center text-slate-900 mb-6 font-black text-3xl shadow-lg ring-4 ring-amber-400/20">
            N
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-sans uppercase underline-offset-8">NEXUM</h1>
          <p className="mt-2 text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Construction Workflow Platform</p>
        </div>

        <div className="mt-10 space-y-6">
          <p className="text-center text-slate-500 text-sm leading-relaxed">
            Digitize site inspections and automate your reporting pipeline with modular precision.
          </p>

          <AnimatedButton
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 shadow-xl"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-amber-400 border-t-transparent animate-spin rounded-full" />
            ) : (
              'Get Started with Google'
            )}
          </AnimatedButton>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between text-[10px] text-slate-300 uppercase tracking-widest font-bold">
          <span>v1.0.0 Global</span>
          <span className="flex items-center gap-1.5 text-emerald-500">
            <div className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
            System Live
          </span>
        </div>
      </motion.div>
    </div>
  );
}
