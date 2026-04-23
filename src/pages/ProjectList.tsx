import Layout from '../components/Layout';
import React, { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Project, UserProfile } from '../types';
import { useAuth } from '../App';
import { Briefcase, MapPin, ChevronRight, Plus, Search, Filter, X, Loader2, Users, Edit2, Trash2, Archive } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, cn } from '../lib/utils';
import { handleFirestoreError } from '../lib/error-handler';
import { useToast } from '../contexts/ToastContext';
import AnimatedButton from '../components/AnimatedButton';

export default function ProjectList() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // Pending Filter State (for "Filter" button workflow)
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingLocation, setPendingLocation] = useState('');
  const [locations, setLocations] = useState<string[]>([]);

  // New Project Form State
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q).catch(e => handleFirestoreError(e, 'list', 'projects'));
        let projectList: Project[] = [];
        if (snap) {
          projectList = snap.docs.map(d => ({ id: d.id, ...d.data() as any } as Project));
          setProjects(projectList);
        }

        // Fetch location parameters
        const paramsSnap = await getDocs(collection(db, 'parameters')).catch(e => handleFirestoreError(e, 'list', 'parameters'));
        const paramLocations = paramsSnap 
          ? paramsSnap.docs.filter(d => d.data().type === 'location').map(d => d.data().value)
          : [];
        
        const projectLocations = projectList.map(p => p.location);
        const uniqueLocations = Array.from(new Set([...paramLocations, ...projectLocations])).filter(Boolean).sort();
        setLocations(uniqueLocations);

        // Fetch all users for project assignment
        const usersSnap = await getDocs(collection(db, 'users')).catch(e => handleFirestoreError(e, 'list', 'users'));
        if (usersSnap) {
          setAllUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newName) return;
    setSaving(true);
    
    try {
      if (editingProject) {
        // Handle Update
        const projectRef = doc(db, 'projects', editingProject.id);
        const updateData = {
          name: newName,
          location: newLocation,
          memberIds: [profile.uid, ...selectedUserIds],
          updatedAt: serverTimestamp(),
        };
        await updateDoc(projectRef, updateData).catch(e => handleFirestoreError(e, 'update', `projects/${editingProject.id}`));
        
        setProjects(projects.map(p => p.id === editingProject.id ? { ...p, ...updateData } as Project : p));
        showToast('Project updated successfully.', 'success');
      } else {
        // Handle Create
        const projectData = {
          name: newName,
          location: newLocation,
          status: 'active',
          ownerId: profile.uid,
          memberIds: [profile.uid, ...selectedUserIds],
          createdAt: serverTimestamp(),
        };
        
        const docRef = await addDoc(collection(db, 'projects'), projectData).catch(e => handleFirestoreError(e, 'create', 'projects'));
        if (docRef) {
          setProjects([{ id: docRef.id, ...projectData, createdAt: new Date() } as Project, ...projects]);
          showToast('New construction project registered successfully.', 'success');
        }
      }
      
      setShowNewModal(false);
      setEditingProject(null);
      setNewName('');
      setNewLocation('');
      setSelectedUserIds([]);
    } catch (err) {
      console.error(err);
      alert('Failed to process project action');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (project: Project) => {
    try {
      const newStatus = project.status === 'active' ? 'archived' : 'active';
      await updateDoc(doc(db, 'projects', project.id), { status: newStatus });
      setProjects(projects.map(p => p.id === project.id ? { ...p, status: newStatus } as Project : p));
      showToast(`Project ${newStatus === 'active' ? 'reactivated' : 'archived'} successfully.`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;
    setIsDeleting(projectId);
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      setProjects(projects.filter(p => p.id !== projectId));
      showToast('Project deleted successfully.', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(null);
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setNewName(project.name);
    setNewLocation(project.location);
    setSelectedUserIds(project.memberIds?.filter(id => id !== profile?.uid) || []);
    setShowNewModal(true);
  };

  const handleApplyFilters = () => {
    setSearchTerm(pendingSearch);
    setLocationFilter(pendingLocation);
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesLocation = !locationFilter || p.location === locationFilter;
    
    return matchesSearch && matchesLocation;
  });

  return (
    <Layout>
      <div className="p-8 max-w-6xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Project Portfolio</h2>
            <p className="text-slate-500">Manage all registered construction sites and monitoring pipelines.</p>
          </div>
          <AnimatedButton 
            onClick={() => setShowNewModal(true)}
            className="px-6 py-2.5 shadow-md"
          >
            <Plus size={18} className="mr-2" />
            <span>Add New Project</span>
          </AnimatedButton>
        </header>

        {/* Filters */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search projects..."
              value={pendingSearch}
              onChange={(e) => setPendingSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none transition-all text-sm"
            />
          </div>
          <div className="relative">
            <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              value={pendingLocation}
              onChange={(e) => setPendingLocation(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none transition-all text-sm appearance-none"
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          <AnimatedButton
            onClick={handleApplyFilters}
            variant="secondary"
            className="px-6 py-3 shadow-sm"
          >
            <Filter size={16} className="mr-2" />
            <span>Apply Filters</span>
          </AnimatedButton>
          <div className="flex items-center space-x-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest px-2">
            <span>{filteredProjects.length} Projects found</span>
          </div>
        </section>

        {/* Projects Table */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Title & Context</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Team</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Registration</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {loading ? (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic">Synchronizing project data...</td></tr>
                ) : filteredProjects.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 italic">No projects match your criteria.</td></tr>
                ) : filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold text-[10px]">P</div>
                        <span className="font-bold text-slate-900">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-500">
                        <MapPin size={14} className="mr-2 text-slate-300" />
                        {project.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center text-slate-500">
                        <Users size={14} className="mr-2 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-400">{(project.memberIds?.length || 0)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right sm:text-left">
                      <span className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                        project.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                      )}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-medium text-xs">
                      {formatDate(project.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => openEditModal(project)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Project"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(project)}
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            project.status === 'active' ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50" : "text-amber-600 bg-amber-50"
                          )}
                          title={project.status === 'active' ? 'Archive Project' : 'Reactivate Project'}
                        >
                          <Archive size={16} />
                        </button>
                        <button 
                          disabled={isDeleting === project.id}
                          onClick={() => handleDeleteProject(project.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete Project"
                        >
                          {isDeleting === project.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                        <Link 
                          to={`/projects/${project.id}`}
                          className="inline-flex items-center justify-center h-8 w-8 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* New Project Modal */}
        <AnimatePresence>
          {showNewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowNewModal(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingProject ? 'Edit Construction Site' : 'New Construction Site'}
                  </h3>
                  <button onClick={() => { setShowNewModal(false); setEditingProject(null); }} className="text-slate-400 hover:text-slate-900">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddProject} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Project Name</label>
                    <input 
                      autoFocus
                      required
                      type="text" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Skyline Residence"
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Main Location</label>
                    <input 
                      required
                      type="text" 
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="City, Region or Full Address"
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-slate-400">
                        <Users size={14} />
                        <label className="text-[10px] font-bold uppercase tracking-widest">Assign Team Members</label>
                      </div>
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{selectedUserIds.length} Selected</span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-3 border border-slate-100 rounded-2xl bg-white shadow-inner min-h-[100px]">
                      {allUsers.length === 0 ? (
                        <div className="h-20 flex flex-col items-center justify-center text-slate-400 italic text-xs space-y-2">
                          <Loader2 size={16} className="animate-spin opacity-50" />
                          <span>Searching directory...</span>
                        </div>
                      ) : allUsers.filter(u => u.uid !== profile.uid).length === 0 ? (
                        <div className="h-20 flex items-center justify-center text-slate-400 italic text-xs text-center px-4">
                          No other registered users found in the system yet.
                        </div>
                      ) : (
                        allUsers.filter(u => u.uid !== profile.uid).map(user => (
                          <label key={user.uid} className={cn(
                            "flex items-center p-3 rounded-xl cursor-pointer transition-all border group",
                            selectedUserIds.includes(user.uid) 
                              ? "bg-amber-50 border-amber-200" 
                              : "bg-slate-50/50 border-transparent hover:border-slate-200 hover:bg-slate-50"
                          )}>
                            <input 
                              type="checkbox"
                              checked={selectedUserIds.includes(user.uid)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedUserIds([...selectedUserIds, user.uid]);
                                else setSelectedUserIds(selectedUserIds.filter(id => id !== user.uid));
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 mr-3"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-900">{user.name}</p>
                              <div className="flex items-center space-x-2">
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">{user.role}</p>
                                <span className="h-1 w-1 bg-slate-200 rounded-full" />
                                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{user.email}</p>
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed italic">
                      * Members assigned here can contribute to daily logs and view private site documentation.
                    </p>
                  </div>

                  <AnimatedButton 
                    type="submit"
                    disabled={saving}
                    className="w-full py-4 shadow-xl shadow-slate-200"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : (editingProject ? <Save size={16} className="mr-2" /> : <Plus size={16} className="mr-2" />)}
                    <span>{saving ? (editingProject ? 'Updating...' : 'Registering...') : (editingProject ? 'Save Changes' : 'Register Project')}</span>
                  </AnimatedButton>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

