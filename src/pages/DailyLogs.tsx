import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../App';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, writeBatch, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import { Save, ClipboardCheck, MapPin, Notebook, Users, Hammer, Plus, Minus, Trash2, Loader2, Camera, X } from 'lucide-react';
import { Project, Parameter } from '../types';
import { handleFirestoreError } from '../lib/error-handler';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import AnimatedButton from '../components/AnimatedButton';

interface ResourceEntry {
  type: string;
  quantity: number;
}

export default function DailyLogs() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [params, setParams] = useState<Parameter[]>([]);
  
  // Form State
  const [projectId, setProjectId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [personnel, setPersonnel] = useState<ResourceEntry[]>([]);
  const [equipment, setEquipment] = useState<ResourceEntry[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    async function fetchData() {
      if (!profile) return;
      try {
        const projectsSnap = await getDocs(collection(db, 'projects')).catch(e => handleFirestoreError(e, 'list', 'projects'));
        const projectsData = projectsSnap 
          ? projectsSnap.docs
              .map(d => ({ id: d.id, ...d.data() as any } as Project))
              .filter(p => p.memberIds?.includes(profile.uid))
          : [];
        setProjects(projectsData);
        if (projectsData.length > 0) setProjectId(projectsData[0].id);

        const paramsSnap = await getDocs(collection(db, 'parameters')).catch(e => handleFirestoreError(e, 'list', 'parameters'));
        if (paramsSnap) {
          setParams(paramsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Parameter)));
        }
      } catch (err) {
        console.error("Fetch Data Error:", err);
      }
    }
    fetchData();
  }, [profile]);

  const addResource = (category: 'personnel' | 'equipment') => {
    const setter = category === 'personnel' ? setPersonnel : setEquipment;
    setter(prev => [...prev, { type: '', quantity: 1 }]);
  };

  const updateResource = (category: 'personnel' | 'equipment', index: number, field: keyof ResourceEntry, value: string | number) => {
    const setter = category === 'personnel' ? setPersonnel : setEquipment;
    setter(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeResource = (category: 'personnel' | 'equipment', index: number) => {
    const setter = category === 'personnel' ? setPersonnel : setEquipment;
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!projectId || !profile) {
      alert('Please select a project');
      return;
    }

    // Basic Validation
    const today = new Date().toISOString().split('T')[0];
    if (logDate > today) {
      alert('Future dates are not allowed for site reports.');
      return;
    }

    const invalidPersonnel = personnel.some(p => !p.type || p.quantity <= 0);
    const invalidEquipment = equipment.some(e => !e.type || e.quantity <= 0);
    if (invalidPersonnel || invalidEquipment) {
      alert('Please select types and positive quantities for all items.');
      return;
    }

    setLoading(true);
    
    try {
      const batch = writeBatch(db);
      
      // 1. Create main inspection record
      const inspectionRef = doc(collection(db, 'inspections'));
      const selectedDate = new Date(logDate);
      // Adjust for timezone to ensure the stored timestamp reflects the selected day at noon or start of day
      selectedDate.setHours(12, 0, 0, 0);

      const logData = {
        projectId,
        inspectorId: profile.uid,
        date: selectedDate,
        status: 'draft',
        location,
        summary,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      batch.set(inspectionRef, logData);
      
      // 1.1 Upload photos
      const photoUrls: string[] = [];
      for (const file of photos) {
        const fileRef = ref(storage, `inspections/${inspectionRef.id}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        photoUrls.push(url);
      }

      // 2. Create entries for personnel
      if (personnel.length > 0) {
        const personnelEntryRef = doc(collection(db, `inspections/${inspectionRef.id}/entries`));
        batch.set(personnelEntryRef, {
          inspectionId: inspectionRef.id,
          category: 'workers',
          content: personnel.map(p => `${p.type}: ${p.quantity}`).join(', '),
          metadata: { resources: personnel },
          photoUrls: [],
          createdAt: serverTimestamp()
        });
      }

      // 3. Create entries for equipment
      if (equipment.length > 0) {
        const equipmentEntryRef = doc(collection(db, `inspections/${inspectionRef.id}/entries`));
        batch.set(equipmentEntryRef, {
          inspectionId: inspectionRef.id,
          category: 'equipment',
          content: equipment.map(e => `${e.type}: ${e.quantity}`).join(', '),
          metadata: { resources: equipment },
          photoUrls: [],
          createdAt: serverTimestamp()
        });
      }

      // 4. Create entries for photos
      if (photoUrls.length > 0) {
        const photosEntryRef = doc(collection(db, `inspections/${inspectionRef.id}/entries`));
        batch.set(photosEntryRef, {
          inspectionId: inspectionRef.id,
          category: 'area', // Consistent with InspectionForm
          content: `Attached ${photoUrls.length} site photos.`,
          photoUrls: photoUrls,
          createdAt: serverTimestamp()
        });
      }

      await batch.commit().catch(e => handleFirestoreError(e, 'write', 'inspectionsBatch'));
      
      showToast('Daily site report published successfully. All resources synced.', 'success');
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Failed to save log. Ensure site registries are correctly filled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-4 md:p-12 mb-20 font-sans">
        <header className="mb-12">
          <div className="w-12 h-12 bg-slate-900 text-amber-400 rounded-2xl flex items-center justify-center mb-6 font-bold text-xl shadow-lg ring-4 ring-amber-400/20">
            DL
          </div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Daily Site Report</h2>
          <p className="text-slate-500 mt-2">Document site resources, personnel headcount, and operational machinery.</p>
        </header>

        <div className="space-y-8">
          {/* Site Context */}
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center">
              <ClipboardCheck size={14} className="mr-2" /> Site Context
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Report Date</label>
                <input 
                  type="date"
                  value={logDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all font-bold text-slate-900 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Project Selection</label>
                <select 
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all font-bold text-slate-900 text-sm appearance-none"
                >
                  <option value="" disabled>Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center space-x-2 text-slate-500 mb-1">
                  <MapPin size={14} />
                  <label className="text-[10px] font-bold uppercase tracking-widest px-1">Observation Area</label>
                </div>
                <input
                  list="location-parameters"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Block C, Level 2"
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all font-bold text-slate-900 text-sm"
                />
                <datalist id="location-parameters">
                  {params.filter(p => p.type === 'location').map(p => (
                    <option key={p.id} value={p.value} />
                  ))}
                </datalist>
              </div>
            </div>
          </section>

          {/* Workforce Registry */}
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center">
                <Users size={14} className="mr-2" /> Workforce Registry
              </h3>
              <AnimatedButton 
                onClick={() => addResource('personnel')}
                className="px-4 py-2 shadow-md"
              >
                <Plus size={12} className="mr-1" /> Add Personnel
              </AnimatedButton>
            </div>

            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {personnel.map((p, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    key={idx} 
                    className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group"
                  >
                    <select 
                      value={p.type}
                      onChange={(e) => updateResource('personnel', idx, 'type', e.target.value)}
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm font-bold text-slate-800"
                    >
                      <option value="">Select individual type...</option>
                      {params.filter(param => param.type === 'workers').map(param => (
                        <option key={param.id} value={param.value}>{param.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden px-1 h-11 shadow-sm">
                      <button 
                        onClick={() => updateResource('personnel', idx, 'quantity', Math.max(1, p.quantity - 1))}
                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <input 
                        type="number"
                        value={p.quantity}
                        onChange={(e) => updateResource('personnel', idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-10 text-center font-bold text-sm outline-none bg-transparent"
                      />
                      <button 
                        onClick={() => updateResource('personnel', idx, 'quantity', p.quantity + 1)}
                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeResource('personnel', idx)}
                      className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {personnel.length === 0 && (
                <div className="py-10 text-center text-slate-400 text-xs italic border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                  No personnel recorded for this entry.
                </div>
              )}
            </div>
          </section>

          {/* Equipment Registry */}
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center">
                <Hammer size={14} className="mr-2" /> Equipment Registry
              </h3>
              <AnimatedButton 
                onClick={() => addResource('equipment')}
                className="px-4 py-2 shadow-md"
              >
                <Plus size={12} className="mr-1" /> Add Equipment
              </AnimatedButton>
            </div>

            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {equipment.map((e, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    key={idx} 
                    className="flex items-center space-x-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group"
                  >
                    <select 
                      value={e.type}
                      onChange={(e) => updateResource('equipment', idx, 'type', e.target.value)}
                      className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400 text-sm font-bold text-slate-800"
                    >
                      <option value="">Select machinery type...</option>
                      {params.filter(param => param.type === 'equipment').map(param => (
                        <option key={param.id} value={param.value}>{param.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden px-1 h-11 shadow-sm">
                      <button 
                        onClick={() => updateResource('equipment', idx, 'quantity', Math.max(1, e.quantity - 1))}
                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <input 
                        type="number"
                        value={e.quantity}
                        onChange={(e) => updateResource('equipment', idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-10 text-center font-bold text-sm outline-none bg-transparent"
                      />
                      <button 
                        onClick={() => updateResource('equipment', idx, 'quantity', e.quantity + 1)}
                        className="p-2 text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeResource('equipment', idx)}
                      className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {equipment.length === 0 && (
                <div className="py-10 text-center text-slate-400 text-xs italic border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                  No heavy machinery recorded for this entry.
                </div>
              )}
            </div>
          </section>

          {/* Observations */}
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center">
              <Notebook size={14} className="mr-2" /> Site Observations
            </h3>
            <textarea 
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Record any critical incidents, work delays, or milestones achieved today..."
              className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl min-h-[160px] focus:ring-2 focus:ring-amber-400 outline-none transition-all font-medium text-slate-900 text-sm"
            />
          </section>

          {/* Photos */}
          <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 flex items-center">
              <Camera size={14} className="mr-2" /> Visual Documentation
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <AnimatePresence>
                {photos.map((file, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    key={idx} 
                    className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group shadow-sm"
                  >
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button 
                      onClick={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full text-rose-500 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group">
                <div className="bg-white p-3 rounded-xl shadow-sm text-slate-400 group-hover:text-amber-500 group-hover:shadow-md transition-all">
                  <Plus size={20} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3">Upload</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files) {
                      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
                    }
                  }}
                />
              </label>
            </div>
          </section>

          <footer className="pt-8 mb-20">
            <AnimatedButton 
              onClick={handleSave}
              disabled={loading}
              className="w-full py-5 rounded-3xl shadow-2xl shadow-slate-200"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin mr-3" />
              ) : (
                <Save size={18} className="mr-3" />
              ) }
              <span>{loading ? 'Finalizing Site Sync...' : 'Publish Daily Site Report'}</span>
            </AnimatedButton>
          </footer>
        </div>
      </div>
    </Layout>
  );
}
