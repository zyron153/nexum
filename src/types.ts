/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'inspector' | 'architect' | 'pm' | 'director';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: any;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'completed' | 'on-hold';
  ownerId: string;
  memberIds: string[];
  createdAt: any;
}

export type InspectionStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';

export interface Inspection {
  id: string;
  projectId: string;
  inspectorId: string;
  date: any;
  status: InspectionStatus;
  summary: string;
  location?: string;
  architectId?: string;
  pmId?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface InspectionEntry {
  id: string;
  inspectionId: string;
  category: 'workers' | 'equipment' | 'area' | 'notes';
  content: string;
  metadata?: any;
  photoUrls: string[];
}

export interface Parameter {
  id: string;
  type: string;
  value: string;
  label: string;
  createdAt: any;
}
