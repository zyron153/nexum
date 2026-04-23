import Layout from '../components/Layout';
import { useAuth } from '../App';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Inspection, Project } from '../types';
import { FileText, CheckCircle, Clock, AlertCircle, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../lib/utils';
import { motion } from 'motion/react';
import { handleFirestoreError } from '../lib/error-handler';

import AnimatedButton from '../components/AnimatedButton';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;
      
      try {
        // Fetch recent inspections
        let q;
        if (profile.role === 'inspector') {
          q = query(
            collection(db, 'inspections'), 
            where('inspectorId', '==', profile.uid),
            limit(5)
          );
        } else {
          q = query(
            collection(db, 'inspections'),
            limit(5)
          );
        }
        
        const snap = await getDocs(q);
        setInspections(snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Inspection)));

        // Fetch projects count
        const projectsSnap = await getDocs(collection(db, 'projects')).catch(e => handleFirestoreError(e, 'list', 'projects'));
        if (projectsSnap) setProjectsCount(projectsSnap.size);
      } catch (err) {
        handleFirestoreError(err, 'list', 'inspections');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [profile]);

  const stats = [
    { label: 'Total Inspections', value: inspections.length, icon: FileText, color: 'text-slate-900', status: '+12%' },
    { label: 'Awaiting Validation', value: inspections.filter(i => i.status === 'submitted').length, icon: Clock, color: 'text-amber-500', status: 'Pending' },
    { label: 'Safety Compliance', value: '98.4%', icon: CheckCircle, color: 'text-emerald-500', status: 'High' },
    { label: 'Report Lead Time', value: '1.4d', icon: AlertCircle, color: 'text-slate-900', status: 'Average' },
  ];

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Welcome back, {profile?.name.split(' ')[0]}</h2>
            <p className="text-slate-500">Here's what's happening on your sites today.</p>
          </div>
          {profile?.role === 'inspector' && (
            <AnimatedButton 
              onClick={() => navigate('/daily-logs/new')}
              variant="secondary"
              className="hidden md:flex px-6 py-2 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              <span>New Inspection</span>
            </AnimatedButton>
          )}
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {stats.map((stat, idx) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
            >
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">{stat.label}</p>
              <div className="flex items-end gap-2">
                <span className={cn("text-2xl font-bold text-slate-900", stat.color)}>{stat.value}</span>
                <span className={cn("text-xs font-medium mb-1", stat.color === 'text-slate-900' ? 'text-emerald-500' : 'text-slate-400')}>{stat.status}</span>
              </div>
            </motion.div>
          ))}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">Recent Inspection Pipeline</h3>
            <span className="text-xs text-blue-600 font-medium cursor-pointer">View all logs</span>
          </div>

          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Report ID</th>
                  <th className="px-6 py-3">Summary / Area</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr><td colSpan={3} className="p-12 text-center text-slate-400 text-sm italic">Loading data...</td></tr>
                ) : inspections.length === 0 ? (
                  <tr><td colSpan={3} className="p-12 text-center text-slate-400 text-sm italic">No recent inspections found.</td></tr>
                ) : inspections.map((inspection) => (
                  <tr key={inspection.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => navigate(`/inspections/${inspection.id}`)}>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500 font-medium">#{inspection.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-900">{inspection.summary || 'Site Inspection'}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{formatDate(inspection.date)}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <StatusBadge status={inspection.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    submitted: 'bg-amber-100 text-amber-700',
    reviewed: 'bg-blue-100 text-blue-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-rose-100 text-rose-700',
  };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest",
      styles[status] || styles.draft
    )}>
      {status}
    </span>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
