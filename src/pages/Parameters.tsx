import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../App';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { Parameter } from '../types';
import { Settings, Plus, Trash2, List } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import AnimatedButton from '../components/AnimatedButton';

const PARAMETER_TYPES = [
  { id: 'area', label: 'Inspection Areas' },
  { id: 'equipment', label: 'Equipment Types' },
  { id: 'workers', label: 'Personnel Types' },
  { id: 'location', label: 'Construction Locations' }
];

export default function Parameters() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [selectedType, setSelectedType] = useState(PARAMETER_TYPES[0].id);
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchParameters() {
      const q = query(collection(db, 'parameters'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Parameter));
      setParameters(data);
    }
    fetchParameters();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim() || !profile) return;

    setLoading(true);
    try {
      const typeLabel = PARAMETER_TYPES.find(t => t.id === selectedType)?.label || selectedType;
      const paramData = {
        type: selectedType,
        value: newValue.trim(),
        label: newValue.trim(),
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'parameters'), paramData);
      setParameters([{ id: docRef.id, ...paramData, createdAt: new Date() } as Parameter, ...parameters]);
      setNewValue('');
      showToast(`${typeLabel} updated successfully.`, 'success');
    } catch (err) {
      console.error(err);
      alert('Failed to add parameter');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this option?')) return;

    try {
      await deleteDoc(doc(db, 'parameters', id));
      setParameters(parameters.filter(p => p.id !== id));
      showToast('Parameter removed successfully.', 'success');
    } catch (err) {
      console.error(err);
      alert('Failed to delete parameter');
    }
  };

  if (!profile) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center">
              <Settings className="mr-3 text-amber-500" />
              App Parameters
            </h1>
            <p className="text-slate-500 mt-2">Manage the options displayed in selection fields across the platform.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar - Parameter Types */}
          <div className="md:col-span-1 space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 px-2">Fields</h3>
            {PARAMETER_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${
                  selectedType === type.id 
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-sm font-medium">{type.label}</span>
                <List size={14} className={selectedType === type.id ? 'opacity-100' : 'opacity-0'} />
              </button>
            ))}
          </div>

          {/* Main Content - Options List */}
          <div className="md:col-span-3 space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6">
                Manage {PARAMETER_TYPES.find(t => t.id === selectedType)?.label}
              </h2>

              <form onSubmit={handleAdd} className="flex space-x-2 mb-8">
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={`Add new ${PARAMETER_TYPES.find(t => t.id === selectedType)?.label.toLowerCase()} option...`}
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                />
                <AnimatedButton
                  type="submit"
                  variant="secondary"
                  disabled={loading || !newValue.trim()}
                  className="px-6 py-3"
                >
                  <Plus size={16} className="mr-1" />
                  Add
                </AnimatedButton>
              </form>

              <div className="space-y-2">
                {parameters
                  .filter(p => p.type === selectedType)
                  .map(param => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={param.id}
                      className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-amber-200 hover:bg-white hover:shadow-md transition-all"
                    >
                      <span className="text-sm font-medium text-slate-700">{param.label}</span>
                      <button
                        onClick={() => handleDelete(param.id)}
                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                
                {parameters.filter(p => p.type === selectedType).length === 0 && (
                  <div className="py-12 text-center text-slate-400 italic text-sm">
                    No options defined for this field. Add one above.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
              <div className="flex items-start">
                <div className="bg-amber-100 p-2 rounded-lg text-amber-600 mr-4">
                  <Settings size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">System Integration</h4>
                  <p className="text-xs text-amber-700 leading-relaxed mt-1">
                    These options are automatically synchronized with the Inspection Form. 
                    Changes made here reflect instantly for all inspectors in the field.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
