/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { auth } from './firebase';

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: any[];
  }
}

/**
 * Handles Firestore errors by formatting them into a detailed JSON string
 * as required by the system instructions.
 */
export function handleFirestoreError(
  error: any,
  operationType: FirestoreErrorInfo['operationType'],
  path: string | null = null
): never {
  if (error?.message?.includes('Missing or insufficient permissions')) {
    const user = auth.currentUser;
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: user?.uid || null,
        email: user?.email || null,
        emailVerified: user?.emailVerified || false,
        isAnonymous: user?.isAnonymous || false,
        providerInfo: user?.providerData || [],
      }
    };
    
    const detailedError = new Error(JSON.stringify(errorInfo));
    console.error("Firestore Permission Denied:", errorInfo);
    throw detailedError;
  }
  
  throw error;
}
