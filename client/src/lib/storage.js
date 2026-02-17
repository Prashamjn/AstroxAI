/**
 * Firebase Storage: profile picture upload.
 */

import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const AVATARS_PATH = "avatars";

export async function uploadProfilePhoto(uid, file) {
  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
  const path = `${AVATARS_PATH}/${uid}/avatar.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}

export async function uploadProfilePhotoResumable(uid, file, { onProgress } = {}) {
  const rawExt = (file.name.split(".").pop() || "jpg").toLowerCase();
  const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
  const path = `${AVATARS_PATH}/${uid}/avatar.${ext}`;
  const storageRef = ref(storage, path);

  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || "image/jpeg",
  });

  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        if (typeof onProgress === "function" && snap.totalBytes) {
          onProgress(snap.bytesTransferred / snap.totalBytes);
        }
      },
      (err) => reject(err),
      () => resolve()
    );
  });

  return getDownloadURL(task.snapshot.ref);
}
