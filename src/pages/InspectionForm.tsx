import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../App';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Save, Send, Users, Hammer, MapPin, Notebook, Plus, Loader2 } from 'lucide-react';
import { Project, Parameter, Inspection } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../lib/error-handler';
import { useToast } from '../contexts/ToastContext';
import AnimatedButton from '../components/AnimatedButton';

export default function InspectionForm() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [params, setParams] = useState<Parameter[]>([]);
  const [step, setStep] = useState(1);
  
  // Form State
  const [projectId, setProjectId] = useState('');
  const [location, setLocation] = useState('');
  const [summary, setSummary] = useState('');
  const [entries, setEntries] = useState({
    workers: '',
    equipment: '',
    area: '',
    notes: ''
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const projectsSnap = await getDocs(collection(db, 'projects')).catch(e => handleFirestoreError(e, 'list', 'projects'));
        const projectsData = projectsSnap ? projectsSnap.docs.map(d => ({ id: d.id, ...d.data() as any } as Project)) : [];
        setProjects(projectsData);
        
        const paramsSnap = await getDocs(collection(db, 'parameters')).catch(e => handleFirestoreError(e, 'list', 'parameters'));
        if (paramsSnap) {
          setParams(paramsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Parameter)));
        }

        // If editing, load inspection data
        if (id) {
          const docRef = doc(db, 'inspections', id);
          const docSnap = await getDoc(docRef).catch(e => handleFirestoreError(e, 'get', `inspections/${id}`));
          
          if (docSnap && docSnap.exists()) {
            const data = docSnap.data() as Inspection;
            setProjectId(data.projectId);
            setLocation(data.location || '');
            setSummary(data.summary || '');
            
            // Load entries
            const entriesSnap = await getDocs(collection(db, `inspections/${id}/entries`)).catch(e => handleFirestoreError(e, 'list', `inspections/${id}/entries`));
            if (entriesSnap) {
              const newEntries = { ...entries };
              const allPhotos: string[] = [];
              entriesSnap.docs.forEach(d => {
                const entryData = d.data();
                if (entryData.category in newEntries) {
                  (newEntries as any)[entryData.category] = entryData.content;
                }
                if (entryData.photoUrls) {
                  allPhotos.push(...entryData.photoUrls);
                }
              });
              setEntries(newEntries);
              setExistingPhotos(Array.from(new Set(allPhotos)));
            }
          }
        } else if (projectsData.length > 0) {
          setProjectId(projectsData[0].id);
        }
      } catch (err) {
        console.error("Fetch Data Error:", err);
      }
    }
    fetchData();
  }, [id]);

  const handleSubmit = async (isSubmission: boolean) => {
    if (!projectId || !profile) return;
    setLoading(true);
    
    try {
      // 1. Prepare inspection doc
      const inspectionData: any = {
        projectId,
        inspectorId: profile.uid,
        date: serverTimestamp(),
        status: isSubmission ? 'submitted' : 'draft',
        location,
        summary,
        updatedAt: serverTimestamp(),
      };
      
      let docRefId = id;
      if (!id) {
        inspectionData.createdAt = serverTimestamp();
        const newDocRef = await addDoc(collection(db, 'inspections'), inspectionData).catch(e => handleFirestoreError(e, 'create', 'inspections'));
        docRefId = (newDocRef as any).id;
      } else {
        await updateDoc(doc(db, 'inspections', id), inspectionData).catch(e => handleFirestoreError(e, 'update', `inspections/${id}`));
      }

      if (!docRefId) throw new Error("Failed to get document ID");
      
      // 2. Upload new photos
      const photoUrls: string[] = [...existingPhotos];
      for (const file of photos) {
        const fileRef = ref(storage, `inspections/${docRefId}/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        photoUrls.push(url);
      }

      // 3. Update detailed entries
      // Delete existing entries first for a clean update
      const existingEntriesSnap = await getDocs(collection(db, `inspections/${docRefId}/entries`));
      for (const ent of existingEntriesSnap.docs) {
        await deleteDoc(doc(db, `inspections/${docRefId}/entries`, ent.id));
      }

      const categories: (keyof typeof entries)[] = ['workers', 'equipment', 'area', 'notes'];
      for (const cat of categories) {
        if (entries[cat]) {
          await addDoc(collection(db, `inspections/${docRefId}/entries`), {
            inspectionId: docRefId,
            category: cat,
            content: entries[cat],
            photoUrls: cat === 'area' ? photoUrls : [], // Attach all photos to 'area' entry
            createdAt: serverTimestamp(),
          }).catch(e => handleFirestoreError(e, 'create', `inspections/${docRefId}/entries`));
        }
      }

      showToast(isSubmission ? 'Site inspection submitted for review.' : 'Inspection draft saved successfully.', 'success');
      navigate('/');
    } catch (err) {
      console.error(err);
      alert('Failed to save inspection. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">{id ? 'Edit Inspection' : 'New Daily Inspection'}</h2>
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-1">Step {step} of 3</p>
          
          <div className="flex space-x-2 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-amber-400" : "bg-slate-200")} />
            ))}
          </div>
        </header>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-8 pb-24">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-stone-900 mb-2">
                    <Users size={20} />
                    <label className="text-sm font-bold uppercase tracking-widest">Labor & Personnel</label>
                  </div>
                  <input
                    list="workers-list"
                    value={entries.workers}
                    onChange={(e) => setEntries({ ...entries, workers: e.target.value })}
                    placeholder="Search or specify sub-contractors, headcount..."
                    className="w-full p-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                  <datalist id="workers-list">
                    {params.filter(p => p.type === 'workers').map(p => (
                      <option key={p.id} value={p.value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-stone-900 mb-2">
                    <Hammer size={20} />
                    <label className="text-sm font-bold uppercase tracking-widest">Equipment On-Site</label>
                  </div>
                  <input
                    list="equipment-list"
                    value={entries.equipment}
                    onChange={(e) => setEntries({ ...entries, equipment: e.target.value })}
                    placeholder="Search or specify cranes, tools..."
                    className="w-full p-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                  <datalist id="equipment-list">
                    {params.filter(p => p.type === 'equipment').map(p => (
                      <option key={p.id} value={p.value} />
                    ))}
                  </datalist>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-stone-900 mb-2">
                    <MapPin size={20} />
                    <label className="text-sm font-bold uppercase tracking-widest">Areas Inspected</label>
                  </div>
                  <input
                    list="area-list"
                    value={entries.area}
                    onChange={(e) => setEntries({ ...entries, area: e.target.value })}
                    placeholder="Search or specify area (e.g. Ground floor)..."
                    className="w-full p-4 bg-white border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                  />
                  <datalist id="area-list">
                    {params.filter(p => p.type === 'area').map(p => (
                      <option key={p.id} value={p.value} />
                    ))}
                  </datalist>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-stone-900 mb-2">
                    <Camera size={20} />
                    <label className="text-sm font-bold uppercase tracking-widest">Photo Documentation</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {existingPhotos.map((url, i) => (
                      <div key={`existing-${i}`} className="aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200 relative group">
                        <img src={url} className="w-full h-full object-cover" alt="Existing" />
                        <button 
                          onClick={() => setExistingPhotos(existingPhotos.filter((_, idx) => idx !== i))}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase transition-opacity"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {photos.map((p, i) => (
                      <div key={`new-${i}`} className="aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200 relative group">
                        <img src={URL.createObjectURL(p)} className="w-full h-full object-cover" alt="Preview" />
                        <button 
                          onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold uppercase transition-opacity"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <label className="aspect-square bg-stone-50 border-2 border-dashed border-stone-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-stone-100 transition-colors">
                      <Plus className="text-stone-400" />
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files) setPhotos([...photos, ...Array.from(e.target.files)]);
                        }} 
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 text-stone-900 mb-2">
                    <Notebook size={20} />
                    <label className="text-sm font-bold uppercase tracking-widest">Final Notes & Observations</label>
                  </div>
                  <textarea 
                    value={entries.notes}
                    onChange={(e) => setEntries({ ...entries, notes: e.target.value })}
                    placeholder="Any deviations from plan, safety concerns, or weather impact..."
                    className="w-full p-4 bg-white border border-stone-200 rounded-xl min-h-[200px]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Footer Navigation */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex justify-between items-center z-10 md:static md:mt-12 md:bg-transparent md:border-none md:p-0">
          <AnimatedButton 
            onClick={prevStep}
            disabled={step === 1}
            variant="ghost"
            className="disabled:opacity-0"
          >
            Back
          </AnimatedButton>
          
          {step < 3 ? (
            <AnimatedButton 
              onClick={nextStep}
              className="px-8 py-3 shadow-md"
            >
              Next Step
            </AnimatedButton>
          ) : (
            <div className="flex space-x-3">
              <AnimatedButton 
                onClick={() => handleSubmit(false)}
                disabled={loading}
                variant="outline"
                className="px-6 py-3 shadow-sm"
              >
                <Save size={14} className="mr-2" />
                Draft
              </AnimatedButton>
              <AnimatedButton 
                onClick={() => handleSubmit(true)}
                disabled={loading}
                variant="secondary"
                className="px-8 py-3 shadow-md"
              >
                <Send size={14} className="mr-2" />
                {loading ? 'Sending...' : 'Submit Report'}
              </AnimatedButton>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
