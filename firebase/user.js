import { doc, getDoc } from "firebase/firestore";
import db from "./firestore";

/** @typedef {{ id?: string, name?: string, role?: string, studentId?: string, studentIds?: string[], accountType?: string, familyName?: string, email?: string }} UserProfile */

/** @returns {Promise<UserProfile|null>} */
export const getUserProfile = async (uid) => {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  return {
    id: userSnap.id,
    ...userSnap.data(),
  };
};
