/**
 * Firestore helpers: user profile, username uniqueness (transaction).
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { validateUsernameFormat } from "./usernameValidation";

const USERS = "users";
const USERNAMES = "usernames";

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Create or update user profile. Username must pass format + uniqueness.
 * Once username is set it cannot be changed (enforced in Firestore rules and here we don't allow update of username if already set).
 */
export async function setUserProfile(uid, data) {
  const ref = doc(db, USERS, uid);
  const existing = await getDoc(ref);
  const existingData = existing.exists() ? existing.data() : null;

  if (data.username !== undefined) {
    const { valid, error, normalized } = validateUsernameFormat(data.username);
    if (!valid) throw new Error(error);
    const username = normalized;

    if (existingData?.username && existingData.username !== username) {
      throw new Error("Username cannot be changed after it is set.");
    }

    await runTransaction(db, async (tx) => {
      const unameRef = doc(db, USERNAMES, username);
      const unameSnap = await tx.get(unameRef);
      if (unameSnap.exists() && unameSnap.data().uid !== uid) {
        throw new Error("This username is already taken.");
      }
      const payload = {
        ...(existingData || {}),
        ...data,
        username,
        updatedAt: serverTimestamp(),
      };
      if (!existing.exists()) {
        payload.createdAt = serverTimestamp();
        tx.set(ref, payload);
      } else {
        tx.update(ref, payload);
      }
      tx.set(unameRef, { uid }, { merge: true });
    });
    return;
  }

  const payload = {
    ...(existingData || {}),
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    await setDoc(ref, payload);
  } else {
    await updateDoc(ref, payload);
  }
}

/**
 * Check if a username is available (format + not taken).
 */
export async function isUsernameAvailable(username) {
  const { valid, error, normalized } = validateUsernameFormat(username);
  if (!valid) return { available: false, error };
  const snap = await getDoc(doc(db, USERNAMES, normalized));
  return { available: !snap.exists(), normalized };
}
